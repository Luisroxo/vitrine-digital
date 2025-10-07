const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Logger, EventPublisher } = require('../../shared');
const { HealthChecker, commonChecks } = require('../../shared/utils/health');
const BillingController = require('./controllers/BillingController');

// Database connection
const knex = require('knex');
const knexConfig = require('../knexfile');

/**
 * Billing Service - Advanced Credit-Based Billing System
 * 
 * Features:
 * - Credit Management (purchase, reservation, consumption)
 * - Payment Processing (PIX, credit cards, bank transfers)
 * - Subscription Management (plans, billing cycles, upgrades/downgrades)
 * - Revenue Analytics (KPIs, forecasting, business intelligence)
 * - Multi-tenant architecture with event-driven communication
 */
class BillingService {
  constructor() {
    this.logger = new Logger('billing-service');
    this.app = express();
    this.port = process.env.PORT || 3005;
    this.healthChecker = new HealthChecker();
    
    // Initialize components
    this.initializeDatabase();
    this.initializeHealthChecks();
    this.initializeMiddleware();
    this.initializeEventSystem();
    this.initializeControllers();
    this.initializeRoutes();
    this.initializeErrorHandling();
    
    this.logger.info('Billing Service initialized successfully');
  }

  /**
   * Initialize database connection
   */
  initializeDatabase() {
    const environment = process.env.NODE_ENV || 'development';
    const config = knexConfig[environment];
    
    this.db = knex(config);
    
    this.logger.info('Database connection initialized', {
      environment,
      database: config.connection.database
    });
  }

  /**
   * Initialize health checks
   */
  initializeHealthChecks() {
    // Register health checks
    this.healthChecker.registerCheck('memory', commonChecks.memory(0.9));
    this.healthChecker.registerCheck('environment', commonChecks.environment([
      'DATABASE_URL'
    ]));

    // Check subscription status as business metric
    this.healthChecker.registerCheck('subscriptions', async () => {
      try {
        const activeCount = await this.db('subscriptions')
          .where('status', 'active')
          .count('id as count')
          .first();
        
        const totalCount = await this.db('subscriptions')
          .count('id as count')
          .first();
        
        return {
          active: parseInt(activeCount?.count || 0),
          total: parseInt(totalCount?.count || 0)
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Register dependencies
    this.healthChecker.registerDependency('database', commonChecks.database(this.db), {
      critical: true,
      timeout: 5000
    });

    // Check payment processor connectivity if configured
    if (process.env.STRIPE_SECRET_KEY) {
      this.healthChecker.registerDependency('stripe', async () => {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.accounts.retrieve();
        return { connected: true };
      }, {
        critical: true,
        timeout: 8000
      });
    }
  }

  /**
   * Initialize middleware
   */
  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 100 : 1000,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        tenantId: req.headers['x-tenant-id']
      });
      
      next();
    });

