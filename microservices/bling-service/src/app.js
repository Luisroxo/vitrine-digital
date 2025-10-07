const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Logger } = require('../../../shared');
const database = require('./database/connection');
const BlingService = require('./services/BlingService');

const app = express();
const logger = new Logger('bling-app');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Initialize Bling Service
let blingService;

// Health check route
app.get('/', (req, res) => {
  res.json({
    service: 'Bling Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'bling-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected' // This could be checked properly
  });
});

// OAuth2 Authentication Routes
app.get('/auth/authorize', async (req, res) => {
  try {
    const { tenantId, redirectUri } = req.query;
    
    if (!tenantId || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required parameters: tenantId, redirectUri'
      });
    }

    const authUrl = blingService.generateAuthorizationUrl(
      parseInt(tenantId),
      redirectUri
    );

    res.json({ authUrl });

  } catch (error) {
    logger.error('Failed to generate auth URL', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/token', async (req, res) => {
  try {
    const { code, tenantId, redirectUri } = req.body;
    
    if (!code || !tenantId || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required fields: code, tenantId, redirectUri'
      });
    }

    const result = await blingService.exchangeCodeForToken(
      code,
      parseInt(tenantId),
      redirectUri
    );

    res.json(result);

  } catch (error) {
    logger.error('Token exchange failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Token Management Routes
app.post('/tokens', async (req, res) => {
  try {
    const { tenantId, accessToken, refreshToken, expiresIn } = req.body;
    
    if (!tenantId || !accessToken || !refreshToken) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, accessToken, refreshToken'
      });
    }

    await blingService.tokenManager.storeTokens(parseInt(tenantId), {
      accessToken,
      refreshToken,
      expiresIn
    });

    res.status(201).json({ success: true });

  } catch (error) {
    logger.error('Token storage failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/tokens/:tenantId/status', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tokenInfo = await blingService.tokenManager.getTokenInfo(
      parseInt(tenantId)
    );

    res.json(tokenInfo);

  } catch (error) {
    logger.error('Token status check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Order Management Routes
app.post('/orders', async (req, res) => {
  try {
    const { tenantId, orderData } = req.body;
    
    if (!tenantId || !orderData) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, orderData'
      });
    }

    const result = await blingService.createOrder(
      parseInt(tenantId),
      orderData
    );

    res.status(201).json(result);

  } catch (error) {
    logger.error('Order creation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.put('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenantId, ...updateData } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.updateOrder(
      parseInt(tenantId),
      orderId,
      updateData
    );

    res.json(result);

  } catch (error) {
    logger.error('Order update failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenantId, reason } = req.body;
    
    if (!tenantId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, reason'
      });
    }

    const result = await blingService.cancelOrder(
      parseInt(tenantId),
      orderId,
      reason
    );

    res.json(result);

  } catch (error) {
    logger.error('Order cancellation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:orderId/tracking', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required parameter: tenantId'
      });
    }

    const result = await blingService.getOrderTracking(
      parseInt(tenantId),
      orderId
    );

    res.json(result);

  } catch (error) {
    logger.error('Order tracking failed', { error: error.message });
    res.status(404).json({ error: error.message });
  }
});

