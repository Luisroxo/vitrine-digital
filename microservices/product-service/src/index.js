const express = require('express');
const cors = require('cors');
const knex = require('knex');
const config = require('./config/database');
const { Logger, EventPublisher } = require('../../shared');
const { HealthChecker, commonChecks } = require('../../shared/utils/health');
const ProductService = require('./services/ProductService');
const ProductEventListener = require('./services/ProductEventListener');
const createProductImagesRoutes = require('./routes/images');
const CacheService = require('../../shared/services/CacheService');
const ProductCacheMiddleware = require('./middleware/ProductCacheMiddleware');
const QueryOptimizationService = require('../../shared/services/QueryOptimizationService');

const app = express();

// Configurar logger
const logger = new Logger('product-service');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
const db = knex(config);

// Initialize cache service
const cacheService = new CacheService();
const cacheMiddleware = new ProductCacheMiddleware(cacheService);

// Initialize query optimization service
const queryOptimizer = new QueryOptimizationService(db, {
  slowQueryThreshold: 1000,
  enableLogging: process.env.NODE_ENV !== 'test'
});

// Initialize health checker
const healthChecker = new HealthChecker();

// Register health checks
healthChecker.registerCheck('memory', commonChecks.memory(0.9));
healthChecker.registerCheck('environment', commonChecks.environment([
  'DATABASE_URL'
]));

// Check product count as business metric
healthChecker.registerCheck('product_count', async () => {
  const result = await db('products').count('id as count').first();
  const count = parseInt(result.count);
  
  return {
    totalProducts: count,
    status: count > 0 ? 'populated' : 'empty'
  };
});

// Register dependencies
healthChecker.registerDependency('database', commonChecks.database(db), {
  critical: true,
  timeout: 5000
});

if (process.env.REDIS_URL) {
  const redis = require('redis').createClient(process.env.REDIS_URL);
  healthChecker.registerDependency('redis', commonChecks.redis(redis), {
    critical: false,
    timeout: 3000
  });
}

// Middleware para adicionar db e logger ao req
app.use((req, res, next) => {
  req.db = db;
  req.logger = logger;
  next();
});

// Store cache middleware in app locals
app.locals.cacheMiddleware = cacheMiddleware;

// Apply cache middleware to GET requests
app.use(cacheMiddleware.cacheGet());

// Routes with cache invalidation for write operations
app.use('/api/categories', cacheMiddleware.invalidateCache(), require('./routes/categories'));
app.use('/api/products', cacheMiddleware.invalidateCache(), require('./routes/products'));
app.use('/api/variants', cacheMiddleware.invalidateCache(), require('./routes/variants'));
app.use('/api/stock', cacheMiddleware.invalidateCache(), require('./routes/stock'));
app.use('/api/sync', cacheMiddleware.invalidateCache(), require('./routes/sync'));
app.use('/api/analytics', require('./routes/analytics'));

// CDN management routes
app.use('/api/cdn', require('./routes/cdn'));

// Cache administration routes
app.get('/api/cache/stats', cacheMiddleware.getStats.bind(cacheMiddleware));
app.post('/api/cache/invalidate', cacheMiddleware.adminInvalidate());
app.get('/api/cache/health', cacheMiddleware.healthCheck());

// Database performance routes
app.get('/api/db/performance', async (req, res) => {
  try {
    const report = await queryOptimizer.generatePerformanceReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/db/indexes', async (req, res) => {
  try {
    const analysis = await queryOptimizer.analyzeIndexUsage();
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/db/clear-stats', (req, res) => {
  queryOptimizer.clearStats();
  res.json({ message: 'Performance statistics cleared' });
});

// Health check routes
app.get('/health', healthChecker.middleware());
app.get('/health/ready', healthChecker.readinessProbe());
app.get('/health/live', healthChecker.livenessProbe());

// Initialize event publisher for images
const eventPublisher = new EventPublisher();

// Image routes
app.use('/api', createProductImagesRoutes(db, eventPublisher));

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    correlationId: req.headers['x-correlation-id']
  });

  if (error.type === 'validation') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details
    });
  }

  if (error.type === 'not_found') {
    return res.status(404).json({
      error: 'Not Found',
      message: error.message
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 3003;

// Inicializar event listener
let eventListener;
const initializeEventListener = async () => {
  try {
    const eventPublisher = new EventPublisher();
    const productService = new ProductService(db, logger, eventPublisher);
    eventListener = new ProductEventListener(db, logger, productService);
    
    await eventListener.start();
    logger.info('Product event listener initialized');
  } catch (error) {
    logger.error('Failed to initialize event listener', { error: error.message });
  }
};

app.listen(PORT, async () => {
  logger.info(`Product service running on port ${PORT}`);
  
  // Initialize cache service
  try {
    await cacheService.connect();
    logger.info('Cache service connected');
    
    // Warm up cache with popular products (background task)
    setTimeout(async () => {
      try {
        await cacheMiddleware.warmUpCache(db);
        logger.info('Cache warmed up successfully');
      } catch (error) {
        logger.error('Cache warmup failed', { error: error.message });
      }
    }, 5000); // Wait 5 seconds after startup
    
  } catch (error) {
    logger.warn('Cache service not available, running without cache', { error: error.message });
  }
  
  await initializeEventListener();
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    if (eventListener) {
      await eventListener.stop();
    }
    
    // Disconnect cache service
    await cacheService.disconnect();
    logger.info('Cache service disconnected');
    
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
  }
  
  db.destroy(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;