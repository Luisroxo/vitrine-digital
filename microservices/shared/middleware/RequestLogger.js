/**
 * @fileoverview Request Logging Middleware - Automatic logging for all HTTP requests
 * @version 1.0.0
 * @description Middleware express para captura automática de logs de requests,
 * incluindo métricas de performance, error tracking e correlation IDs
 */

const { v4: uuidv4 } = require('uuid');

class RequestLogger {
  constructor(logService, options = {}) {
    this.logService = logService;
    this.options = {
      includeBody: options.includeBody !== false, // Default true
      includeHeaders: options.includeHeaders === true, // Default false
      skipPaths: options.skipPaths || ['/health', '/ping', '/metrics'],
      skipExtensions: options.skipExtensions || ['.js', '.css', '.png', '.jpg', '.ico'],
      sensitiveFields: options.sensitiveFields || ['password', 'token', 'authorization'],
      maxBodyLength: options.maxBodyLength || 1000,
      ...options
    };
  }

  /**
   * Express middleware for request logging
   */
  middleware() {
    return (req, res, next) => {
      // Skip certain paths
      if (this.shouldSkip(req)) {
        return next();
      }

      // Generate correlation ID
      req.id = uuidv4();
      res.setHeader('X-Request-ID', req.id);

      // Store start time
      req.startTime = Date.now();

      // Log request start
      this.logRequestStart(req);

      // Override res.json to capture response data
      const originalJson = res.json;
      res.json = (data) => {
        res.responseData = data;
        return originalJson.call(res, data);
      };

      // Override res.send to capture response data
      const originalSend = res.send;
      res.send = (data) => {
        res.responseData = data;
        return originalSend.call(res, data);
      };

      // Log response when finished
      res.on('finish', () => {
        this.logRequestEnd(req, res);
      });

      next();
    };
  }

  /**
   * Check if request should be skipped
   */
  shouldSkip(req) {
    const url = req.url.toLowerCase();
    
    // Skip specific paths
    if (this.options.skipPaths.some(path => url.startsWith(path))) {
      return true;
    }
    
    // Skip certain file extensions
    if (this.options.skipExtensions.some(ext => url.endsWith(ext))) {
      return true;
    }
    
    return false;
  }

  /**
   * Log request start
   */
  async logRequestStart(req) {
    const requestData = {
      type: 'request_start',
      requestId: req.id,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      userId: req.user?.id,
      sessionId: req.session?.id,
      timestamp: new Date().toISOString()
    };

    // Include headers if configured
    if (this.options.includeHeaders) {
      requestData.headers = this.sanitizeHeaders(req.headers);
    }

    // Include body if configured and present
    if (this.options.includeBody && req.body && Object.keys(req.body).length > 0) {
      requestData.body = this.sanitizeBody(req.body);
    }

    await this.logService.info('Request started', requestData);
  }

  /**
   * Log request completion
   */
  async logRequestEnd(req, res) {
    const duration = Date.now() - req.startTime;
    const level = this.getLogLevel(res.statusCode, duration);
    
    const responseData = {
      type: 'request_complete',
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      statusText: this.getStatusText(res.statusCode),
      duration: `${duration}ms`,
      responseSize: res.get('Content-Length') || (res.responseData ? JSON.stringify(res.responseData).length : 0),
      responseTime: duration,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };

    // Add performance classification
    responseData.performance = this.classifyPerformance(duration);

    // Include response data if configured
    if (this.options.includeBody && res.responseData) {
      responseData.response = this.sanitizeResponse(res.responseData);
    }

    // Add error details for error responses
    if (res.statusCode >= 400) {
      responseData.error = {
        code: res.statusCode,
        message: res.statusMessage || this.getStatusText(res.statusCode),
        stack: res.errorStack
      };
    }

    await this.logService.log(level, `Request completed - ${req.method} ${req.url}`, responseData);

    // Log performance metric
    await this.logService.logPerformanceMetric(`api_${req.method.toLowerCase()}_${req.path}`, duration, 'ms');

    // Log slow requests separately
    if (duration > 1000) {
      await this.logService.warn('Slow request detected', {
        type: 'slow_request',
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        threshold: '1000ms'
      });
    }
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.get('X-Forwarded-For') ||
           req.get('X-Real-IP');
  }

