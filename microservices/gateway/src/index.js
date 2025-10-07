require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Logger, JWTUtils, ErrorHandler } = require('../../shared');

class APIGateway {
  constructor() {
    this.app = express();
    this.port = process.env.GATEWAY_PORT || 3000;
    this.logger = new Logger('api-gateway');
    this.jwtUtils = new JWTUtils();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
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

    // Rate limiting
    const limiter = rateLimit({
      windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT_MAX || 100,
      message: {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(this.logger.middleware());
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', this.healthCheck.bind(this));
    
    // Service status
    this.app.get('/status', this.serviceStatus.bind(this));

    // Auth Service - Public routes (no authentication required)
    this.app.use('/auth', createProxyMiddleware({
      target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      changeOrigin: true,
      timeout: 30000,
      onError: (err, req, res) => {
        this.logger.error('Auth service proxy error', err, { 
          url: req.url,
          correlationId: req.correlationId 
        });
        res.status(503).json({
          error: 'Auth service unavailable',
          code: 'SERVICE_UNAVAILABLE'
        });
      }
    }));

    // Protected routes - require authentication
    const authMiddleware = this.jwtUtils.createAuthMiddleware();

    // Product Service - Protected
    this.app.use('/products', 
      authMiddleware,
      createProxyMiddleware({
        target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
        changeOrigin: true,
        timeout: 30000,
        onError: this.createProxyErrorHandler('Product service')
      })
    );

    // Bling Service - Protected
    this.app.use('/bling', 
      authMiddleware,
      createProxyMiddleware({
        target: process.env.BLING_SERVICE_URL || 'http://bling-service:3003',
        changeOrigin: true,
        timeout: 30000,
        onError: this.createProxyErrorHandler('Bling service')
      })
    );

    // Billing Service - Protected
    this.app.use('/billing', 
      authMiddleware,
      createProxyMiddleware({
        target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3004',
        changeOrigin: true,
        timeout: 30000,
        onError: this.createProxyErrorHandler('Billing service')
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

  setupErrorHandling() {
    // 404 handler
    this.app.use(ErrorHandler.notFoundHandler());
    
    // Global error handler
    this.app.use(ErrorHandler.globalHandler());
  }

  async start() {
    try {
      this.app.listen(this.port, () => {
        this.logger.logStartup(this.port, process.env.NODE_ENV);
        console.log(`
🚀 API Gateway started successfully!
📊 Port: ${this.port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📈 Health: http://localhost:${this.port}/health
📋 Status: http://localhost:${this.port}/status

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