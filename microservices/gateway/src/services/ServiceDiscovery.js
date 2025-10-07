const axios = require('axios');
const { Logger } = require('../../../shared');

/**
 * Service Discovery for automatic service health monitoring and load balancing
 */
class ServiceDiscovery {
  constructor() {
    this.logger = new Logger('service-discovery');
    this.services = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.healthCheckTimeout = 5000; // 5 seconds
    this.maxRetries = 3;
    
    this.initializeServices();
    this.startHealthChecks();
  }

  /**
   * Initialize service registry with default configurations
   */
  initializeServices() {
    const serviceConfigs = [
      {
        name: 'auth-service',
        url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      },
      {
        name: 'product-service', 
        url: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      },
      {
        name: 'bling-service',
        url: process.env.BLING_SERVICE_URL || 'http://bling-service:3003',
        healthPath: '/health',
        weight: 1,
        timeout: 45000 // Bling can be slower
      },
      {
        name: 'billing-service',
        url: process.env.BILLING_SERVICE_URL || 'http://billing-service:3004',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      }
    ];

    serviceConfigs.forEach(config => {
      this.registerService(config);
    });

    this.logger.info('Service discovery initialized', {
      servicesCount: this.services.size,
      services: Array.from(this.services.keys())
    });
  }

  /**
   * Register a new service in the registry
   */
  registerService(config) {
    const service = {
      ...config,
      status: 'unknown',
      lastCheck: null,
      consecutiveFailures: 0,
      lastError: null,
      responseTime: null,
      instances: [config.url] // Support for multiple instances
    };

    this.services.set(config.name, service);
    this.logger.info('Service registered', { 
      serviceName: config.name,
      url: config.url
    });
  }

  /**
   * Get healthy service instance URL
   */
  getServiceUrl(serviceName) {
    const service = this.services.get(serviceName);
    
    if (!service) {
      throw new Error(`Service ${serviceName} not found in registry`);
    }

    if (service.status !== 'healthy') {
      this.logger.warn('Service is not healthy', {
        serviceName,
        status: service.status,
        lastError: service.lastError
      });
    }

    // For now, return the primary URL. In future, implement load balancing
    return service.url;
  }

  /**
   * Get service configuration including timeout
   */
  getServiceConfig(serviceName) {
    const service = this.services.get(serviceName);
    
    if (!service) {
      return {
        url: null,
        timeout: 30000,
        status: 'not_found'
      };
    }

    return {
      url: service.url,
      timeout: service.timeout,
      status: service.status,
      responseTime: service.responseTime
    };
  }

  /**
   * Check health of a single service
   */
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    
    if (!service) {
      return { status: 'not_found', error: 'Service not registered' };
    }

    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${service.url}${service.healthPath}`, {
        timeout: this.healthCheckTimeout,
        headers: {
          'User-Agent': 'Gateway-HealthChecker/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      
      service.status = 'healthy';
      service.lastCheck = new Date();
      service.consecutiveFailures = 0;
      service.lastError = null;
      service.responseTime = responseTime;

      this.logger.debug('Service health check passed', {
        serviceName,
        responseTime,
        status: response.status
      });

      return { 
        status: 'healthy', 
        responseTime,
        data: response.data 
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      service.status = 'unhealthy';
      service.lastCheck = new Date();
      service.consecutiveFailures++;
      service.lastError = error.message;
      service.responseTime = responseTime;

      this.logger.warn('Service health check failed', {
        serviceName,
        error: error.message,
        consecutiveFailures: service.consecutiveFailures,
        responseTime
      });

      return { 
        status: 'unhealthy', 
        error: error.message,
        responseTime 
      };
    }
  }

  /**
   * Check health of all services
   */
  async checkAllServicesHealth() {
    const healthChecks = Array.from(this.services.keys()).map(async serviceName => {
      const result = await this.checkServiceHealth(serviceName);
      return { serviceName, ...result };
    });

    const results = await Promise.all(healthChecks);
    
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      timestamp: new Date(),
      services: results
    };

    this.logger.info('Health check summary', {
      healthy: summary.healthy,
      unhealthy: summary.unhealthy,
      total: summary.total
    });

    return summary;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    this.logger.info('Starting periodic health checks', {
      interval: this.healthCheckInterval,
      timeout: this.healthCheckTimeout
    });

    setInterval(async () => {
      try {
        await this.checkAllServicesHealth();
      } catch (error) {
        this.logger.error('Health check cycle failed', error);
      }
    }, this.healthCheckInterval);

    // Initial health check
    setTimeout(() => this.checkAllServicesHealth(), 2000);
  }

  /**
   * Get current service registry status
   */
  getServiceRegistry() {
    const registry = {};
    
    this.services.forEach((service, name) => {
      registry[name] = {
        url: service.url,
        status: service.status,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        responseTime: service.responseTime,
        lastError: service.lastError
      };
    });

    return registry;
  }

  /**
   * Check if service is available for requests
   */
  isServiceAvailable(serviceName) {
    const service = this.services.get(serviceName);
    
    if (!service) {
      return false;
    }

    // Consider service available if:
    // - Status is healthy, OR
    // - Status is unknown (just started), OR  
    // - Less than maxRetries consecutive failures
    return service.status === 'healthy' || 
           service.status === 'unknown' ||
           service.consecutiveFailures < this.maxRetries;
  }
}

module.exports = ServiceDiscovery;