app.post('/orders/bulk', async (req, res) => {
  try {
    const { tenantId, orders } = req.body;
    
    if (!tenantId || !Array.isArray(orders)) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, orders (array)'
      });
    }

    const results = [];
    
    for (const orderOperation of orders) {
      try {
        let result;
        switch (orderOperation.action) {
          case 'update':
            result = await blingService.updateOrder(
              parseInt(tenantId),
              orderOperation.orderId,
              orderOperation.data
            );
            break;
          case 'cancel':
            result = await blingService.cancelOrder(
              parseInt(tenantId),
              orderOperation.orderId,
              orderOperation.data.reason
            );
            break;
          default:
            result = { success: false, error: 'Unknown action' };
        }
        
        results.push({
          orderId: orderOperation.orderId,
          action: orderOperation.action,
          ...result
        });

      } catch (error) {
        results.push({
          orderId: orderOperation.orderId,
          action: orderOperation.action,
          success: false,
          error: error.message
        });
      }
    }

    res.json({ results });

  } catch (error) {
    logger.error('Bulk order operation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Webhook Routes
app.post('/webhooks', async (req, res) => {
  try {
    const result = await blingService.processWebhook(req);
    res.json(result);

  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    
    if (error.message.includes('signature')) {
      res.status(401).json({ error: error.message });
    } else if (error.message.includes('old')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/webhooks/retry', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    const result = await blingService.retryFailedWebhooks(limit);
    res.json(result);

  } catch (error) {
    logger.error('Webhook retry failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/webhooks/stats', async (req, res) => {
  try {
    const { tenantId, days = 7 } = req.query;
    const stats = await blingService.getWebhookStats(
      tenantId ? parseInt(tenantId) : null,
      parseInt(days)
    );
    res.json(stats);

  } catch (error) {
    logger.error('Webhook stats failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Event Processing Routes
app.post('/events/process', async (req, res) => {
  try {
    const { eventType, eventData, options = {} } = req.body;
    
    if (!eventType || !eventData) {
      return res.status(400).json({
        error: 'Missing required fields: eventType, eventData'
      });
    }

    const result = await blingService.eventProcessor.processEvent(
      eventType,
      eventData,
      options
    );

    res.json(result);

  } catch (error) {
    logger.error('Event processing failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/events/statistics', async (req, res) => {
  try {
    const stats = blingService.eventProcessor.getStatistics();
    res.json(stats);

  } catch (error) {
    logger.error('Event statistics failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/events/history', async (req, res) => {
  try {
    const { tenantId, limit = 100 } = req.query;
    const history = await blingService.eventProcessor.getEventHistory(
      tenantId ? parseInt(tenantId) : null,
      parseInt(limit)
    );
    res.json(history);

  } catch (error) {
    logger.error('Event history failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Job Management Routes
app.post('/jobs/queue', async (req, res) => {
  try {
    const { jobType, jobData, options = {} } = req.body;
    
    if (!jobType || !jobData) {
      return res.status(400).json({
        error: 'Missing required fields: jobType, jobData'
      });
    }

    const result = await blingService.jobManager.queueJob(
      jobType,
      jobData,
      options
    );

    res.status(201).json(result);

  } catch (error) {
    logger.error('Job queue failed', { error: error.message });
    
    if (error.message.includes('Unsupported job type')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await blingService.getJobStatus(jobId);
    res.json(status);

  } catch (error) {
    logger.error('Job status check failed', { error: error.message });
    res.status(404).json({ error: error.message });
  }
});

app.get('/jobs/statistics', async (req, res) => {
  try {
    const stats = blingService.jobManager.getManagerStatistics();
    res.json(stats);

  } catch (error) {
    logger.error('Job statistics failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/jobs/history', async (req, res) => {
  try {
    const { tenantId, limit = 50 } = req.query;
    const history = await blingService.jobManager.getJobHistory(
      tenantId ? parseInt(tenantId) : null,
      parseInt(limit)
    );
    res.json(history);

  } catch (error) {
    logger.error('Job history failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Synchronization Routes
app.post('/sync/products', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.syncProducts(parseInt(tenantId));
    res.json(result);

  } catch (error) {
    logger.error('Product sync failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/sync/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.syncSingleProduct(
      parseInt(tenantId),
      productId
    );
    res.json(result);

  } catch (error) {
    logger.error('Single product sync failed', { error: error.message });
    res.status(404).json({ error: error.message });
  }
});

app.post('/sync/orders', async (req, res) => {
  try {
    const { tenantId, days = 30 } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.syncRecentOrders(
      parseInt(tenantId),
      parseInt(days)
    );
    res.json(result);

  } catch (error) {
    logger.error('Order sync failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/sync/orders/range', async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.body;
    
    if (!tenantId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, startDate, endDate'
      });
    }

    const result = await blingService.syncOrdersByDateRange(
      parseInt(tenantId),
      {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    );
    res.json(result);

  } catch (error) {
    logger.error('Order range sync failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/sync/stock', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.syncStock(parseInt(tenantId));
    res.json(result);

  } catch (error) {
    logger.error('Stock sync failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.put('/products/:productId/stock', async (req, res) => {
  try {
    const { productId } = req.params;
    const { tenantId, newStock } = req.body;
    
    if (!tenantId || newStock === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, newStock'
      });
    }

    // Update stock in database
    await database('bling_products')
      .where({
        tenant_id: parseInt(tenantId),
        bling_product_id: productId
      })
      .update({
        stock: parseInt(newStock),
        stock_updated_at: new Date(),
        updated_at: new Date()
      });

    res.json({ success: true });

  } catch (error) {
    logger.error('Stock update failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/sync/full', async (req, res) => {
  try {
    const { tenantId, background = false } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Missing required field: tenantId'
      });
    }

    const result = await blingService.fullSync(
      parseInt(tenantId),
      { background }
    );

    if (background) {
      res.status(202).json(result);
    } else {
      res.json(result);
    }

  } catch (error) {
    logger.error('Full sync failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Statistics and Health Routes
app.get('/statistics', async (req, res) => {
  try {
    const stats = blingService.getServiceStatistics();
    res.json(stats);

  } catch (error) {
    logger.error('Statistics retrieval failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/tenants/:tenantId/sync-status', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const status = await blingService.getTenantSyncStatus(parseInt(tenantId));
    res.json(status);

  } catch (error) {
    logger.error('Sync status retrieval failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/health/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const health = await blingService.getIntegrationHealth(parseInt(tenantId));
    res.json(health);

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path
  });

  res.status(error.status || 500).json({
    error: error.message || 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Initialize service when module is loaded
const initializeService = async () => {
  try {
    blingService = new BlingService(database);
    await blingService.initialize();
    logger.info('Bling service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Bling service', {
      error: error.message
    });
    process.exit(1);
  }
};

// Only initialize if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeService();
} else {
  // For tests, create a mock service
  blingService = {
    generateAuthorizationUrl: () => 'http://mock-auth-url',
    exchangeCodeForToken: () => ({ success: true, tenantId: 1 }),
    tokenManager: {
      storeTokens: () => Promise.resolve(),
      getTokenInfo: () => Promise.resolve({ needsRefresh: true })
    },
    createOrder: () => Promise.resolve({ success: true, blingOrderId: 'BO-123' }),
    updateOrder: () => Promise.resolve({ success: true }),
    cancelOrder: () => Promise.resolve({ success: true }),
    getOrderTracking: () => Promise.resolve({ trackingCode: 'BR123456789', status: 'Enviado' }),
    processWebhook: () => Promise.resolve({ success: true, webhookId: 'wh-123' }),
    retryFailedWebhooks: () => Promise.resolve({ processed: 1 }),
    getWebhookStats: () => Promise.resolve({ total: 2, byStatus: {} }),
    eventProcessor: {
      processEvent: () => Promise.resolve({ eventId: 'evt-123', queued: true, queuePosition: 1 }),
      getStatistics: () => ({ failedCount: 0 }),
      getEventHistory: () => Promise.resolve([])
    },
    jobManager: {
      queueJob: () => Promise.resolve({ jobId: 'job-123', status: 'queued' }),
      getManagerStatistics: () => ({ queueLength: 0, completedJobs: 0, supportedJobTypes: [] }),
      getJobHistory: () => Promise.resolve([])
    },
    getJobStatus: () => Promise.resolve({ id: 'job-123', status: 'queued' }),
    syncProducts: () => Promise.resolve({ synced: 10, total: 10 }),
    syncSingleProduct: () => Promise.resolve({ success: true, productId: '12345' }),
    syncRecentOrders: () => Promise.resolve({ synced: 5, total: 5 }),
    syncOrdersByDateRange: () => Promise.resolve({ synced: 3, total: 3 }),
    syncStock: () => Promise.resolve({ synced: 8, total: 8 }),
    fullSync: () => Promise.resolve({ products: { synced: 10 }, orders: { synced: 5 }, stock: { synced: 8 }, totalTime: 30000 }),
    getServiceStatistics: () => ({ totalRequests: 100, successfulRequests: 95, tokenManager: {}, orderManager: {} }),
    getTenantSyncStatus: () => Promise.resolve([]),
    getIntegrationHealth: () => Promise.resolve({ tenant: 1, status: 'healthy', checks: {} })
  };
}

module.exports = app;