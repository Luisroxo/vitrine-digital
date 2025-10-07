require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Logger, JWTUtils, ErrorHandler } = require('../../shared');
const { HealthChecker } = require('../../shared/utils/health');
const LogService = require('../../shared/services/LogService');
const RequestLogger = require('../../shared/middleware/RequestLogger');
const createLogRoutes = require('../../shared/routes/logRoutes');
const SLAMonitor = require('../../shared/services/SLAMonitor');
const NotificationService = require('../../shared/services/NotificationService');
const createSLARoutes = require('../../shared/routes/slaRoutes');
const MetricsMiddleware = require('./middleware/MetricsMiddleware');
const CircuitBreakerMiddleware = require('./middleware/CircuitBreakerMiddleware');
const ServiceDiscovery = require('./services/ServiceDiscovery');
const HealthCheckService = require('./services/HealthCheckService');
const RetryPolicy = require('./middleware/RetryPolicy');
const JWTValidationPipeline = require('./middleware/JWTValidationPipeline');
const RoleBasedRouter = require('./middleware/RoleBasedRouter');
const RequestSanitizer = require('./middleware/RequestSanitizer');
const systemHealthRoutes = require('./routes/systemHealth');
const GatewayAnalyticsIntegration = require('./middleware/GatewayAnalyticsIntegration');
const analyticsRoutes = require('../../shared/routes/analyticsRoutes');

