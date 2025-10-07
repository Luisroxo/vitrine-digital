const winston = require('winston');

/**
 * Centralized Logging Utility for Microservices
 * Provides structured logging with correlation IDs
 */
class Logger {
  constructor(serviceName = 'unknown-service') {
    this.serviceName = serviceName;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, service, correlationId, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            service: service || this.serviceName,
            correlationId,
            ...meta
          });
        })
      ),
      defaultMeta: { service: this.serviceName },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: `logs/${this.serviceName}-error.log`, 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: `logs/${this.serviceName}.log` 
        })
      ]
    });

    // Create logs directory if it doesn't exist
    this.ensureLogsDirectory();
  }

  /**
   * Ensure logs directory exists
   */
  ensureLogsDirectory() {
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Extract correlation ID from request
   */
  getCorrelationId(req) {
    return req.headers['x-correlation-id'] || 
           req.correlationId || 
           this.generateCorrelationId();
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log info message
   */
  info(message, meta = {}, correlationId = null) {
    this.logger.info(message, {
      ...meta,
      correlationId: correlationId || meta.correlationId
    });
  }

  /**
   * Log error message
   */
  error(message, error = null, meta = {}, correlationId = null) {
    this.logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      } : undefined,
      ...meta,
      correlationId: correlationId || meta.correlationId
    });
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}, correlationId = null) {
    this.logger.warn(message, {
      ...meta,
      correlationId: correlationId || meta.correlationId
    });
  }

  /**
   * Log debug message
   */
  debug(message, meta = {}, correlationId = null) {
    this.logger.debug(message, {
      ...meta,
      correlationId: correlationId || meta.correlationId
    });
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, next) {
    const correlationId = this.getCorrelationId(req);
    req.correlationId = correlationId;

    // Set correlation ID header in response
    res.setHeader('x-correlation-id', correlationId);

    const startTime = Date.now();

    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      correlationId
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.info('HTTP Response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId
      });
    });

    next();
  }

  /**
   * Log database query
   */
  logQuery(query, params = [], correlationId = null) {
    this.debug('Database Query', {
      query,
      params,
      correlationId
    });
  }

  /**
   * Log external API call
   */
  logApiCall(service, method, url, statusCode, duration, correlationId = null) {
    this.info('External API Call', {
      service,
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      correlationId
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(eventName, data = {}, correlationId = null) {
    this.info('Business Event', {
      eventName,
      data,
      correlationId
    });
  }

  /**
   * Log user action
   */
  logUserAction(userId, action, resource, meta = {}, correlationId = null) {
    this.info('User Action', {
      userId,
      action,
      resource,
      ...meta,
      correlationId
    });
  }

  /**
   * Log service startup
   */
  logStartup(port, environment = 'development') {
    this.info('Service Started', {
      service: this.serviceName,
      port,
      environment,
      nodeVersion: process.version,
      pid: process.pid
    });
  }

  /**
   * Log service shutdown
   */
  logShutdown(signal) {
    this.info('Service Shutting Down', {
      service: this.serviceName,
      signal,
      uptime: process.uptime()
    });
  }

  /**
   * Performance logger middleware
   */
  performanceMiddleware() {
    return (req, res, next) => {
      const startTime = process.hrtime();
      
      res.on('finish', () => {
        const diff = process.hrtime(startTime);
        const duration = diff[0] * 1e3 + diff[1] * 1e-6; // Convert to milliseconds
        
        if (duration > 1000) { // Log slow requests (>1s)
          this.warn('Slow Request Detected', {
            method: req.method,
            url: req.url,
            duration: `${duration.toFixed(2)}ms`,
            correlationId: req.correlationId
          });
        }
      });
      
      next();
    };
  }

  /**
   * Create express middleware
   */
  middleware() {
    return this.logRequest.bind(this);
  }
}

module.exports = Logger;