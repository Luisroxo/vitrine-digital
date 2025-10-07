/**
 * @fileoverview Log Management Service - Centralized logging and visualization system
 * @version 1.0.0
 * @description Sistema completo de logging com dashboards, métricas em tempo real
 * e análise avançada para observabilidade total dos microserviços
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

class LogService {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unknown';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logDirectory = options.logDirectory || path.join(process.cwd(), 'logs');
    this.elasticsearchHost = process.env.ELASTICSEARCH_HOST;
    this.redisClient = options.redisClient;
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      lastActivity: new Date()
    };

    this.initializeLogger();
    this.ensureLogDirectory();
  }

  /**
   * Initialize Winston logger with multiple transports
   */
  initializeLogger() {
    const transports = [
      // Console transport with colors
      new winston.transports.Console({
        level: this.logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${service || this.serviceName}] ${level}: ${message} ${metaStr}`;
          })
        )
      }),

      // File transport for all logs
      new winston.transports.File({
        filename: path.join(this.logDirectory, 'combined.log'),
        level: 'debug',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10
      }),

      // Error-specific file
      new winston.transports.File({
        filename: path.join(this.logDirectory, 'errors.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5
      }),

      // Daily rotation for main logs
      new winston.transports.DailyRotateFile({
        filename: path.join(this.logDirectory, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ];

    // Add Elasticsearch transport if available
    if (this.elasticsearchHost) {
      transports.push(new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: this.elasticsearchHost
        },
        index: `logs-${this.serviceName}`,
        transformer: (logData) => ({
          '@timestamp': logData.timestamp,
          severity: logData.level,
          message: logData.message,
          service: this.serviceName,
          ...logData.meta
        })
      }));
    }

    this.logger = winston.createLogger({
      level: this.logLevel,
      defaultMeta: {
        service: this.serviceName,
        environment: process.env.NODE_ENV || 'development'
      },
      transports
    });

    // Add error handling
    this.logger.on('error', (error) => {
      console.error('Logger error:', error);
    });
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Enhanced logging methods with metrics tracking
   */
  async log(level, message, metadata = {}) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      pid: process.pid,
      memory: process.memoryUsage(),
      ...metadata
    };

    this.logger.log(level, message, logEntry);
    
    // Update metrics
    this.updateMetrics(level);
    
    // Store in Redis for real-time dashboard
    if (this.redisClient) {
      await this.storeInRedis(logEntry);
    }

    return logEntry;
  }

  async info(message, metadata = {}) {
    return this.log('info', message, metadata);
  }

  async error(message, error = null, metadata = {}) {
    const errorData = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : {};
    
    return this.log('error', message, { ...metadata, ...errorData });
  }

  async warn(message, metadata = {}) {
    return this.log('warn', message, metadata);
  }

  async debug(message, metadata = {}) {
    return this.log('debug', message, metadata);
  }

  /**
   * Specialized logging methods for common scenarios
   */
  async logAPIRequest(req, res, responseTime) {
    const logData = {
      type: 'api_request',
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      requestId: req.id
    };

    return this.info('API Request', logData);
  }

  async logDatabaseQuery(query, duration, results = null) {
    const logData = {
      type: 'database_query',
      query: query.toString(),
      duration: `${duration}ms`,
      resultCount: results?.length || 0,
      timestamp: new Date().toISOString()
    };

    return this.debug('Database Query', logData);
  }

  async logBusinessEvent(eventName, eventData = {}) {
    const logData = {
      type: 'business_event',
      event: eventName,
      data: eventData,
      timestamp: new Date().toISOString()
    };

    return this.info(`Business Event: ${eventName}`, logData);
  }

  async logPerformanceMetric(metricName, value, unit = 'ms') {
    const logData = {
      type: 'performance_metric',
      metric: metricName,
      value,
      unit,
      timestamp: new Date().toISOString()
    };

    return this.info(`Performance Metric: ${metricName}`, logData);
  }

  async logSecurityEvent(eventType, details = {}) {
    const logData = {
      type: 'security_event',
      event: eventType,
      severity: 'high',
      details,
      timestamp: new Date().toISOString()
    };

    return this.warn(`Security Event: ${eventType}`, logData);
  }

  /**
   * Store logs in Redis for real-time dashboard
   */
  async storeInRedis(logEntry) {
    if (!this.redisClient) return;

    try {
      const key = `logs:${this.serviceName}:recent`;
      
      // Store recent logs (last 100)
      await this.redisClient.lpush(key, JSON.stringify(logEntry));
      await this.redisClient.ltrim(key, 0, 99);
      
      // Store metrics by hour
      const hourKey = `logs:metrics:${this.serviceName}:${new Date().getHours()}`;
      await this.redisClient.hincrby(hourKey, logEntry.level, 1);
      await this.redisClient.expire(hourKey, 86400); // 24 hours

      // Store daily stats
      const dateKey = `logs:daily:${this.serviceName}:${new Date().toISOString().split('T')[0]}`;
      await this.redisClient.hincrby(dateKey, logEntry.level, 1);
      await this.redisClient.expire(dateKey, 2592000); // 30 days

    } catch (error) {
      console.error('Failed to store log in Redis:', error);
    }
  }

  /**
   * Update internal metrics
   */
  updateMetrics(level) {
    this.metrics.totalLogs++;
    this.metrics.lastActivity = new Date();

    switch (level) {
      case 'error':
        this.metrics.errorCount++;
        break;
      case 'warn':
        this.metrics.warningCount++;
        break;
      case 'info':
        this.metrics.infoCount++;
        break;
      case 'debug':
        this.metrics.debugCount++;
        break;
    }
  }

  /**
   * Dashboard data methods
   */
  async getDashboardData() {
    const recentLogs = await this.getRecentLogs(50);
    const hourlyStats = await this.getHourlyStats();
    const dailyStats = await this.getDailyStats(7);

    return {
      service: this.serviceName,
      metrics: this.metrics,
      recentLogs,
      hourlyStats,
      dailyStats,
      health: await this.getHealthStatus()
    };
  }

  async getRecentLogs(limit = 50) {
    if (!this.redisClient) {
      return this.getFileBasedRecentLogs(limit);
    }

    try {
      const key = `logs:${this.serviceName}:recent`;
      const logs = await this.redisClient.lrange(key, 0, limit - 1);
      return logs.map(log => JSON.parse(log));
    } catch (error) {
      console.error('Failed to get recent logs from Redis:', error);
      return [];
    }
  }

  getFileBasedRecentLogs(limit = 50) {
    try {
      const logFile = path.join(this.logDirectory, 'combined.log');
      if (!fs.existsSync(logFile)) return [];

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-limit);

      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, level: 'info', timestamp: new Date().toISOString() };
        }
      }).reverse();
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  async getHourlyStats() {
    if (!this.redisClient) return null;

    try {
      const stats = {};
      const currentHour = new Date().getHours();
      
      for (let i = 0; i < 24; i++) {
        const hour = (currentHour - i + 24) % 24;
        const key = `logs:metrics:${this.serviceName}:${hour}`;
        const hourStats = await this.redisClient.hgetall(key);
        stats[hour] = {
          error: parseInt(hourStats.error) || 0,
          warn: parseInt(hourStats.warn) || 0,
          info: parseInt(hourStats.info) || 0,
          debug: parseInt(hourStats.debug) || 0
        };
      }

      return stats;
    } catch (error) {
      console.error('Failed to get hourly stats:', error);
      return null;
    }
  }

  async getDailyStats(days = 7) {
    if (!this.redisClient) return null;

    try {
      const stats = {};
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const key = `logs:daily:${this.serviceName}:${dateStr}`;
        const dayStats = await this.redisClient.hgetall(key);
        stats[dateStr] = {
          error: parseInt(dayStats.error) || 0,
          warn: parseInt(dayStats.warn) || 0,
          info: parseInt(dayStats.info) || 0,
          debug: parseInt(dayStats.debug) || 0
        };
      }

      return stats;
    } catch (error) {
      console.error('Failed to get daily stats:', error);
      return null;
    }
  }

  async getHealthStatus() {
    const health = {
      status: 'healthy',
      checks: {
        logger: true,
        files: true,
        redis: false,
        elasticsearch: false
      },
      details: {}
    };

    // Check log directory
    try {
      fs.accessSync(this.logDirectory, fs.constants.W_OK);
      health.checks.files = true;
    } catch (error) {
      health.checks.files = false;
      health.details.filesError = error.message;
    }

    // Check Redis connection
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        health.checks.redis = true;
      } catch (error) {
        health.checks.redis = false;
        health.details.redisError = error.message;
      }
    }

    // Determine overall status
    const failedChecks = Object.values(health.checks).filter(check => !check).length;
    if (failedChecks > 0) {
      health.status = failedChecks > 1 ? 'unhealthy' : 'degraded';
    }

    return health;
  }

  /**
   * Log analysis methods
   */
  async analyzeErrorPatterns(hours = 24) {
    const recentLogs = await this.getRecentLogs(1000);
    const errorLogs = recentLogs.filter(log => log.level === 'error');
    
    const patterns = {};
    errorLogs.forEach(log => {
      const pattern = this.extractErrorPattern(log.message);
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });

    return Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  extractErrorPattern(message) {
    // Remove dynamic parts to find patterns
    return message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9-]{32,}/g, 'ID')
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\b/g, 'TIMESTAMP');
  }

  async generateLogReport(period = '24h') {
    const dashboardData = await this.getDashboardData();
    const errorPatterns = await this.analyzeErrorPatterns();
    
    return {
      service: this.serviceName,
      period,
      generatedAt: new Date().toISOString(),
      summary: dashboardData.metrics,
      errorPatterns,
      health: dashboardData.health,
      topErrors: dashboardData.recentLogs
        .filter(log => log.level === 'error')
        .slice(0, 10)
    };
  }

  /**
   * Cleanup old logs
   */
  async cleanup(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const files = fs.readdirSync(this.logDirectory);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.logDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate && file.includes('.log')) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      await this.info('Log cleanup completed', { deletedFiles: deletedCount, daysToKeep });
      return deletedCount;
      
    } catch (error) {
      await this.error('Log cleanup failed', error);
      throw error;
    }
  }
}

module.exports = LogService;