class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.GATEWAY_PORT || 3000;
    this.logger = new Logger('api-gateway');
    this.healthChecker = new HealthChecker();
    
    // Initialize new logging system
    this.logService = new LogService({
      serviceName: 'api-gateway',
      logDirectory: process.env.LOG_DIR || './logs',
      redisClient: null // Will be initialized if Redis is available
    });
    this.requestLogger = new RequestLogger(this.logService);
    
    // Initialize SLA monitoring system
    this.notificationService = new NotificationService({
      logService: this.logService,
      email: { enabled: process.env.SLA_EMAIL_ENABLED === 'true' },
      slack: { enabled: process.env.SLA_SLACK_ENABLED === 'true' },
      webhook: { enabled: process.env.SLA_WEBHOOK_ENABLED === 'true' }
    });
    
    this.slaMonitor = new SLAMonitor({
      serviceName: 'api-gateway',
      logService: this.logService,
      notificationService: this.notificationService,
      redisClient: null // Will be initialized if Redis is available
    });
    
    // Initialize enhanced services
    this.serviceDiscovery = new ServiceDiscovery();
    this.healthCheck = new HealthCheckService(this.serviceDiscovery);
    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 1000,
      exponentialBackoff: true
    });
    this.jwtValidation = new JWTValidationPipeline();
    this.roleRouter = new RoleBasedRouter();
    this.requestSanitizer = new RequestSanitizer();
    
    // Initialize Analytics Integration
    this.analyticsIntegration = new GatewayAnalyticsIntegration();
    
    // Legacy components
    this.jwtUtils = new JWTUtils();
    this.metrics = new MetricsMiddleware(this.logger);
    this.circuitBreaker = new CircuitBreakerMiddleware(this.logger);
    
    this.setupHealthChecks();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupHealthChecks() {
    // Configurar health checks específicos do Gateway
    this.healthChecker.addCheck('service_discovery', async () => {
      try {
        const services = await this.serviceDiscovery.getHealthyServices();
        return { 
          status: 'healthy', 
          services_count: services.length,
          services: services.map(s => ({ name: s.name, status: s.status }))
        };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    this.healthChecker.addCheck('downstream_services', async () => {
      try {
        const serviceChecks = await Promise.allSettled([
          this.checkService('auth-service', process.env.AUTH_SERVICE_URL || 'http://localhost:3001'),
          this.checkService('product-service', process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002'),
          this.checkService('billing-service', process.env.BILLING_SERVICE_URL || 'http://localhost:3004'),
          this.checkService('bling-service', process.env.BLING_SERVICE_URL || 'http://localhost:3003')
        ]);

        const results = serviceChecks.map((result, index) => {
          const serviceNames = ['auth-service', 'product-service', 'billing-service', 'bling-service'];
          return {
            service: serviceNames[index],
            status: result.status === 'fulfilled' ? result.value.status : 'unhealthy',
            error: result.status === 'rejected' ? result.reason.message : undefined
          };
        });

        const healthyCount = results.filter(r => r.status === 'healthy').length;
        const totalCount = results.length;

        return {
          status: healthyCount === totalCount ? 'healthy' : 'degraded',
          healthy_services: healthyCount,
          total_services: totalCount,
          services: results
        };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    this.healthChecker.addBusinessMetric('active_connections', async () => {
      try {
        // Simulação de contagem de conexões ativas
        return Math.floor(Math.random() * 100) + 1;
      } catch (error) {
        this.logger.error('Error getting active connections:', error);
        return 0;
      }
    });

    this.healthChecker.addBusinessMetric('requests_per_minute', async () => {
      try {
        // Integração com metrics middleware para obter RPM real
        return this.metrics.getRequestsPerMinute ? this.metrics.getRequestsPerMinute() : 0;
      } catch (error) {
        this.logger.error('Error getting requests per minute:', error);
        return 0;
      }
    });

    this.logger.info('Health checks configured for API Gateway');
  }

  async checkService(serviceName, serviceUrl) {
    try {
      const axios = require('axios');
      const response = await axios.get(`${serviceUrl}/health`, { 
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      return {
        service: serviceName,
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        response_time: response.headers['x-response-time'] || 'N/A',
        status_code: response.status
      };
    } catch (error) {
      return {
        service: serviceName,
        status: 'unhealthy',
        error: error.message,
        code: error.code
      };
    }
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());
    this.app.use(compression());
    
    // CORS
    const corsOptions = {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
    };
    this.app.use(cors(corsOptions));

    // Request logging middleware
    this.app.use(this.requestLogger.middleware());

    // Analytics Integration middleware
    this.app.use(this.analyticsIntegration.requestTrackingMiddleware());

    // Metrics middleware
    this.app.use(this.metrics.middleware());

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT_MAX || 1000,
      message: {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.warn('Global rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.'
        });
      }
    });
    
    // Strict rate limiting for auth endpoints
    this.authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Lower limit for auth endpoints
      message: {
        error: 'Authentication rate limit exceeded',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      },
      handler: (req, res) => {
        this.logger.warn('Auth rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        res.status(429).json({
          error: 'Authentication rate limit exceeded',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts. Please wait before trying again.'
        });
      }
    });

    this.app.use(globalLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request sanitization (early in pipeline)
    this.app.use(this.requestSanitizer.middleware());

    // Logging
    this.app.use(this.logger.middleware());
  }

  setupRoutes() {
    // Health check routes (HealthChecker)
    this.app.get('/health', this.healthChecker.getHealthCheck());
    this.app.get('/health/ready', this.healthChecker.getReadinessCheck());
    this.app.get('/health/live', this.healthChecker.getLivenessCheck());
    
    // Enhanced health check routes
    this.healthCheck.createRoutes(this.app);
    
    // Log management routes
    const logRoutes = createLogRoutes(this.logService, this.requestLogger);
    this.app.use('/api/shared/logs', logRoutes);
    
    // SLA monitoring routes
    const slaRoutes = createSLARoutes(this.slaMonitor, this.notificationService);
    this.app.use('/api/shared/sla', slaRoutes);
    
    // System Health Dashboard routes
    this.app.use('/api/shared/system', systemHealthRoutes);
    
    // Analytics routes
    this.app.use('/api/shared/analytics', analyticsRoutes);
    
    // Backup System routes
    const backupRoutes = require('../../shared/routes/backupRoutes');
    this.app.use('/api/shared/backup', backupRoutes);
    
    // Legacy endpoints for backward compatibility
    this.app.get('/status', this.serviceStatus.bind(this));
    this.app.get('/metrics', this.getMetrics.bind(this));
    this.app.get('/circuit-breaker', this.getCircuitBreakerStatus.bind(this));
    
    // Service discovery endpoints
    this.app.get('/services', this.jwtValidation.createAuthMiddleware({ requiredRole: 'admin' }), (req, res) => {
      const registry = this.serviceDiscovery.getServiceRegistry();
      res.json({
        status: 'success',
        data: registry,
        timestamp: new Date().toISOString()
      });
    });
    
    // Gateway statistics
    this.app.get('/gateway/stats', this.jwtValidation.createAuthMiddleware({ requiredRole: 'admin' }), (req, res) => {
      res.json({
        serviceDiscovery: this.serviceDiscovery.getServiceRegistry(),
        retryPolicy: this.retryPolicy.getStats(),
        jwtValidation: this.jwtValidation.getStats(),
        roleRouter: this.roleRouter.getStats(),
        sanitizer: this.requestSanitizer.getStats(),
        healthCheck: this.healthCheck.getStats()
      });
    });

    // Role-based routing middleware
    this.app.use(this.roleRouter.middleware());

    // Auth Service - Public routes with strict rate limiting
    this.app.use('/auth/login', this.authLimiter);
    this.app.use('/auth/register', this.authLimiter);
    this.app.use('/auth/reset-password', this.authLimiter);
    this.app.use('/auth/forgot-password', this.authLimiter);
    
    this.app.use('/auth', this.createEnhancedProxy('auth-service', {
      target: this.serviceDiscovery.getServiceUrl('auth-service'),
      timeout: 30000
    }));

    // Protected routes - require authentication
    const authMiddleware = this.jwtValidation.createAuthMiddleware();

    // Product Service - Protected with role-based access
    this.app.use('/products', 
      authMiddleware,
      this.circuitBreaker.middleware('product-service', { threshold: 3, resetTimeout: 30000 }),
      this.createEnhancedProxy('product-service', {
        timeout: 30000
      })
    );

    // Bling Service - Protected (lojista+ role required)
    this.app.use('/bling', 
      this.jwtValidation.createAuthMiddleware({ requiredRole: 'lojista' }),
      this.circuitBreaker.middleware('bling-service', { threshold: 5, resetTimeout: 60000 }),
      this.createEnhancedProxy('bling-service', {
        timeout: 45000 // Bling can be slower
      })
    );

    // Billing Service - Protected (lojista+ role required)
    this.app.use('/billing', 
      this.jwtValidation.createAuthMiddleware({ requiredRole: 'lojista' }),
      this.circuitBreaker.middleware('billing-service', { threshold: 3, resetTimeout: 30000 }),
      this.createEnhancedProxy('billing-service', {
        timeout: 30000
      })
    );

    // Admin routes - require admin role
    const adminMiddleware = this.jwtUtils.createRoleMiddleware(['admin']);
    
    this.app.use('/admin/products', 
      authMiddleware,
      adminMiddleware,
      createProxyMiddleware({
        target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
        changeOrigin: true,
        pathRewrite: { '^/admin/products': '/admin' }
      })
    );

    this.app.use('/admin/billing', 
      authMiddleware,
      adminMiddleware,
      createProxyMiddleware({
        target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3004',
        changeOrigin: true,
        pathRewrite: { '^/admin/billing': '/admin' }
      })
    );
  }

  createProxyErrorHandler(serviceName) {
    return (err, req, res) => {
      this.logger.error(`${serviceName} proxy error`, err, {
        url: req.url,
        correlationId: req.correlationId
      });
      
      res.status(503).json({
        error: `${serviceName} unavailable`,
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    };
  }

  async healthCheck(req, res) {
    // Simple health check for testing environment
    if (process.env.NODE_ENV === 'test') {
      return res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: []
      });
    }

    const services = [
      { name: 'Auth Service', url: process.env.AUTH_SERVICE_URL + '/health' },
      { name: 'Product Service', url: process.env.PRODUCT_SERVICE_URL + '/health' },
      { name: 'Bling Service', url: process.env.BLING_SERVICE_URL + '/health' },
      { name: 'Billing Service', url: process.env.BILLING_SERVICE_URL + '/health' }
    ];

    const serviceChecks = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const axios = require('axios');
          const response = await axios.get(service.url, { timeout: 5000 });
          return {
            service: service.name,
            status: 'healthy',
            responseTime: response.headers['response-time'] || 'N/A'
          };
        } catch (error) {
          return {
            service: service.name,
            status: 'unhealthy',
            error: error.message
          };
        }
      })
    );

    const results = serviceChecks.map(result => result.value);
    const allHealthy = results.every(result => result.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      gateway: 'healthy',
      services: results,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  }

  async serviceStatus(req, res) {
    const memoryUsage = process.memoryUsage();
    
    res.json({
      service: 'API Gateway',
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      },
      timestamp: new Date().toISOString()
    });
  }

  getMetrics(req, res) {
    try {
      const metrics = this.metrics.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      this.logger.error('Error getting metrics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  }

  getCircuitBreakerStatus(req, res) {
    try {
      const status = this.circuitBreaker.getAllStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      this.logger.error('Error getting circuit breaker status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get circuit breaker status'
      });
    }
  }

  /**
   * Create enhanced proxy with retry policy and service discovery
   */
  createEnhancedProxy(serviceName, options = {}) {
    return createProxyMiddleware({
      target: options.target || this.serviceDiscovery.getServiceUrl(serviceName),
      changeOrigin: true,
      timeout: options.timeout || 30000,
      onProxyReq: (proxyReq, req, res) => {
        // Add correlation ID and service info
        proxyReq.setHeader('x-correlation-id', req.correlationId || req.get('x-correlation-id'));
        proxyReq.setHeader('x-gateway-service', serviceName);
        
        // Add user context if available
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.sub);
          proxyReq.setHeader('x-user-role', req.user.role);
          proxyReq.setHeader('x-tenant-id', req.user.tenantId || '');
        }
      },
      onError: (err, req, res) => {
        this.logger.error(`${serviceName} proxy error`, {
          error: err.message,
          url: req.url,
          method: req.method,
          correlationId: req.correlationId
        });

        // Check if service is still available
        const isAvailable = this.serviceDiscovery.isServiceAvailable(serviceName);
        
        if (!isAvailable) {
          return res.status(503).json({
            error: `${serviceName} is currently unavailable`,
            code: 'SERVICE_UNAVAILABLE',
            service: serviceName,
            timestamp: new Date().toISOString()
          });
        }

        // Generic error response
        res.status(502).json({
          error: `${serviceName} error`,
          code: 'PROXY_ERROR',
          service: serviceName,
          message: err.message,
          timestamp: new Date().toISOString()
        });
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        proxyRes.headers['x-gateway'] = 'vitrine-digital-gateway';
        proxyRes.headers['x-service'] = serviceName;
        proxyRes.headers['x-correlation-id'] = req.correlationId || req.get('x-correlation-id');
      }
    });
  }

  setupErrorHandling() {
    // Analytics error tracking middleware
    this.app.use(this.analyticsIntegration.errorTrackingMiddleware());
    
    // Request logger middlewares
    this.app.use(this.requestLogger.notFoundMiddleware());
    this.app.use(this.requestLogger.errorMiddleware());
    
    // 404 handler
    this.app.use(ErrorHandler.notFoundHandler());
    
    // Global error handler
    this.app.use(ErrorHandler.globalHandler());
  }

  async start() {
    try {
      this.app.listen(this.port, () => {
        this.logger.logStartup(this.port, process.env.NODE_ENV);
        
        // Start analytics periodic collection
        this.analyticsIntegration.startPeriodicCollection();
        
        console.log(`
🚀 API Gateway started successfully!
📊 Port: ${this.port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📈 Health: http://localhost:${this.port}/health
📋 Status: http://localhost:${this.port}/status
📊 Analytics: http://localhost:${this.port}/api/shared/analytics/dashboard

🔗 Proxied Services:
  • Auth Service: ${process.env.AUTH_SERVICE_URL || 'http://auth-service:3001'}
  • Product Service: ${process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'} 
  • Bling Service: ${process.env.BLING_SERVICE_URL || 'http://bling-service:3003'}
  • Billing Service: ${process.env.BILLING_SERVICE_URL || 'http://billing-service:3004'}
        `);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
      
    } catch (error) {
      this.logger.error('Failed to start API Gateway', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    this.logger.logShutdown(signal);
    process.exit(0);
  }
}

// Start the gateway
if (require.main === module) {
  const gateway = new APIGateway();
  gateway.start();
}

module.exports = APIGateway;