  /**
   * Sanitize headers removing sensitive information
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    this.options.sensitiveFields.forEach(field => {
      const lowerField = field.toLowerCase();
      if (sanitized[lowerField]) {
        sanitized[lowerField] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Sanitize request body removing sensitive information
   */
  sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = JSON.parse(JSON.stringify(body));
    
    const sanitizeObject = (obj) => {
      Object.keys(obj).forEach(key => {
        if (this.options.sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        )) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      });
    };

    sanitizeObject(sanitized);

    // Truncate if too long
    const jsonStr = JSON.stringify(sanitized);
    if (jsonStr.length > this.options.maxBodyLength) {
      return `${jsonStr.substring(0, this.options.maxBodyLength)}... [TRUNCATED]`;
    }

    return sanitized;
  }

  /**
   * Sanitize response data
   */
  sanitizeResponse(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const jsonStr = JSON.stringify(data);
    if (jsonStr.length > this.options.maxBodyLength) {
      return `${jsonStr.substring(0, this.options.maxBodyLength)}... [TRUNCATED]`;
    }

    return data;
  }

  /**
   * Determine log level based on status code and duration
   */
  getLogLevel(statusCode, duration) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (duration > 2000) return 'warn';
    if (duration > 1000) return 'info';
    return 'debug';
  }

  /**
   * Get HTTP status text
   */
  getStatusText(statusCode) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };

    return statusTexts[statusCode] || 'Unknown';
  }

  /**
   * Classify request performance
   */
  classifyPerformance(duration) {
    if (duration <= 100) return 'excellent';
    if (duration <= 300) return 'good';
    if (duration <= 1000) return 'acceptable';
    if (duration <= 3000) return 'slow';
    return 'very_slow';
  }

  /**
   * Create error logging middleware
   */
  errorMiddleware() {
    return (error, req, res, next) => {
      // Store error stack for logging
      res.errorStack = error.stack;

      // Log the error
      this.logService.error('Request error occurred', error, {
        type: 'request_error',
        requestId: req.id,
        method: req.method,
        url: req.url,
        userId: req.user?.id,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      next(error);
    };
  }

  /**
   * Create 404 logging middleware
   */
  notFoundMiddleware() {
    return (req, res, next) => {
      this.logService.warn('Route not found', {
        type: 'not_found',
        requestId: req.id,
        method: req.method,
        url: req.url,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      next();
    };
  }

  /**
   * Create request metrics summary
   */
  async getRequestMetrics(timeframe = '1h') {
    // This would integrate with the LogService to get request metrics
    const dashboardData = await this.logService.getDashboardData();
    
    return {
      timeframe,
      totalRequests: dashboardData.recentLogs.filter(log => log.type === 'request_complete').length,
      averageResponseTime: this.calculateAverageResponseTime(dashboardData.recentLogs),
      errorRate: this.calculateErrorRate(dashboardData.recentLogs),
      topEndpoints: this.getTopEndpoints(dashboardData.recentLogs),
      statusCodeDistribution: this.getStatusCodeDistribution(dashboardData.recentLogs)
    };
  }

  calculateAverageResponseTime(logs) {
    const completedRequests = logs.filter(log => log.type === 'request_complete' && log.responseTime);
    if (completedRequests.length === 0) return 0;
    
    const totalTime = completedRequests.reduce((sum, log) => sum + log.responseTime, 0);
    return Math.round(totalTime / completedRequests.length);
  }

  calculateErrorRate(logs) {
    const completedRequests = logs.filter(log => log.type === 'request_complete');
    if (completedRequests.length === 0) return 0;
    
    const errorRequests = completedRequests.filter(log => log.statusCode >= 400);
    return Math.round((errorRequests.length / completedRequests.length) * 100);
  }

  getTopEndpoints(logs) {
    const endpointCounts = {};
    logs.filter(log => log.type === 'request_complete').forEach(log => {
      const endpoint = `${log.method} ${log.url}`;
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    });

    return Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  getStatusCodeDistribution(logs) {
    const statusCodes = {};
    logs.filter(log => log.type === 'request_complete').forEach(log => {
      const code = Math.floor(log.statusCode / 100) * 100; // Group by hundreds
      statusCodes[`${code}xx`] = (statusCodes[`${code}xx`] || 0) + 1;
    });

    return statusCodes;
  }
}

module.exports = RequestLogger;