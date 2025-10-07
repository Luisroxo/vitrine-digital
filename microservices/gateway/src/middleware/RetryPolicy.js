const axios = require('axios');
const { Logger } = require('../../../shared');

/**
 * Retry Policy Middleware for resilient service communication
 */
class RetryPolicy {
  constructor(options = {}) {
    this.logger = new Logger('retry-policy');
    
    // Default configuration
    this.config = {
      maxAttempts: options.maxAttempts || 3,
      baseDelay: options.baseDelay || 1000, // 1 second
      maxDelay: options.maxDelay || 10000, // 10 seconds
      exponentialBackoff: options.exponentialBackoff !== false,
      jitterMax: options.jitterMax || 100, // Max jitter in ms
      retryableStatuses: options.retryableStatuses || [429, 502, 503, 504, 408, 500],
      retryableErrors: options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']
    };

    this.logger.info('Retry policy initialized', this.config);
  }

  /**
   * Check if error is retryable based on status code or error type
   */
  isRetryable(error) {
    // Network/connection errors
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true;
    }

    // HTTP status codes
    if (error.response && error.response.status) {
      return this.config.retryableStatuses.includes(error.response.status);
    }

    // Timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for next retry attempt
   */
  calculateDelay(attempt) {
    let delay;

    if (this.config.exponentialBackoff) {
      // Exponential backoff: baseDelay * 2^(attempt-1)
      delay = this.config.baseDelay * Math.pow(2, attempt - 1);
    } else {
      // Linear backoff
      delay = this.config.baseDelay * attempt;
    }

    // Cap at maxDelay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMax;
    delay += jitter;

    return Math.round(delay);
  }

  /**
   * Sleep for specified duration
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, context = {}) {
    const { serviceName = 'unknown', operation = 'request', correlationId } = context;
    let lastError;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;

        if (attempt > 1) {
          this.logger.info('Retry successful', {
            serviceName,
            operation,
            attempt,
            duration,
            correlationId
          });
        }

        return result;

      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.config.maxAttempts;
        const isRetryable = this.isRetryable(error);

        this.logger.warn('Request failed', {
          serviceName,
          operation,
          attempt,
          error: error.message,
          status: error.response?.status,
          code: error.code,
          isRetryable,
          isLastAttempt,
          correlationId
        });

        // Don't retry if error is not retryable or this is the last attempt
        if (!isRetryable || isLastAttempt) {
          break;
        }

        // Calculate and apply delay before next attempt
        const delay = this.calculateDelay(attempt);
        
        this.logger.info('Retrying request', {
          serviceName,
          operation,
          nextAttempt: attempt + 1,
          delayMs: delay,
          correlationId
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted, throw the last error
    this.logger.error('All retry attempts failed', {
      serviceName,
      operation,
      attempts: this.config.maxAttempts,
      lastError: lastError.message,
      correlationId
    });

    throw lastError;
  }

  /**
   * Create Express middleware for automatic retries
   */
  middleware(serviceName) {
    return (req, res, next) => {
      // Store original end method
      const originalEnd = res.end;
      const originalSend = res.send;
      let hasEnded = false;

      // Override end method to detect response completion
      res.end = function(...args) {
        hasEnded = true;
        return originalEnd.apply(this, args);
      };

      res.send = function(...args) {
        hasEnded = true;
        return originalSend.apply(this, args);
      };

      // Add retry method to request object
      req.retry = (fn, operation = 'request') => {
        return this.execute(fn, {
          serviceName,
          operation,
          correlationId: req.correlationId || req.get('x-correlation-id')
        });
      };

      // Check if response has ended before continuing
      const checkResponse = () => {
        if (!hasEnded) {
          next();
        }
      };

      // Handle async middleware
      if (next.constructor.name === 'AsyncFunction') {
        return checkResponse();
      }

      checkResponse();
    };
  }

  /**
   * Create axios instance with automatic retry
   */
  createAxiosInstance(serviceName, baseConfig = {}) {
    const instance = axios.create(baseConfig);

    // Add request interceptor for correlation ID
    instance.interceptors.request.use(config => {
      if (!config.headers['x-correlation-id']) {
        config.headers['x-correlation-id'] = `${serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      return config;
    });

    // Add response interceptor for automatic retries
    instance.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        // Check if retry is enabled for this request
        if (config && !config._retryCount) {
          config._retryCount = 0;
        }

        if (config && config._retryCount < this.config.maxAttempts && this.isRetryable(error)) {
          config._retryCount++;
          
          const delay = this.calculateDelay(config._retryCount);
          
          this.logger.info('Axios automatic retry', {
            serviceName,
            url: config.url,
            method: config.method,
            attempt: config._retryCount,
            delayMs: delay,
            error: error.message
          });

          await this.sleep(delay);
          return instance(config);
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Get retry statistics for monitoring
   */
  getStats() {
    return {
      config: this.config,
      // In a real implementation, you'd track retry statistics here
      totalRequests: 0,
      totalRetries: 0,
      successAfterRetry: 0,
      failedAfterAllRetries: 0
    };
  }
}

module.exports = RetryPolicy;