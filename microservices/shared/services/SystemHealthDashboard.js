/**
 * @fileoverview System Health Dashboard Service - Consolidated monitoring for all microservices
 * @version 1.0.0
 * @description Sistema consolidado de monitoramento de saúde para todos os microserviços
 * com métricas unificadas, status aggregado e visibilidade total do sistema
 */

const EventEmitter = require('events');
const axios = require('axios');

class SystemHealthDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    this.services = new Map();
    this.config = {
      // Refresh intervals
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      metricsUpdateInterval: options.metricsUpdateInterval || 60000, // 1 minute
      
      // Service configuration
      services: options.services || {},
      
      // Health check configuration
      timeout: options.timeout || 10000, // 10 seconds
      retries: options.retries || 3,
      
      // Status aggregation rules
      criticalThreshold: options.criticalThreshold || 0.5, // 50% services down = critical
      warningThreshold: options.warningThreshold || 0.2,   // 20% services degraded = warning
      
      // Data retention
      historyRetention: options.historyRetention || 24 * 60 * 60 * 1000, // 24 hours
      maxHistoryPoints: options.maxHistoryPoints || 1440 // 1 point per minute for 24h
    };

    this.systemMetrics = {
      overallStatus: 'unknown',
      healthyServices: 0,
      totalServices: 0,
      uptime: 0,
      lastUpdate: null,
      alerts: [],
      history: []
    };

    this.logService = options.logService;
    this.redisClient = options.redisClient;
    
    this.initializeServices();
    this.startMonitoring();
  }

  /**
   * Initialize service configurations
   */
  initializeServices() {
    const defaultServices = {
      'api-gateway': {
        name: 'API Gateway',
        url: process.env.GATEWAY_URL || 'http://localhost:3000',
        critical: true,
        category: 'core'
      },
      'auth-service': {
        name: 'Authentication Service',
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        critical: true,
        category: 'core'
      },
      'product-service': {
        name: 'Product Service',
        url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
        critical: false,
        category: 'business'
      },
      'bling-service': {
        name: 'Bling Integration',
        url: process.env.BLING_SERVICE_URL || 'http://localhost:3003',
        critical: false,
        category: 'integration'
      },
      'billing-service': {
        name: 'Billing Service',
        url: process.env.BILLING_SERVICE_URL || 'http://localhost:3004',
        critical: false,
        category: 'business'
      }
    };

    // Merge default services with provided configuration
    const servicesConfig = { ...defaultServices, ...this.config.services };

    Object.entries(servicesConfig).forEach(([serviceId, config]) => {
      this.services.set(serviceId, {
        id: serviceId,
        name: config.name,
        url: config.url,
        critical: config.critical || false,
        category: config.category || 'other',
        status: 'unknown',
        health: {
          status: 'unknown',
          responseTime: null,
          lastCheck: null,
          error: null,
          uptime: 0,
          checks: {}
        },
        metrics: {
          requests: { total: 0, successful: 0, failed: 0 },
          responseTime: { avg: 0, p95: 0, p99: 0 },
          errorRate: 0,
          uptime: 100
        },
        sla: {
          uptime: 100,
          responseTime: 0,
          errorRate: 0
        },
        history: []
      });
    });

    if (this.logService) {
      this.logService.info('System Health Dashboard initialized', {
        totalServices: this.services.size,
        criticalServices: Array.from(this.services.values()).filter(s => s.critical).length
      });
    }
  }

  /**
   * Start monitoring all services
   */
  startMonitoring() {
    // Health check interval
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckInterval
    );

    // Metrics update interval
    this.metricsInterval = setInterval(
      () => this.updateMetrics(),
      this.config.metricsUpdateInterval
    );

    // Initial checks
    this.performHealthChecks();
    this.updateMetrics();

    if (this.logService) {
      this.logService.info('System monitoring started', {
        healthCheckInterval: this.config.healthCheckInterval,
        metricsUpdateInterval: this.config.metricsUpdateInterval
      });
    }
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks() {
    const checkPromises = Array.from(this.services.keys()).map(serviceId => 
      this.checkServiceHealth(serviceId)
    );

    try {
      await Promise.allSettled(checkPromises);
      this.calculateOverallStatus();
      this.updateHistory();
      
      // Store in Redis if available
      if (this.redisClient) {
        await this.storeHealthData();
      }

      this.emit('health_check_completed', this.getSystemStatus());

    } catch (error) {
      if (this.logService) {
        this.logService.error('Health check batch failed', error);
      }
    }
  }

  /**
   * Check health of individual service
   */
  async checkServiceHealth(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return;

    const startTime = Date.now();
    
    try {
      // Try multiple health endpoints
      const healthEndpoints = [
        `${service.url}/health`,
        `${service.url}/health/ready`,
        `${service.url}/api/health`,
        `${service.url}/status`
      ];

      let response = null;
      let healthData = null;

      for (const endpoint of healthEndpoints) {
        try {
          response = await axios.get(endpoint, {
            timeout: this.config.timeout,
            validateStatus: () => true // Accept any status code
          });
          
          if (response.status === 200) {
            healthData = response.data;
            break;
          }
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }

      const responseTime = Date.now() - startTime;

      if (response && response.status === 200) {
        // Service is healthy
        service.health = {
          status: 'healthy',
          responseTime,
          lastCheck: Date.now(),
          error: null,
          uptime: service.health.uptime,
          checks: healthData?.checks || {},
          data: healthData
        };
        service.status = 'healthy';

        // Update uptime (simple increment for healthy checks)
        service.health.uptime = Math.min(100, service.health.uptime + 0.1);

      } else {
        // Service is unhealthy
        service.health = {
          status: 'unhealthy',
          responseTime,
          lastCheck: Date.now(),
          error: `HTTP ${response?.status || 'No Response'}`,
          uptime: Math.max(0, service.health.uptime - 1),
          checks: {},
          data: response?.data
        };
        service.status = 'unhealthy';
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      service.health = {
        status: 'unhealthy',
        responseTime,
        lastCheck: Date.now(),
        error: error.message,
        uptime: Math.max(0, service.health.uptime - 1),
        checks: {}
      };
      service.status = 'unhealthy';

      if (this.logService) {
        this.logService.warn('Service health check failed', {
          serviceId,
          serviceName: service.name,
          error: error.message,
          responseTime
        });
      }
    }

    // Emit service-specific event
    this.emit('service_health_updated', {
      serviceId,
      service: service,
      status: service.status
    });
  }

  /**
   * Update service metrics from various sources
   */
  async updateMetrics() {
    for (const [serviceId, service] of this.services.entries()) {
      try {
        // Try to get metrics from service
        const metricsData = await this.getServiceMetrics(serviceId);
        if (metricsData) {
          service.metrics = { ...service.metrics, ...metricsData };
        }

        // Try to get SLA data from service
        const slaData = await this.getServiceSLA(serviceId);
        if (slaData) {
          service.sla = { ...service.sla, ...slaData };
        }

      } catch (error) {
        if (this.logService) {
          this.logService.debug('Failed to update metrics for service', {
            serviceId,
            error: error.message
          });
        }
      }
    }

    this.emit('metrics_updated', this.getSystemMetrics());
  }

  /**
   * Get metrics from individual service
   */
  async getServiceMetrics(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || service.status !== 'healthy') return null;

    try {
      const response = await axios.get(`${service.url}/api/shared/logs/dashboard`, {
        timeout: 5000
      });

      if (response.status === 200 && response.data.requests) {
        return {
          requests: response.data.requests,
          responseTime: {
            avg: response.data.requests.averageResponseTime || 0,
            p95: response.data.requests.p95ResponseTime || 0,
            p99: response.data.requests.p99ResponseTime || 0
          },
          errorRate: response.data.requests.errorRate || 0
        };
      }
    } catch (error) {
      // Metrics not available, not critical
    }

    return null;
  }

  /**
   * Get SLA data from individual service
   */
  async getServiceSLA(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || service.status !== 'healthy') return null;

    try {
      const response = await axios.get(`${service.url}/api/shared/sla/metrics`, {
        timeout: 5000
      });

      if (response.status === 200 && response.data.metrics) {
        return response.data.metrics;
      }
    } catch (error) {
      // SLA data not available, not critical
    }

    return null;
  }

  /**
   * Calculate overall system status
   */
  calculateOverallStatus() {
    const services = Array.from(this.services.values());
    const totalServices = services.length;
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const criticalServices = services.filter(s => s.critical);
    const healthyCriticalServices = criticalServices.filter(s => s.status === 'healthy').length;

    let overallStatus = 'healthy';

    // If any critical service is down, system is critical
    if (healthyCriticalServices < criticalServices.length) {
      overallStatus = 'critical';
    }
    // If too many services are down, system is critical
    else if (healthyServices / totalServices < this.config.criticalThreshold) {
      overallStatus = 'critical';
    }
    // If some services are down, system is degraded
    else if (healthyServices / totalServices < (1 - this.config.warningThreshold)) {
      overallStatus = 'degraded';
    }

    this.systemMetrics = {
      overallStatus,
      healthyServices,
      totalServices,
      uptime: totalServices > 0 ? (healthyServices / totalServices) * 100 : 0,
      lastUpdate: Date.now(),
      alerts: this.generateSystemAlerts(),
      history: this.systemMetrics.history
    };

    // Emit status change event if status changed
    if (this.systemMetrics.overallStatus !== overallStatus) {
      this.emit('system_status_changed', {
        oldStatus: this.systemMetrics.overallStatus,
        newStatus: overallStatus,
        healthyServices,
        totalServices
      });

      if (this.logService) {
        this.logService.info('System status changed', {
          oldStatus: this.systemMetrics.overallStatus,
          newStatus: overallStatus,
          healthyServices,
          totalServices
        });
      }
    }
  }

  /**
   * Generate system-level alerts
   */
  generateSystemAlerts() {
    const alerts = [];
    const services = Array.from(this.services.values());
    
    // Critical services down
    const downCriticalServices = services.filter(s => s.critical && s.status !== 'healthy');
    downCriticalServices.forEach(service => {
      alerts.push({
        id: `critical_service_down_${service.id}`,
        type: 'critical_service_down',
        severity: 'critical',
        service: service.name,
        message: `Critical service ${service.name} is down`,
        timestamp: Date.now()
      });
    });

    // High error rates
    services.forEach(service => {
      if (service.metrics.errorRate > 10) {
        alerts.push({
          id: `high_error_rate_${service.id}`,
          type: 'high_error_rate',
          severity: 'warning',
          service: service.name,
          message: `High error rate detected: ${service.metrics.errorRate.toFixed(2)}%`,
          timestamp: Date.now()
        });
      }
    });

    // Slow response times
    services.forEach(service => {
      if (service.health.responseTime > 5000) {
        alerts.push({
          id: `slow_response_${service.id}`,
          type: 'slow_response',
          severity: 'warning',
          service: service.name,
          message: `Slow response time: ${service.health.responseTime}ms`,
          timestamp: Date.now()
        });
      }
    });

    return alerts;
  }

  /**
   * Update system history
   */
  updateHistory() {
    const historyPoint = {
      timestamp: Date.now(),
      overallStatus: this.systemMetrics.overallStatus,
      healthyServices: this.systemMetrics.healthyServices,
      totalServices: this.systemMetrics.totalServices,
      uptime: this.systemMetrics.uptime,
      services: Array.from(this.services.entries()).map(([id, service]) => ({
        id,
        name: service.name,
        status: service.status,
        responseTime: service.health.responseTime,
        uptime: service.health.uptime
      }))
    };

    this.systemMetrics.history.push(historyPoint);

    // Limit history size
    if (this.systemMetrics.history.length > this.config.maxHistoryPoints) {
      this.systemMetrics.history = this.systemMetrics.history.slice(-this.config.maxHistoryPoints);
    }

    // Remove old history entries
    const cutoffTime = Date.now() - this.config.historyRetention;
    this.systemMetrics.history = this.systemMetrics.history.filter(
      point => point.timestamp > cutoffTime
    );
  }

  /**
   * Get complete system status
   */
  getSystemStatus() {
    return {
      system: this.systemMetrics,
      services: Object.fromEntries(
        Array.from(this.services.entries()).map(([id, service]) => [
          id,
          {
            id: service.id,
            name: service.name,
            status: service.status,
            critical: service.critical,
            category: service.category,
            health: service.health,
            metrics: service.metrics,
            sla: service.sla
          }
        ])
      ),
      timestamp: Date.now()
    };
  }

  /**
   * Get system metrics summary
   */
  getSystemMetrics() {
    const services = Array.from(this.services.values());
    
    return {
      overview: this.systemMetrics,
      categories: this.getServicesByCategory(),
      performance: {
        avgResponseTime: this.calculateAverageResponseTime(),
        totalRequests: this.calculateTotalRequests(),
        overallErrorRate: this.calculateOverallErrorRate(),
        systemUptime: this.calculateSystemUptime()
      },
      trends: this.calculateTrends(),
      alerts: this.systemMetrics.alerts
    };
  }

  /**
   * Get services grouped by category
   */
  getServicesByCategory() {
    const categories = {};
    
    for (const service of this.services.values()) {
      if (!categories[service.category]) {
        categories[service.category] = [];
      }
      categories[service.category].push({
        id: service.id,
        name: service.name,
        status: service.status,
        critical: service.critical,
        health: service.health,
        metrics: service.metrics
      });
    }
    
    return categories;
  }

  /**
   * Calculate average response time across all services
   */
  calculateAverageResponseTime() {
    const healthyServices = Array.from(this.services.values())
      .filter(s => s.status === 'healthy' && s.health.responseTime);
    
    if (healthyServices.length === 0) return 0;
    
    const totalResponseTime = healthyServices.reduce(
      (sum, service) => sum + service.health.responseTime, 0
    );
    
    return Math.round(totalResponseTime / healthyServices.length);
  }

  /**
   * Calculate total requests across all services
   */
  calculateTotalRequests() {
    return Array.from(this.services.values()).reduce(
      (total, service) => total + (service.metrics.requests.total || 0), 0
    );
  }

  /**
   * Calculate overall error rate
   */
  calculateOverallErrorRate() {
    const services = Array.from(this.services.values());
    const totalRequests = services.reduce(
      (sum, s) => sum + (s.metrics.requests.total || 0), 0
    );
    const totalErrors = services.reduce(
      (sum, s) => sum + (s.metrics.requests.failed || 0), 0
    );
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  /**
   * Calculate system uptime percentage
   */
  calculateSystemUptime() {
    if (this.systemMetrics.history.length < 2) return 100;
    
    const recentHistory = this.systemMetrics.history.slice(-60); // Last hour
    const healthyPoints = recentHistory.filter(point => point.overallStatus === 'healthy').length;
    
    return (healthyPoints / recentHistory.length) * 100;
  }

  /**
   * Calculate performance trends
   */
  calculateTrends() {
    if (this.systemMetrics.history.length < 10) return null;
    
    const recent = this.systemMetrics.history.slice(-10);
    const older = this.systemMetrics.history.slice(-20, -10);
    
    const recentAvgUptime = recent.reduce((sum, p) => sum + p.uptime, 0) / recent.length;
    const olderAvgUptime = older.reduce((sum, p) => sum + p.uptime, 0) / older.length;
    
    return {
      uptime: recentAvgUptime - olderAvgUptime,
      direction: recentAvgUptime > olderAvgUptime ? 'improving' : 'degrading'
    };
  }

  /**
   * Store health data in Redis
   */
  async storeHealthData() {
    if (!this.redisClient) return;

    try {
      const key = 'system:health:dashboard';
      const data = this.getSystemStatus();
      
      await this.redisClient.setex(key, 300, JSON.stringify(data)); // 5 minute TTL
      
      // Store metrics history
      const historyKey = 'system:health:history';
      const historyData = this.systemMetrics.history.slice(-100); // Last 100 points
      await this.redisClient.setex(historyKey, 3600, JSON.stringify(historyData)); // 1 hour TTL
      
    } catch (error) {
      console.error('Failed to store health data in Redis:', error);
    }
  }

  /**
   * Get service details by ID
   */
  getServiceDetails(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return null;
    
    return {
      ...service,
      history: service.history || []
    };
  }

  /**
   * Manually trigger health check for specific service
   */
  async checkSpecificService(serviceId) {
    if (!this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} not found`);
    }
    
    await this.checkServiceHealth(serviceId);
    this.calculateOverallStatus();
    
    return this.getServiceDetails(serviceId);
  }

  /**
   * Get system health report
   */
  generateHealthReport() {
    const systemStatus = this.getSystemStatus();
    const systemMetrics = this.getSystemMetrics();
    
    return {
      reportId: `health_report_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      summary: {
        overallStatus: systemStatus.system.overallStatus,
        healthyServices: systemStatus.system.healthyServices,
        totalServices: systemStatus.system.totalServices,
        systemUptime: systemMetrics.performance.systemUptime,
        activeAlerts: systemStatus.system.alerts.length
      },
      services: systemStatus.services,
      performance: systemMetrics.performance,
      alerts: systemStatus.system.alerts,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate system recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const services = Array.from(this.services.values());
    
    // Services with poor health
    services.forEach(service => {
      if (service.health.uptime < 95) {
        recommendations.push({
          type: 'service_health',
          severity: 'high',
          service: service.name,
          message: `Service ${service.name} has low uptime (${service.health.uptime.toFixed(1)}%)`,
          action: 'Investigate service stability and resource allocation'
        });
      }
      
      if (service.health.responseTime > 3000) {
        recommendations.push({
          type: 'performance',
          severity: 'medium',
          service: service.name,
          message: `Service ${service.name} has high response times (${service.health.responseTime}ms)`,
          action: 'Optimize service performance or scale resources'
        });
      }
      
      if (service.metrics.errorRate > 5) {
        recommendations.push({
          type: 'reliability',
          severity: 'high',
          service: service.name,
          message: `Service ${service.name} has high error rate (${service.metrics.errorRate.toFixed(2)}%)`,
          action: 'Review service logs and fix error patterns'
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Shutdown monitoring
   */
  shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.logService) {
      this.logService.info('System Health Dashboard shutdown');
    }
  }
}

module.exports = SystemHealthDashboard;