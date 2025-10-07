const os = require('os');
const { Logger } = require('../../../shared');

/**
 * Enhanced Health Check Service for comprehensive system monitoring
 */
class HealthCheckService {
  constructor(serviceDiscovery) {
    this.logger = new Logger('health-check');
    this.serviceDiscovery = serviceDiscovery;
    this.startTime = Date.now();
    
    // Health check configuration
    this.config = {
      memoryThreshold: 0.9, // 90% memory usage
      cpuThreshold: 0.8,    // 80% CPU usage
      diskThreshold: 0.9,   // 90% disk usage
      responseTimeThreshold: 5000, // 5 seconds
      healthCheckInterval: 30000   // 30 seconds
    };

    this.metrics = {
      requests: 0,
      errors: 0,
      lastReset: Date.now()
    };

    this.logger.info('Health check service initialized');
  }

  /**
   * Get basic system information
   */
  getSystemInfo() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
        application: Math.floor((Date.now() - this.startTime) / 1000)
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model,
        usage: this.getCPUUsage()
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usage: usedMem / totalMem,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      },
      loadAverage: os.loadavg()
    };
  }

  /**
   * Get CPU usage percentage (approximated)
   */
  getCPUUsage() {
    const cpus = os.cpus();
    let totalTick = 0;
    let totalIdle = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 1 - idle / total;

    return Math.max(0, Math.min(1, usage));
  }

  /**
   * Check if system resources are healthy
   */
  checkSystemHealth() {
    const systemInfo = this.getSystemInfo();
    const issues = [];

    // Memory check
    if (systemInfo.memory.usage > this.config.memoryThreshold) {
      issues.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${Math.round(systemInfo.memory.usage * 100)}%`,
        value: systemInfo.memory.usage,
        threshold: this.config.memoryThreshold
      });
    }

    // CPU check
    if (systemInfo.cpu.usage > this.config.cpuThreshold) {
      issues.push({
        type: 'cpu',
        severity: 'warning', 
        message: `High CPU usage: ${Math.round(systemInfo.cpu.usage * 100)}%`,
        value: systemInfo.cpu.usage,
        threshold: this.config.cpuThreshold
      });
    }

    // Load average check (Unix systems)
    if (systemInfo.loadAverage[0] > systemInfo.cpu.count * 2) {
      issues.push({
        type: 'load',
        severity: 'warning',
        message: `High load average: ${systemInfo.loadAverage[0].toFixed(2)}`,
        value: systemInfo.loadAverage[0],
        threshold: systemInfo.cpu.count * 2
      });
    }

    return {
      healthy: issues.length === 0,
      issues,
      systemInfo
    };
  }

  /**
   * Check application-specific health
   */
  async checkApplicationHealth() {
    const issues = [];
    
    try {
      // Check database connections (if any)
      // This would be implemented based on your database setup
      
      // Check memory leaks
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
        issues.push({
          type: 'heap',
          severity: 'critical',
          message: 'High heap usage detected',
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        });
      }

      // Check event loop lag
      const eventLoopLag = await this.measureEventLoopLag();
      if (eventLoopLag > 100) { // 100ms threshold
        issues.push({
          type: 'event_loop',
          severity: 'warning',
          message: `Event loop lag detected: ${eventLoopLag}ms`,
          lag: eventLoopLag
        });
      }

    } catch (error) {
      issues.push({
        type: 'application',
        severity: 'critical',
        message: `Application health check failed: ${error.message}`,
        error: error.message
      });
    }

    return {
      healthy: issues.filter(i => i.severity === 'critical').length === 0,
      issues
    };
  }

  /**
   * Measure event loop lag
   */
  measureEventLoopLag() {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(lag);
      });
    });
  }

  /**
   * Check all downstream services health
   */
  async checkServicesHealth() {
    if (!this.serviceDiscovery) {
      return {
        healthy: false,
        message: 'Service discovery not available'
      };
    }

    try {
      const servicesHealth = await this.serviceDiscovery.checkAllServicesHealth();
      
      return {
        healthy: servicesHealth.unhealthy === 0,
        total: servicesHealth.total,
        healthy_count: servicesHealth.healthy,
        unhealthy_count: servicesHealth.unhealthy,
        services: servicesHealth.services,
        timestamp: servicesHealth.timestamp
      };
    } catch (error) {
      this.logger.error('Failed to check services health', error);
      
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Comprehensive health check
   */
  async performHealthCheck(includeDetails = false) {
    const startTime = Date.now();

    try {
      this.metrics.requests++;

      const [systemHealth, appHealth, servicesHealth] = await Promise.all([
        this.checkSystemHealth(),
        this.checkApplicationHealth(),
        this.checkServicesHealth()
      ]);

      const responseTime = Date.now() - startTime;
      const overallHealthy = systemHealth.healthy && appHealth.healthy && servicesHealth.healthy;

      const result = {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        gateway: {
          status: 'running',
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
          metrics: {
            requests: this.metrics.requests,
            errors: this.metrics.errors,
            requestRate: this.metrics.requests / ((Date.now() - this.metrics.lastReset) / 1000)
          }
        },
        system: {
          status: systemHealth.healthy ? 'healthy' : 'unhealthy',
          issues: systemHealth.issues
        },
        application: {
          status: appHealth.healthy ? 'healthy' : 'unhealthy',
          issues: appHealth.issues
        },
        services: servicesHealth
      };

      // Include detailed system information if requested
      if (includeDetails) {
        result.system.details = systemHealth.systemInfo;
      }

      // Log if unhealthy
      if (!overallHealthy) {
        this.logger.warn('Health check failed', {
          systemHealthy: systemHealth.healthy,
          appHealthy: appHealth.healthy,
          servicesHealthy: servicesHealth.healthy,
          responseTime
        });
      }

      return result;

    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Health check error', error);

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Simple liveness probe
   */
  async livenessProbe() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Readiness probe - checks if service is ready to handle requests
   */
  async readinessProbe() {
    try {
      const servicesHealth = await this.checkServicesHealth();
      const ready = servicesHealth.healthy;

      return {
        status: ready ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        services: servicesHealth
      };
    } catch (error) {
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Create health check endpoints
   */
  createRoutes(app) {
    // Main health endpoint
    app.get('/health', async (req, res) => {
      const includeDetails = req.query.details === 'true';
      const health = await this.performHealthCheck(includeDetails);
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Kubernetes liveness probe
    app.get('/health/live', async (req, res) => {
      const result = await this.livenessProbe();
      res.status(200).json(result);
    });

    // Kubernetes readiness probe
    app.get('/health/ready', async (req, res) => {
      const result = await this.readinessProbe();
      const statusCode = result.status === 'ready' ? 200 : 503;
      res.status(statusCode).json(result);
    });

    // Detailed system info (admin only)
    app.get('/health/system', async (req, res) => {
      try {
        const systemInfo = this.getSystemInfo();
        res.json({
          status: 'success',
          data: systemInfo,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message
        });
      }
    });

    this.logger.info('Health check routes registered');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      lastReset: Date.now()
    };

    this.logger.info('Health check metrics reset');
  }

  /**
   * Get health check statistics
   */
  getStats() {
    return {
      config: this.config,
      metrics: this.metrics,
      startTime: this.startTime,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

module.exports = HealthCheckService;