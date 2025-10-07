const express = require('express');
const cors = require('cors');
const knex = require('knex');
const config = require('./config/database');
const { Logger, EventPublisher } = require('../../shared');
const { HealthChecker, commonChecks } = require('../../shared/utils/health');
const ProductService = require('./services/ProductService');
const ProductEventListener = require('./services/ProductEventListener');

const app = express();

// Configurar logger
const logger = new Logger('product-service');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
const db = knex(config);

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

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/variants', require('./routes/variants'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check routes
app.get('/health', healthChecker.middleware());
app.get('/health/ready', healthChecker.readinessProbe());
app.get('/health/live', healthChecker.livenessProbe());

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
  await initializeEventListener();
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    if (eventListener) {
      await eventListener.stop();
    }
  } catch (error) {
    logger.error('Error stopping event listener', { error: error.message });
  }
  
  db.destroy(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;