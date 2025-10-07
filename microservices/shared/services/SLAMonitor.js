/**
 * @fileoverview SLA Monitoring Service - Proactive performance and uptime alerting system
 * @version 1.0.0
 * @description Sistema completo de monitoramento SLA com alertas automáticos,
 * thresholds configuráveis e dashboards de uptime em tempo real
 */

const EventEmitter = require('events');

class SLAMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serviceName = options.serviceName || 'unknown';
    this.redisClient = options.redisClient;
    this.logService = options.logService;
    this.notificationService = options.notificationService;
    
    // SLA Configuration
    this.config = {
      // Response time thresholds (in milliseconds)
      responseTime: {
        excellent: options.responseTime?.excellent || 100,
        good: options.responseTime?.good || 300,
        acceptable: options.responseTime?.acceptable || 1000,
        slow: options.responseTime?.slow || 3000,
        critical: options.responseTime?.critical || 5000
      },
      
      // Error rate thresholds (percentage)
      errorRate: {
        warning: options.errorRate?.warning || 1,
        critical: options.errorRate?.critical || 5,
        severe: options.errorRate?.severe || 10
      },
      
      // Uptime thresholds (percentage)
      uptime: {
        target: options.uptime?.target || 99.9,
        warning: options.uptime?.warning || 99.5,
        critical: options.uptime?.critical || 99.0
      },
      
      // Monitoring intervals
      intervals: {
        healthCheck: options.intervals?.healthCheck || 30000, // 30 seconds
        slaCalculation: options.intervals?.slaCalculation || 300000, // 5 minutes
        alertCooldown: options.intervals?.alertCooldown || 900000, // 15 minutes
        reportGeneration: options.intervals?.reportGeneration || 3600000 // 1 hour
      },
      
      // Alert configuration
      alerts: {
        enabled: options.alerts?.enabled !== false,
        channels: options.alerts?.channels || ['email', 'slack', 'webhook'],
        escalation: options.alerts?.escalation !== false
      }
    };

    // Monitoring state
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        responseTimeSum: 0,
        responseTimeCount: 0
      },
      uptime: {
        startTime: Date.now(),
        totalDowntime: 0,
        currentStatus: 'up',
        lastDowntime: null,
        downtimeEvents: []
      },
      alerts: {
        active: new Map(),
        history: [],
        lastSent: new Map()
      },
      sla: {
        current: {
          uptime: 100,
          errorRate: 0,
          avgResponseTime: 0
        },
        daily: new Map(),
        monthly: new Map()
      }
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring intervals and event listeners
   */
  initializeMonitoring() {
    // Health check interval
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.intervals.healthCheck
    );

    // SLA calculation interval
    this.slaCalculationInterval = setInterval(
      () => this.calculateSLA(),
      this.config.intervals.slaCalculation
    );

    // Report generation interval
    this.reportInterval = setInterval(
      () => this.generatePeriodicReport(),
      this.config.intervals.reportGeneration
    );

    // Listen for application events
    this.setupEventListeners();

    if (this.logService) {
      this.logService.info('SLA Monitor initialized', {
        service: this.serviceName,
        config: this.config
      });
    }
  }

  /**
   * Setup event listeners for automatic monitoring
   */
  setupEventListeners() {
    // Listen for request completion events
    this.on('request_completed', (data) => {
      this.recordRequest(data.responseTime, data.statusCode, data.error);
    });

    // Listen for service health events
    this.on('health_check', (data) => {
      this.recordHealthCheck(data.status, data.responseTime);
    });

    // Listen for custom SLA events
    this.on('sla_violation', (violation) => {
      this.handleSLAViolation(violation);
    });
  }

  /**
   * Record a completed request for SLA tracking
   */
  recordRequest(responseTime, statusCode, error = null) {
    this.metrics.requests.total++;
    this.metrics.requests.responseTimeSum += responseTime;
    this.metrics.requests.responseTimeCount++;

    if (statusCode >= 200 && statusCode < 400 && !error) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Check for threshold violations
    this.checkResponseTimeThreshold(responseTime);
    this.checkErrorRateThreshold();

    // Store in Redis if available
    if (this.redisClient) {
      this.storeRequestMetric(responseTime, statusCode, error);
    }

    // Emit SLA event if violation detected
    const violation = this.detectViolation(responseTime, statusCode, error);
    if (violation) {
      this.emit('sla_violation', violation);
    }
  }

  /**
   * Record health check result
   */
  recordHealthCheck(status, responseTime) {
    const timestamp = Date.now();
    
    if (status === 'healthy') {
      if (this.metrics.uptime.currentStatus === 'down') {
        // Service came back up
        const downDuration = timestamp - this.metrics.uptime.lastDowntime;
        this.metrics.uptime.totalDowntime += downDuration;
        
        this.metrics.uptime.downtimeEvents.push({
          start: this.metrics.uptime.lastDowntime,
          end: timestamp,
          duration: downDuration
        });

        this.emit('service_recovered', {
          service: this.serviceName,
          downDuration,
          timestamp
        });

        if (this.logService) {
          this.logService.info('Service recovered', {
            service: this.serviceName,
            downtimeDuration: `${downDuration}ms`,
            timestamp
          });
        }
      }
      this.metrics.uptime.currentStatus = 'up';
    } else {
      if (this.metrics.uptime.currentStatus === 'up') {
        // Service went down
        this.metrics.uptime.lastDowntime = timestamp;
        
        this.emit('service_down', {
          service: this.serviceName,
          timestamp,
          reason: 'health_check_failed'
        });

        if (this.logService) {
          this.logService.error('Service went down', null, {
            service: this.serviceName,
            timestamp,
            healthCheckResponse: responseTime
          });
        }
      }
      this.metrics.uptime.currentStatus = 'down';
    }

    // Store health check data
    if (this.redisClient) {
      this.storeHealthCheckMetric(status, responseTime, timestamp);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      const startTime = Date.now();
      
      // Default health check - can be overridden
      const healthResult = await this.checkServiceHealth();
      const responseTime = Date.now() - startTime;
      
      this.emit('health_check', {
        status: healthResult.status,
        responseTime,
        details: healthResult.details
      });

      return healthResult;
    } catch (error) {
      this.emit('health_check', {
        status: 'unhealthy',
        responseTime: this.config.responseTime.critical + 1000,
        error: error.message
      });

      if (this.logService) {
        this.logService.error('Health check failed', error);
      }
    }
  }

  /**
   * Override this method for service-specific health checks
   */
  async checkServiceHealth() {
    // Default implementation - override in subclasses
    return {
      status: 'healthy',
      details: { message: 'Default health check passed' }
    };
  }

  /**
   * Check response time threshold violations
   */
  checkResponseTimeThreshold(responseTime) {
    let level = 'excellent';
    
    if (responseTime > this.config.responseTime.critical) {
      level = 'critical';
    } else if (responseTime > this.config.responseTime.slow) {
      level = 'slow';
    } else if (responseTime > this.config.responseTime.acceptable) {
      level = 'acceptable';
    } else if (responseTime > this.config.responseTime.good) {
      level = 'good';
    }

    if (level === 'critical' || level === 'slow') {
      this.triggerAlert('response_time', {
        level,
        responseTime,
        threshold: this.config.responseTime[level],
        service: this.serviceName
      });
    }
  }

  /**
   * Check error rate threshold violations
   */
  checkErrorRateThreshold() {
    if (this.metrics.requests.total === 0) return;

    const errorRate = (this.metrics.requests.failed / this.metrics.requests.total) * 100;
    
    let level = null;
    if (errorRate >= this.config.errorRate.severe) {
      level = 'severe';
    } else if (errorRate >= this.config.errorRate.critical) {
      level = 'critical';
    } else if (errorRate >= this.config.errorRate.warning) {
      level = 'warning';
    }

    if (level) {
      this.triggerAlert('error_rate', {
        level,
        errorRate,
        threshold: this.config.errorRate[level],
        service: this.serviceName,
        totalRequests: this.metrics.requests.total,
        failedRequests: this.metrics.requests.failed
      });
    }
  }

  /**
   * Detect SLA violations
   */
  detectViolation(responseTime, statusCode, error) {
    const violations = [];

    // Response time violation
    if (responseTime > this.config.responseTime.critical) {
      violations.push({
        type: 'response_time',
        severity: 'critical',
        value: responseTime,
        threshold: this.config.responseTime.critical,
        message: `Response time ${responseTime}ms exceeds critical threshold`
      });
    }

    // Error violation
    if (statusCode >= 500 || error) {
      violations.push({
        type: 'error',
        severity: 'high',
        statusCode,
        error: error?.message,
        message: `Server error detected: ${statusCode}`
      });
    }

    return violations.length > 0 ? violations : null;
  }

  /**
   * Calculate current SLA metrics
   */
  calculateSLA() {
    const currentTime = Date.now();
    const totalRuntime = currentTime - this.metrics.uptime.startTime;
    
    // Calculate uptime percentage
    const uptime = ((totalRuntime - this.metrics.uptime.totalDowntime) / totalRuntime) * 100;
    
    // Calculate average response time
    const avgResponseTime = this.metrics.requests.responseTimeCount > 0
      ? this.metrics.requests.responseTimeSum / this.metrics.requests.responseTimeCount
      : 0;
    
    // Calculate error rate
    const errorRate = this.metrics.requests.total > 0
      ? (this.metrics.requests.failed / this.metrics.requests.total) * 100
      : 0;

    // Update current SLA
    this.metrics.sla.current = {
      uptime: Math.max(0, Math.min(100, uptime)),
      errorRate,
      avgResponseTime
    };

    // Store daily SLA
    const today = new Date().toISOString().split('T')[0];
    this.metrics.sla.daily.set(today, { ...this.metrics.sla.current });

    // Check SLA thresholds
    this.checkSLAThresholds();

    // Store in Redis
    if (this.redisClient) {
      this.storeSLAMetrics();
    }

    if (this.logService) {
      this.logService.info('SLA metrics calculated', {
        service: this.serviceName,
        sla: this.metrics.sla.current
      });
    }

    return this.metrics.sla.current;
  }

  /**
   * Check SLA threshold violations
   */
  checkSLAThresholds() {
    const { uptime, errorRate } = this.metrics.sla.current;

    // Check uptime thresholds
    if (uptime < this.config.uptime.critical) {
      this.triggerAlert('uptime', {
        level: 'critical',
        uptime,
        threshold: this.config.uptime.critical,
        service: this.serviceName
      });
    } else if (uptime < this.config.uptime.warning) {
      this.triggerAlert('uptime', {
        level: 'warning',
        uptime,
        threshold: this.config.uptime.warning,
        service: this.serviceName
      });
    }

    // Error rate thresholds already checked in checkErrorRateThreshold
  }

  /**
   * Trigger alert with cooldown logic
   */
  async triggerAlert(type, data) {
    if (!this.config.alerts.enabled) return;

    const alertKey = `${type}_${data.level}`;
    const now = Date.now();
    const lastSent = this.metrics.alerts.lastSent.get(alertKey) || 0;
    
    // Check cooldown period
    if (now - lastSent < this.config.intervals.alertCooldown) {
      return; // Still in cooldown
    }

    const alert = {
      id: `${alertKey}_${now}`,
      type,
      level: data.level,
      service: this.serviceName,
      data,
      timestamp: now,
      status: 'active'
    };

    // Store alert
    this.metrics.alerts.active.set(alert.id, alert);
    this.metrics.alerts.history.push(alert);
    this.metrics.alerts.lastSent.set(alertKey, now);

    // Send notifications
    if (this.notificationService) {
      await this.notificationService.sendAlert(alert);
    }

    // Emit alert event
    this.emit('alert_triggered', alert);

    if (this.logService) {
      this.logService.warn('SLA alert triggered', alert);
    }

    // Store in Redis
    if (this.redisClient) {
      await this.storeAlert(alert);
    }
  }

  /**
   * Resolve an active alert
   */
  resolveAlert(alertId, resolution = 'auto_resolved') {
    const alert = this.metrics.alerts.active.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.resolution = resolution;
      
      this.metrics.alerts.active.delete(alertId);
      
      this.emit('alert_resolved', alert);
      
      if (this.logService) {
        this.logService.info('SLA alert resolved', alert);
      }
    }
  }

  /**
   * Generate periodic report
   */
  async generatePeriodicReport() {
    const report = {
      service: this.serviceName,
      period: '1h',
      generatedAt: new Date().toISOString(),
      sla: this.metrics.sla.current,
      requests: {
        total: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        successRate: this.metrics.requests.total > 0 
          ? (this.metrics.requests.successful / this.metrics.requests.total) * 100 
          : 0
      },
      uptime: {
        percentage: this.metrics.sla.current.uptime,
        totalDowntime: this.metrics.uptime.totalDowntime,
        downtimeEvents: this.metrics.uptime.downtimeEvents.length
      },
      alerts: {
        active: this.metrics.alerts.active.size,
        total: this.metrics.alerts.history.length
      }
    };

    this.emit('report_generated', report);
    
    if (this.logService) {
      this.logService.info('SLA report generated', report);
    }

    return report;
  }

  /**
   * Get SLA dashboard data
   */
  getDashboardData() {
    return {
      service: this.serviceName,
      status: this.metrics.uptime.currentStatus,
      sla: this.metrics.sla.current,
      requests: this.metrics.requests,
      uptime: {
        percentage: this.metrics.sla.current.uptime,
        startTime: this.metrics.uptime.startTime,
        totalDowntime: this.metrics.uptime.totalDowntime,
        currentStatus: this.metrics.uptime.currentStatus,
        downtimeEvents: this.metrics.uptime.downtimeEvents
      },
      alerts: {
        active: Array.from(this.metrics.alerts.active.values()),
        recent: this.metrics.alerts.history.slice(-10)
      },
      thresholds: this.config
    };
  }

  /**
   * Store request metric in Redis
   */
  async storeRequestMetric(responseTime, statusCode, error) {
    if (!this.redisClient) return;

    try {
      const key = `sla:requests:${this.serviceName}`;
      const data = {
        responseTime,
        statusCode,
        error: error?.message,
        timestamp: Date.now()
      };

      await this.redisClient.lpush(key, JSON.stringify(data));
      await this.redisClient.ltrim(key, 0, 999); // Keep last 1000 requests
    } catch (error) {
      console.error('Failed to store request metric:', error);
    }
  }

  /**
   * Store SLA metrics in Redis
   */
  async storeSLAMetrics() {
    if (!this.redisClient) return;

    try {
      const key = `sla:metrics:${this.serviceName}`;
      await this.redisClient.hset(key, {
        uptime: this.metrics.sla.current.uptime,
        errorRate: this.metrics.sla.current.errorRate,
        avgResponseTime: this.metrics.sla.current.avgResponseTime,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Failed to store SLA metrics:', error);
    }
  }

  /**
   * Store alert in Redis
   */
  async storeAlert(alert) {
    if (!this.redisClient) return;

    try {
      const key = `sla:alerts:${this.serviceName}`;
      await this.redisClient.lpush(key, JSON.stringify(alert));
      await this.redisClient.ltrim(key, 0, 99); // Keep last 100 alerts
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  /**
   * Store health check metric in Redis
   */
  async storeHealthCheckMetric(status, responseTime, timestamp) {
    if (!this.redisClient) return;

    try {
      const key = `sla:health:${this.serviceName}`;
      const data = { status, responseTime, timestamp };
      
      await this.redisClient.lpush(key, JSON.stringify(data));
      await this.redisClient.ltrim(key, 0, 287); // Keep ~24 hours of 5-min checks
    } catch (error) {
      console.error('Failed to store health check metric:', error);
    }
  }

  /**
   * Cleanup and shutdown monitoring
   */
  shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.slaCalculationInterval) {
      clearInterval(this.slaCalculationInterval);
    }
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    if (this.logService) {
      this.logService.info('SLA Monitor shutdown', {
        service: this.serviceName
      });
    }
  }
}

module.exports = SLAMonitor;