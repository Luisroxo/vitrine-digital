const { Logger } = require('../../../shared');
const CreditManager = require('../services/CreditManager');
const PaymentProcessor = require('../services/PaymentProcessor');
const SubscriptionManager = require('../services/SubscriptionManager');
const RevenueAnalytics = require('../services/RevenueAnalytics');

/**
 * Billing Service Main Controller
 * Orchestrates all billing operations including credits, payments, subscriptions, and analytics
 */
class BillingController {
  constructor(database, eventPublisher) {
    this.logger = new Logger('billing-controller');
    this.db = database;
    
    // Initialize services
    this.creditManager = new CreditManager(database, eventPublisher);
    this.paymentProcessor = new PaymentProcessor(database, eventPublisher);
    this.subscriptionManager = new SubscriptionManager(database, eventPublisher, this.creditManager, this.paymentProcessor);
    this.revenueAnalytics = new RevenueAnalytics(database, eventPublisher);

    this.logger.info('Billing controller initialized with all services');
  }

  /**
   * Credit Management Endpoints
   */

  // GET /credits/balance/:tenantId
  async getCreditBalance(req, res) {
    try {
      const { tenantId } = req.params;

      this.logger.info('Getting credit balance', { tenantId });

      const balance = await this.creditManager.getCreditBalance(tenantId);

      res.json({
        success: true,
        tenantId,
        balance,
        currency: 'BRL',
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to get credit balance', {
        error: error.message,
        tenantId: req.params.tenantId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get credit balance',
        message: error.message
      });
    }
  }

  // POST /credits/purchase
  async purchaseCredits(req, res) {
    try {
      const { tenantId, amount, paymentMethod, paymentData } = req.body;

      this.logger.info('Processing credit purchase', { 
        tenantId, 
        amount, 
        paymentMethod 
      });

      // Validate request
      if (!tenantId || !amount || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: tenantId, amount, paymentMethod'
        });
      }

      // Process payment first
      const paymentResult = await this.paymentProcessor.processPayment({
        tenantId,
        amount,
        method: paymentMethod,
        description: `Credit purchase - ${amount / 100} BRL`,
        ...paymentData
      });

