class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5; // Número de falhas antes de abrir o circuito
    this.timeout = options.timeout || 60000; // Tempo em ms para tentar novamente
    this.resetTimeout = options.resetTimeout || 30000; // Tempo para tentar fechar o circuito
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    
    this.logger = options.logger;
    this.serviceName = options.serviceName || 'unknown';
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      } else {
        this.state = 'HALF_OPEN';
        this.logger?.info(`Circuit breaker entering HALF_OPEN state for ${this.serviceName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.logger?.info(`Circuit breaker CLOSED for ${this.serviceName}`);
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.logger?.warn(`Circuit breaker OPEN for ${this.serviceName}. Failures: ${this.failures}`);
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      serviceName: this.serviceName
    };
  }
}

class CircuitBreakerMiddleware {
  constructor(logger) {
    this.logger = logger;
    this.breakers = new Map();
  }

  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker({
        ...options,
        serviceName,
        logger: this.logger
      }));
    }
    return this.breakers.get(serviceName);
  }

  middleware(serviceName, options = {}) {
    return (req, res, next) => {
      const breaker = this.getBreaker(serviceName, options);
      
      if (breaker.state === 'OPEN') {
        if (Date.now() < breaker.nextAttempt) {
          this.logger.warn('Circuit breaker blocked request', {
            service: serviceName,
            state: breaker.getStatus()
          });
          
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            code: 'CIRCUIT_BREAKER_OPEN',
            service: serviceName,
            retryAfter: Math.ceil((breaker.nextAttempt - Date.now()) / 1000)
          });
        } else {
          breaker.state = 'HALF_OPEN';
          this.logger?.info(`Circuit breaker entering HALF_OPEN state for ${serviceName}`);
        }
      }

      // Intercept response to track success/failure
      const originalEnd = res.end;
      const originalSend = res.send;
      
      res.end = function(...args) {
        if (res.statusCode >= 500) {
          breaker.onFailure();
        } else {
          breaker.onSuccess();
        }
        originalEnd.apply(this, args);
      };
      
      res.send = function(...args) {
        if (res.statusCode >= 500) {
          breaker.onFailure();
        } else {
          breaker.onSuccess();
        }
        originalSend.apply(this, args);
      };
      
      next();
    };
  }

  getAllStatus() {
    const status = {};
    for (const [serviceName, breaker] of this.breakers) {
      status[serviceName] = breaker.getStatus();
    }
    return status;
  }
}

module.exports = CircuitBreakerMiddleware;