/**
 * Shared Health Check Utilities
 * Common health check functions for all microservices
 */

const os = require('os');

class HealthChecker {
  constructor() {
    this.startTime = new Date();
    this.checks = new Map();
    this.dependencies = new Map();
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical !== false,
      interval: options.interval || 30000
    });
  }

  /**
   * Register a dependency check (database, redis, external API)
   */
  registerDependency(name, checkFunction, options = {}) {
    this.dependencies.set(name, {
      fn: checkFunction,
      timeout: options.timeout || 10000,
      critical: options.critical !== false,
      retries: options.retries || 2
    });
  }

  /**
   * Run all health checks
   */
  async checkHealth() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      service: process.env.SERVICE_NAME || 'unknown',
      checks: {},
      dependencies: {},
      system: this.getSystemInfo()
    };

    // Run basic checks
    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await this.runWithTimeout(check.fn, check.timeout);
        const duration = Date.now() - startTime;

        results.checks[name] = {
          status: 'healthy',
          duration: `${duration}ms`,
          details: result
        };
      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message,
          critical: check.critical
        };

        if (check.critical) {
          results.status = 'unhealthy';
        }
      }
    }

    // Run dependency checks
    for (const [name, dependency] of this.dependencies) {
      try {
        const startTime = Date.now();
        const result = await this.runWithRetries(
          () => this.runWithTimeout(dependency.fn, dependency.timeout),
          dependency.retries
        );
        const duration = Date.now() - startTime;

        results.dependencies[name] = {
          status: 'available',
          duration: `${duration}ms`,
          details: result
        };
      } catch (error) {
        results.dependencies[name] = {
          status: 'unavailable',
          error: error.message,
          critical: dependency.critical
        };

        if (dependency.critical) {
          results.status = 'unhealthy';
        }
      }
    }

    return results;
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown'
      },
      memory: {
        total: this.formatBytes(totalMem),
        used: this.formatBytes(usedMem),
        free: this.formatBytes(freeMem),
        usage: `${Math.round((usedMem / totalMem) * 100)}%`,
        process: {
          rss: this.formatBytes(memUsage.rss),
          heapTotal: this.formatBytes(memUsage.heapTotal),
          heapUsed: this.formatBytes(memUsage.heapUsed),
          external: this.formatBytes(memUsage.external)
        }
      },
      load: {
        average: os.loadavg(),
        uptime: this.formatUptime(os.uptime())
      }
    };
  }

  /**
   * Get service uptime
   */
  getUptime() {
    const uptimeMs = Date.now() - this.startTime.getTime();
    return this.formatUptime(uptimeMs / 1000);
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format uptime to human readable
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Run function with timeout
   */
  async runWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Run function with retries
   */
  async runWithRetries(fn, retries) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Create middleware for Express
   */
  middleware() {
    return async (req, res) => {
      try {
        const health = await this.checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    };
  }

  /**
   * Create readiness probe
   */
  readinessProbe() {
    return async (req, res) => {
      try {
        // Only check critical dependencies for readiness
        const criticalChecks = {};
        
        for (const [name, dependency] of this.dependencies) {
          if (dependency.critical) {
            try {
              await this.runWithTimeout(dependency.fn, dependency.timeout);
              criticalChecks[name] = 'ready';
            } catch (error) {
              criticalChecks[name] = 'not_ready';
              return res.status(503).json({
                status: 'not_ready',
                timestamp: new Date().toISOString(),
                checks: criticalChecks,
                error: `Critical dependency ${name} is not ready`
              });
            }
          }
        }

        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          checks: criticalChecks
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    };
  }

  /**
   * Create liveness probe
   */
  livenessProbe() {
    return (req, res) => {
      // Simple liveness check - just verify the process is running
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        pid: process.pid
      });
    };
  }
}

// Common health check functions
const commonChecks = {
  /**
   * Database connection check
   */
  database: (knex) => async () => {
    const result = await knex.raw('SELECT 1+1 as result');
    return {
      connected: true,
      result: result.rows?.[0]?.result || result[0]?.result
    };
  },

  /**
   * Redis connection check
   */
  redis: (client) => async () => {
    const result = await client.ping();
    return {
      connected: true,
      response: result
    };
  },

  /**
   * HTTP service check
   */
  httpService: (url, options = {}) => async () => {
    const axios = require('axios');
    const response = await axios.get(url, {
      timeout: options.timeout || 5000,
      ...options
    });
    
    return {
      status: response.status,
      responseTime: response.headers['x-response-time'] || 'unknown'
    };
  },

  /**
   * Disk space check
   */
  diskSpace: (threshold = 0.9) => async () => {
    const fs = require('fs').promises;
    const stats = await fs.statfs(process.cwd());
    
    const total = stats.blocks * stats.blksize;
    const free = stats.bavail * stats.blksize;
    const used = total - free;
    const usage = used / total;

    if (usage > threshold) {
      throw new Error(`Disk usage ${Math.round(usage * 100)}% exceeds threshold ${Math.round(threshold * 100)}%`);
    }

    return {
      total: total,
      used: used,
      free: free,
      usage: `${Math.round(usage * 100)}%`
    };
  },

  /**
   * Memory usage check
   */
  memory: (threshold = 0.9) => () => {
    const memUsage = process.memoryUsage();
    const heapUsage = memUsage.heapUsed / memUsage.heapTotal;

    if (heapUsage > threshold) {
      throw new Error(`Heap usage ${Math.round(heapUsage * 100)}% exceeds threshold ${Math.round(threshold * 100)}%`);
    }

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      usage: `${Math.round(heapUsage * 100)}%`,
      rss: memUsage.rss,
      external: memUsage.external
    };
  },

  /**
   * Environment variables check
   */
  environment: (requiredVars = []) => () => {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
      required: requiredVars.length,
      present: requiredVars.length - missing.length,
      nodeEnv: process.env.NODE_ENV
    };
  }
};

module.exports = {
  HealthChecker,
  commonChecks
};