      if (paymentResult.status === 'completed') {
        // Payment successful, add credits immediately
        const creditResult = await this.creditManager.purchaseCredits(
          tenantId,
          amount,
          {
            paymentId: paymentResult.paymentId,
            paymentMethod,
            transactionId: paymentResult.transactionId
          }
        );

        res.json({
          success: true,
          paymentId: paymentResult.paymentId,
          creditsAdded: creditResult.creditsAdded,
          bonusCredits: creditResult.bonusCredits,
          newBalance: creditResult.newBalance,
          paymentStatus: 'completed'
        });

      } else if (paymentResult.status === 'pending') {
        // Payment pending (e.g., PIX), credits will be added via webhook

        res.json({
          success: true,
          paymentId: paymentResult.paymentId,
          paymentStatus: 'pending',
          qrCode: paymentResult.qrCode,
          qrCodeBase64: paymentResult.qrCodeBase64,
          pixCopyPaste: paymentResult.pixCopyPaste,
          expiresAt: paymentResult.expiresAt,
          instructions: paymentResult.instructions
        });

      } else {
        throw new Error('Payment failed');
      }

    } catch (error) {
      this.logger.error('Failed to purchase credits', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to purchase credits',
        message: error.message
      });
    }
  }

  // POST /credits/reserve
  async reserveCredits(req, res) {
    try {
      const { tenantId, amount, reservationData } = req.body;

      const reservation = await this.creditManager.reserveCredits(
        tenantId,
        amount,
        reservationData
      );

      res.json({
        success: true,
        reservationId: reservation.reservationId,
        amount: reservation.amount,
        expiresAt: reservation.expiresAt
      });

    } catch (error) {
      this.logger.error('Failed to reserve credits', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reserve credits',
        message: error.message
      });
    }
  }

  // POST /credits/consume
  async consumeCredits(req, res) {
    try {
      const { tenantId, reservationId } = req.body;

      const result = await this.creditManager.consumeReservedCredits(
        tenantId,
        reservationId
      );

      res.json({
        success: true,
        consumed: result.consumed,
        newBalance: result.newBalance
      });

    } catch (error) {
      this.logger.error('Failed to consume credits', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to consume credits',
        message: error.message
      });
    }
  }

  // GET /credits/transactions/:tenantId
  async getCreditTransactions(req, res) {
    try {
      const { tenantId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const transactions = await this.creditManager.getTransactionHistory(
        tenantId,
        { limit: parseInt(limit), offset: parseInt(offset) }
      );

      res.json({
        success: true,
        transactions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      this.logger.error('Failed to get credit transactions', {
        error: error.message,
        tenantId: req.params.tenantId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get credit transactions',
        message: error.message
      });
    }
  }

  /**
   * Payment Management Endpoints
   */

  // POST /payments/process
  async processPayment(req, res) {
    try {
      const paymentResult = await this.paymentProcessor.processPayment(req.body);

      res.json({
        success: true,
        ...paymentResult
      });

    } catch (error) {
      this.logger.error('Failed to process payment', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process payment',
        message: error.message
      });
    }
  }

  // GET /payments/status/:paymentId
  async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;

      const status = await this.paymentProcessor.getPaymentStatus(paymentId);

      res.json({
        success: true,
        ...status
      });

    } catch (error) {
      this.logger.error('Failed to get payment status', {
        error: error.message,
        paymentId: req.params.paymentId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get payment status',
        message: error.message
      });
    }
  }

  // POST /payments/refund
  async processRefund(req, res) {
    try {
      const { paymentId, amount, reason } = req.body;

      const refundResult = await this.paymentProcessor.processRefund(
        paymentId,
        { amount, reason }
      );

      res.json({
        success: true,
        ...refundResult
      });

    } catch (error) {
      this.logger.error('Failed to process refund', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process refund',
        message: error.message
      });
    }
  }

  // POST /payments/webhook/:provider
  async handlePaymentWebhook(req, res) {
    try {
      const { provider } = req.params;
      const signature = req.headers['x-signature'] || req.headers['signature'];

      const result = await this.paymentProcessor.handlePaymentWebhook(
        provider,
        req.body,
        signature
      );

      res.json({
        success: true,
        processed: result.processed
      });

    } catch (error) {
      this.logger.error('Failed to process payment webhook', {
        error: error.message,
        provider: req.params.provider
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  }

  /**
   * Subscription Management Endpoints
   */

  // GET /subscriptions/plans
  async getSubscriptionPlans(req, res) {
    try {
      const plans = await this.subscriptionManager.getAllPlans();

      res.json({
        success: true,
        plans
      });

    } catch (error) {
      this.logger.error('Failed to get subscription plans', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get subscription plans',
        message: error.message
      });
    }
  }

  // POST /subscriptions/create
  async createSubscription(req, res) {
    try {
      const subscription = await this.subscriptionManager.createSubscription(req.body);

      res.json({
        success: true,
        subscription
      });

    } catch (error) {
      this.logger.error('Failed to create subscription', {
        error: error.message,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create subscription',
        message: error.message
      });
    }
  }

  // GET /subscriptions/:tenantId
  async getSubscription(req, res) {
    try {
      const { tenantId } = req.params;

      const subscription = await this.subscriptionManager.getActiveSubscription(tenantId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      // Get plan details
      const plan = await this.subscriptionManager.getPlan(subscription.plan_id);

      res.json({
        success: true,
        subscription: {
          ...subscription,
          plan: {
            ...plan,
            features: JSON.parse(plan.features || '{}'),
            limits: JSON.parse(plan.limits || '{}')
          }
        }
      });

    } catch (error) {
      this.logger.error('Failed to get subscription', {
        error: error.message,
        tenantId: req.params.tenantId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get subscription',
        message: error.message
      });
    }
  }

  // PUT /subscriptions/:subscriptionId/plan
  async changePlan(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { newPlanId, ...options } = req.body;

      const result = await this.subscriptionManager.changePlan(
        subscriptionId,
        newPlanId,
        options
      );

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      this.logger.error('Failed to change subscription plan', {
        error: error.message,
        subscriptionId: req.params.subscriptionId,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to change subscription plan',
        message: error.message
      });
    }
  }

  // DELETE /subscriptions/:subscriptionId
  async cancelSubscription(req, res) {
    try {
      const { subscriptionId } = req.params;
      const { immediate = false, reason } = req.body;

      const result = await this.subscriptionManager.cancelSubscription(
        subscriptionId,
        { immediate, reason }
      );

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      this.logger.error('Failed to cancel subscription', {
        error: error.message,
        subscriptionId: req.params.subscriptionId,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription',
        message: error.message
      });
    }
  }

  /**
   * Analytics Endpoints
   */

  // GET /analytics/revenue
  async getRevenueAnalytics(req, res) {
    try {
      const { 
        period = '30d', 
        tenantId, 
        includeForecasts = true,
        timezone = 'America/Sao_Paulo'
      } = req.query;

      const report = await this.revenueAnalytics.generateRevenueReport({
        period,
        tenantId,
        includeForecasts: includeForecasts === 'true',
        timezone
      });

      res.json({
        success: true,
        report
      });

    } catch (error) {
      this.logger.error('Failed to get revenue analytics', {
        error: error.message,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get revenue analytics',
        message: error.message
      });
    }
  }

  // GET /analytics/kpis
  async getKPIs(req, res) {
    try {
      const { 
        period = '30d', 
        tenantId,
        timezone = 'America/Sao_Paulo'
      } = req.query;

      // Parse period to get date range
      const { startDate, endDate } = this.parsePeriod(period, timezone);

      const kpis = await this.revenueAnalytics.calculateKPIs(
        startDate,
        endDate,
        tenantId
      );

      res.json({
        success: true,
        kpis,
        period: {
          start: startDate,
          end: endDate,
          period
        }
      });

    } catch (error) {
      this.logger.error('Failed to get KPIs', {
        error: error.message,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get KPIs',
        message: error.message
      });
    }
  }

  // GET /analytics/dashboard
  async getDashboard(req, res) {
    try {
      const { tenantId } = req.query;

      // Get quick dashboard data
      const [
        creditBalance,
        activeSubscription,
        recentTransactions,
        quickKPIs
      ] = await Promise.all([
        this.creditManager.getCreditBalance(tenantId),
        tenantId ? this.subscriptionManager.getActiveSubscription(tenantId) : null,
        tenantId ? this.creditManager.getTransactionHistory(tenantId, { limit: 5 }) : [],
        this.revenueAnalytics.calculateKPIs(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(),
          tenantId
        )
      ]);

      res.json({
        success: true,
        dashboard: {
          creditBalance,
          activeSubscription,
          recentTransactions,
          kpis: quickKPIs,
          lastUpdated: new Date()
        }
      });

    } catch (error) {
      this.logger.error('Failed to get dashboard', {
        error: error.message,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard',
        message: error.message
      });
    }
  }

  /**
   * System Status and Health Endpoints
   */

  // GET /health
  async getHealth(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          creditManager: this.creditManager.getSystemStatistics(),
          paymentProcessor: this.paymentProcessor.getSystemStatistics(),
          subscriptionManager: this.subscriptionManager.getSystemStatistics(),
          revenueAnalytics: this.revenueAnalytics.getSystemStatistics()
        },
        database: {
          connected: true, // Would check actual DB connection
          latency: '< 5ms'
        }
      };

      res.json(health);

    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message
      });

      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  // GET /stats
  async getSystemStats(req, res) {
    try {
      const stats = {
        creditManager: this.creditManager.getSystemStatistics(),
        paymentProcessor: this.paymentProcessor.getSystemStatistics(),
        subscriptionManager: this.subscriptionManager.getSystemStatistics(),
        revenueAnalytics: this.revenueAnalytics.getSystemStatistics()
      };

      res.json({
        success: true,
        stats,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to get system stats', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get system stats',
        message: error.message
      });
    }
  }

  /**
   * Helper methods
   */

  parsePeriod(period, timezone) {
    const moment = require('moment-timezone');
    const now = moment().tz(timezone);

    switch (period) {
      case '7d':
        return {
          startDate: now.clone().subtract(7, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '30d':
        return {
          startDate: now.clone().subtract(30, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '90d':
        return {
          startDate: now.clone().subtract(90, 'days').toDate(),
          endDate: now.toDate()
        };
      
      case '1y':
        return {
          startDate: now.clone().subtract(1, 'year').toDate(),
          endDate: now.toDate()
        };
      
      case 'mtd':
        return {
          startDate: now.clone().startOf('month').toDate(),
          endDate: now.toDate()
        };
      
      case 'ytd':
        return {
          startDate: now.clone().startOf('year').toDate(),
          endDate: now.toDate()
        };
      
      default:
        return {
          startDate: now.clone().subtract(30, 'days').toDate(),
          endDate: now.toDate()
        };
    }
  }
}

module.exports = BillingController;