    this.logger.info('Middleware initialized');
  }

  /**
   * Initialize event system
   */
  initializeEventSystem() {
    this.eventPublisher = new EventPublisher({
      service: 'billing-service',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });

    this.logger.info('Event system initialized');
  }

  /**
   * Initialize controllers
   */
  initializeControllers() {
    this.billingController = new BillingController(this.db, this.eventPublisher);
    
    this.logger.info('Controllers initialized');
  }

  /**
   * Initialize routes
   */
  initializeRoutes() {
    // Health check routes
    this.app.get('/health', this.healthChecker.middleware());
    this.app.get('/health/ready', this.healthChecker.readinessProbe());
    this.app.get('/health/live', this.healthChecker.livenessProbe());

    // System statistics
    this.app.get('/stats', (req, res) => {
      this.billingController.getSystemStats(req, res);
    });

    // Credit Management Routes
    this.app.get('/credits/balance/:tenantId', (req, res) => {
      this.billingController.getCreditBalance(req, res);
    });

    this.app.post('/credits/purchase', (req, res) => {
      this.billingController.purchaseCredits(req, res);
    });

    this.app.post('/credits/reserve', (req, res) => {
      this.billingController.reserveCredits(req, res);
    });

    this.app.post('/credits/consume', (req, res) => {
      this.billingController.consumeCredits(req, res);
    });

    this.app.get('/credits/transactions/:tenantId', (req, res) => {
      this.billingController.getCreditTransactions(req, res);
    });

    // Payment Processing Routes
    this.app.post('/payments/process', (req, res) => {
      this.billingController.processPayment(req, res);
    });

    this.app.get('/payments/status/:paymentId', (req, res) => {
      this.billingController.getPaymentStatus(req, res);
    });

    this.app.post('/payments/refund', (req, res) => {
      this.billingController.processRefund(req, res);
    });

    this.app.post('/payments/webhook/:provider', (req, res) => {
      this.billingController.handlePaymentWebhook(req, res);
    });

    // Subscription Management Routes
    this.app.get('/subscriptions/plans', (req, res) => {
      this.billingController.getSubscriptionPlans(req, res);
    });

    this.app.post('/subscriptions/create', (req, res) => {
      this.billingController.createSubscription(req, res);
    });

    this.app.get('/subscriptions/:tenantId', (req, res) => {
      this.billingController.getSubscription(req, res);
    });

    this.app.put('/subscriptions/:subscriptionId/plan', (req, res) => {
      this.billingController.changePlan(req, res);
    });

    this.app.delete('/subscriptions/:subscriptionId', (req, res) => {
      this.billingController.cancelSubscription(req, res);
    });

    // Analytics Routes
    this.app.get('/analytics/revenue', (req, res) => {
      this.billingController.getRevenueAnalytics(req, res);
    });

    this.app.get('/analytics/kpis', (req, res) => {
      this.billingController.getKPIs(req, res);
    });

    this.app.get('/analytics/dashboard', (req, res) => {
      this.billingController.getDashboard(req, res);
    });

    // API Documentation
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Billing Service',
        version: '1.0.0',
        description: 'Advanced credit-based billing system with subscription management and revenue analytics',
        features: [
          'Credit Management',
          'Payment Processing (PIX, Cards)',
          'Subscription Management',
          'Revenue Analytics & BI',
          'Multi-tenant Support',
          'Event-driven Architecture'
        ],
        endpoints: {
          credits: [
            'GET /credits/balance/:tenantId',
            'POST /credits/purchase',
            'POST /credits/reserve',
            'POST /credits/consume',
            'GET /credits/transactions/:tenantId'
          ],
          payments: [
            'POST /payments/process',
            'GET /payments/status/:paymentId',
            'POST /payments/refund',
            'POST /payments/webhook/:provider'
          ],
          subscriptions: [
            'GET /subscriptions/plans',
            'POST /subscriptions/create',
            'GET /subscriptions/:tenantId',
            'PUT /subscriptions/:subscriptionId/plan',
            'DELETE /subscriptions/:subscriptionId'
          ],
          analytics: [
            'GET /analytics/revenue',
            'GET /analytics/kpis',
            'GET /analytics/dashboard'
          ],
          system: [
            'GET /health',
            'GET /stats'
          ]
        },
        documentation: 'https://docs.vitrinedigital.com/billing-service',
        timestamp: new Date()
      });
    });

    this.logger.info('Routes initialized');
  }

  /**
   * Initialize error handling
   */
  initializeErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          '/health',
          '/stats',
          '/credits/*',
          '/payments/*',
          '/subscriptions/*',
          '/analytics/*'
        ]
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        body: req.body,
        headers: req.headers
      });

      res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        ...(process.env.NODE_ENV !== 'production' && {
          stack: error.stack
        })
      });
    });

    this.logger.info('Error handling initialized');
  }

  /**
   * Start the service
   */
  async start() {
    try {
      // Run database migrations
      await this.runMigrations();

      // Start server
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Billing Service started successfully`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date()
        });
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    } catch (error) {
      this.logger.error('Failed to start Billing Service', {
        error: error.message,
        stack: error.stack
      });
      
      process.exit(1);
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    try {
      this.logger.info('Running database migrations...');
      
      await this.db.migrate.latest();
      
      this.logger.info('Database migrations completed successfully');

    } catch (error) {
      this.logger.error('Database migration failed', {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    this.logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        this.logger.info('HTTP server closed');
      }

      // Close database connection
      if (this.db) {
        await this.db.destroy();
        this.logger.info('Database connection closed');
      }

      // Close event publisher
      if (this.eventPublisher) {
        await this.eventPublisher.disconnect();
        this.logger.info('Event publisher disconnected');
      }

      this.logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      this.logger.error('Error during graceful shutdown', {
        error: error.message,
        stack: error.stack
      });
      
      process.exit(1);
    }
  }
}

// Start service if called directly
if (require.main === module) {
  const service = new BillingService();
  service.start();
}

module.exports = BillingService;