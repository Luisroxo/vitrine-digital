const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');

// Shared utilities
const { Logger, ErrorHandler, JWTUtils } = require('../../shared');

const app = express();
const PORT = process.env.PORT || 3000;
const logger = new Logger('gateway');
const jwtUtils = new JWTUtils();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(compression());

// Logging
app.use(morgan('combined'));
app.use(logger.middleware());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use(limiter);

// Parse JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check all services health
    const healthChecks = await Promise.allSettled([
      checkServiceHealth('auth-service', process.env.AUTH_SERVICE_URL),
      checkServiceHealth('product-service', process.env.PRODUCT_SERVICE_URL),
      checkServiceHealth('bling-service', process.env.BLING_SERVICE_URL),
      checkServiceHealth('billing-service', process.env.BILLING_SERVICE_URL)
    ]);

    const services = healthChecks.map((result, index) => {
      const serviceNames = ['auth-service', 'product-service', 'bling-service', 'billing-service'];
      return {
        service: serviceNames[index],
        status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        ...(result.status === 'rejected' && { error: result.reason.message })
      };
    });

    const overallHealth = services.every(s => s.status === 'healthy') ? 'healthy' : 'degraded';

    res.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services,
      version: process.env.npm_package_version || '1.0.0'
    });

  } catch (error) {
    logger.error('Health check failed', error, {}, req.correlationId);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication middleware for protected routes
const authMiddleware = jwtUtils.createAuthMiddleware();

// Service proxy configurations
const serviceProxies = {
  '/auth': {
    target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    pathRewrite: { '^/auth': '' },
    protected: false // Auth endpoints should not require authentication
  },
  '/products': {
    target: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002',
    pathRewrite: { '^/products': '' },
    protected: true
  },
  '/bling': {
    target: process.env.BLING_SERVICE_URL || 'http://bling-service:3003',
    pathRewrite: { '^/bling': '' },
    protected: true
  },
  '/billing': {
    target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3004',
    pathRewrite: { '^/billing': '' },
    protected: true
  }
};

// Setup service proxies
Object.entries(serviceProxies).forEach(([path, config]) => {
  const middleware = [];
  
  // Add authentication if required
  if (config.protected) {
    middleware.push(authMiddleware);
  }
  
  // Add proxy middleware
  middleware.push(
    createProxyMiddleware({
      target: config.target,
      changeOrigin: true,
      pathRewrite: config.pathRewrite,
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${path}`, err, {
          url: req.url,
          method: req.method
        }, req.correlationId);
        
        res.status(502).json({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          service: path.substring(1)
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Forward user information to services
        if (req.user) {
          proxyReq.setHeader('x-user-id', req.user.userId);
          proxyReq.setHeader('x-user-role', req.user.role);
          proxyReq.setHeader('x-tenant-id', req.user.tenantId);
        }
        
        // Forward correlation ID
        if (req.correlationId) {
          proxyReq.setHeader('x-correlation-id', req.correlationId);
        }

        logger.info(`Proxying request to ${config.target}`, {
          method: req.method,
          originalUrl: req.originalUrl,
          targetUrl: `${config.target}${proxyReq.path}`,
          userId: req.user?.userId
        }, req.correlationId);
      }
    })
  );
  
  app.use(path, ...middleware);
});

// Catch-all for undefined routes
app.use(ErrorHandler.notFoundHandler());

// Global error handler
app.use(ErrorHandler.globalHandler());

// Helper function to check service health
async function checkServiceHealth(serviceName, serviceUrl) {
  const axios = require('axios');
  
  try {
    const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
    return { service: serviceName, status: 'healthy', data: response.data };
  } catch (error) {
    throw new Error(`${serviceName} health check failed: ${error.message}`);
  }
}

// Start server
app.listen(PORT, () => {
  logger.logStartup(PORT, process.env.NODE_ENV);
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.logShutdown('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.logShutdown('SIGINT');  
  process.exit(0);
});

module.exports = app;