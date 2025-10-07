require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { Logger, ErrorHandler } = require('../shared');
const { HealthChecker, commonChecks } = require('../../shared/utils/health');
const EnhancedBlingPriceSyncService = require('./services/EnhancedBlingPriceSyncService');
const enhancedPriceSyncRoutes = require('./routes/enhancedPriceSyncRoutes');
const priceSyncRoutes = require('./routes/priceSyncRoutes');

class BlingService {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.logger = new Logger('bling-service');
    this.healthChecker = new HealthChecker();
    
    this.setupDatabase();
    this.setupHealthChecks();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupDatabase() {
    // Inicializar conexão com banco de dados
    this.db = require('knex')(require('../knexfile'));
    this.logger.info('Database connection initialized');
    
    // Initialize Enhanced Price Sync Service
    this.setupEnhancedPriceSyncService();
  }

  async setupEnhancedPriceSyncService() {
    try {
      this.enhancedPriceSyncService = new EnhancedBlingPriceSyncService(
        this.db, 
        null, // BlingService will be passed later
        null  // EventPublisher will be initialized
      );
      
      await this.enhancedPriceSyncService.initialize();
      
      // Make service available to routes
      this.app.locals.enhancedPriceSyncService = this.enhancedPriceSyncService;
      
      this.logger.info('Enhanced Price Sync Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Price Sync Service:', error);
    }
  }

  setupHealthChecks() {
    // Configurar health checks específicos do Bling Service
    this.healthChecker.addCheck('database', async () => {
      try {
        await this.db.raw('SELECT 1');
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });

    this.healthChecker.addCheck('bling_api', async () => {
      try {
        // Verificar conectividade com API do Bling
        const response = await require('axios').get('https://bling.com.br/Api/v2/', {
          timeout: 5000,
          headers: { 'User-Agent': 'Vitrine-Digital/1.0' }
        });
        return { 
          status: 'healthy', 
          response_time: response.headers['x-response-time'] || 'N/A'
        };
      } catch (error) {
        return { 
          status: 'unhealthy', 
          error: error.message,
          code: error.code 
        };
      }
    });

    this.healthChecker.addBusinessMetric('integrations_active', async () => {
      try {
        const result = await this.db('bling_tokens')
          .where('is_active', true)
          .count('* as count')
          .first();
        return parseInt(result.count);
      } catch (error) {
        this.logger.error('Error getting active integrations count:', error);
        return 0;
      }
    });

    this.healthChecker.addBusinessMetric('sync_status', async () => {
      try {
        const lastSync = await this.db('sync_logs')
          .orderBy('created_at', 'desc')
          .first();
        
        if (!lastSync) return { status: 'no_sync_yet' };
        
        const hoursSinceSync = (Date.now() - new Date(lastSync.created_at)) / (1000 * 60 * 60);
        return {
          status: hoursSinceSync < 24 ? 'recent' : 'stale',
          last_sync: lastSync.created_at,
          hours_ago: Math.round(hoursSinceSync)
        };
      } catch (error) {
        this.logger.error('Error getting sync status:', error);
        return { status: 'error', error: error.message };
      }
    });

    this.logger.info('Health checks configured for Bling Service');
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API service
    }));
    
    // Compression
    this.app.use(compression());
    
    // CORS
    this.app.use(cors({
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-correlation-id']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT_MAX || 1000,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      req.correlationId = req.get('x-correlation-id') || 
                         req.get('X-Correlation-ID') || 
                         Math.random().toString(36).substr(2, 9);
      
      res.set('X-Correlation-ID', req.correlationId);
      
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        this.logger.info('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          correlationId: req.correlationId,
          userAgent: req.get('User-Agent'),
          tenantId: req.user?.tenantId
        });
      });
      
      next();
    });
  }

  setupRoutes() {
    // Health check routes
    this.app.get('/health', this.healthChecker.getHealthCheck());
    this.app.get('/health/ready', this.healthChecker.getReadinessCheck());
    this.app.get('/health/live', this.healthChecker.getLivenessCheck());
    
    // API routes
    this.app.use('/api/bling', routes);
    
    // Enhanced Price Sync routes
    this.app.use('/api/bling/price-sync', enhancedPriceSyncRoutes);
    
    // Price Sync routes v2.0
    this.app.use('/api/bling/sync', priceSyncRoutes);
    
    // Root health check
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Bling Integration Service',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      this.logger.warn('Route not found', {
        method: req.method,
        path: req.path,
        correlationId: req.correlationId
      });
      
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        correlationId: req.correlationId,
        path: req.path,
        method: req.method
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        correlationId: req.correlationId,
        ...(isDevelopment && { stack: err.stack })
      });
    });
  }

  async start() {
    try {
      // Test database connection
      const db = require('./database/connection');
      await db.raw('SELECT 1');
      this.logger.info('Database connection verified');

      // Start server
      this.server = this.app.listen(this.port, () => {
        this.logger.logStartup(this.port, process.env.NODE_ENV);
        console.log(`
🚀 Bling Service started successfully!
📊 Port: ${this.port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📈 Health: http://localhost:${this.port}/health
🔗 API Base: http://localhost:${this.port}/api/bling

📋 Available Endpoints:
├── GET    /health                    - Health check
├── GET    /api/bling/auth/url        - Get OAuth URL
├── GET    /api/bling/auth/callback   - OAuth callback
├── POST   /api/bling/connections     - Create connection
├── GET    /api/bling/connections     - List connections
├── GET    /api/bling/dashboard       - Dashboard data
├── POST   /api/bling/sync/:type      - Start sync
└── POST   /api/bling/webhooks/:id    - Webhook endpoint
        `);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      this.logger.error('Failed to start service', { error: error.message });
      process.exit(1);
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Bling Service...');
    
    if (this.server) {
      this.server.close(() => {
        this.logger.info('Bling Service stopped');
        process.exit(0);
      });
    }
  }
}

module.exports = BlingService;