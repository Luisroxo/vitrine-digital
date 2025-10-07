const express = require('express');
const cors = require('cors');
const knex = require('knex');
const config = require('./config/database');
const { Logger } = require('../../shared');

const app = express();

// Configurar logger
const logger = new Logger('product-service');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
const db = knex(config);

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

// Health check
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await db.raw('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'product-service',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      service: 'product-service',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

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

app.listen(PORT, () => {
  logger.info(`Product service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  db.destroy(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  db.destroy(() => {
    process.exit(0);
  });
});

module.exports = app;