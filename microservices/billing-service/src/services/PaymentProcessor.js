const { Logger, EventPublisher } = require('../../../shared');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Enhanced Payment Processing System for Brazilian Market
 * Supports PIX, Credit/Debit Cards, and Bank Transfers
 */
class PaymentProcessor {
  constructor(database, eventPublisher) {
    this.logger = new Logger('payment-processor');
    this.db = database;
    this.eventPublisher = eventPublisher;

    // Payment provider configurations
    this.providers = {
      pix: {
        enabled: true,
        provider: 'PagarMe', // or Stripe, Mercado Pago, etc.
        apiKey: process.env.PAGARME_API_KEY,
        webhookSecret: process.env.PAGARME_WEBHOOK_SECRET,
        pixKeyType: 'random', // email, cpf, phone, random
        pixKey: process.env.PIX_KEY
      },
      creditCard: {
        enabled: true,
        provider: 'Stripe',
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      }
    };

    // Configuration
    this.config = {
      pixTimeout: 30 * 60 * 1000, // 30 minutes
      maxRefundDays: 90,
      minAmount: 1000, // R$ 10.00 in cents
      maxAmount: 10000000, // R$ 100,000.00 in cents
      supportedCurrencies: ['BRL'],
      supportedMethods: ['pix', 'credit_card', 'debit_card'],
      webhookRetryAttempts: 3,
      webhookRetryDelay: 5000
    };

    // State management
    this.state = {
      processingPayments: new Map(),
      webhookQueue: [],
      paymentCache: new Map()
    };

    this.logger.info('Payment processor initialized', {
      supportedMethods: this.config.supportedMethods,
      providers: Object.keys(this.providers)
    });
  }

  /**
   * Process payment for credit purchase
   */
  async processPayment(paymentData) {
    const paymentId = this.generatePaymentId();
    
    try {
      this.logger.info('Processing payment', {
        paymentId,
        method: paymentData.method,
        amount: paymentData.amount,
        currency: paymentData.currency || 'BRL',
        tenantId: paymentData.tenantId
      });

      // Validate payment data
      await this.validatePaymentData(paymentData);

      // Create payment record
      const payment = await this.createPaymentRecord({
        id: paymentId,
        tenantId: paymentData.tenantId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'BRL',
        method: paymentData.method,
        description: paymentData.description || 'Credit purchase',
        customerData: paymentData.customer,
        metadata: paymentData.metadata || {}
      });

      // Add to processing state
      this.state.processingPayments.set(paymentId, {
        startTime: Date.now(),
        status: 'processing'
      });

      let result;

      // Route to appropriate payment method
      switch (paymentData.method) {
        case 'pix':
          result = await this.processPixPayment(payment, paymentData);
          break;
        
        case 'credit_card':
        case 'debit_card':
          result = await this.processCardPayment(payment, paymentData);
          break;
        
        default:
          throw new Error(`Unsupported payment method: ${paymentData.method}`);
      }

      // Update payment record with result
      await this.updatePaymentRecord(paymentId, result);

      // Remove from processing state
      this.state.processingPayments.delete(paymentId);

      // Publish payment event
      await this.eventPublisher.publish('billing.payment.processed', {
        paymentId,
        tenantId: paymentData.tenantId,
        method: paymentData.method,
        amount: paymentData.amount,
        status: result.status,
        timestamp: new Date()
      });

      this.logger.info('Payment processed', {
        paymentId,
        method: paymentData.method,
        status: result.status,
        processingTime: Date.now() - this.state.processingPayments.get(paymentId)?.startTime
      });

      return {
        paymentId,
        ...result
      };

    } catch (error) {
      this.logger.error('Payment processing failed', {
        paymentId,
        error: error.message,
        method: paymentData.method
      });

      // Update payment record as failed
      await this.updatePaymentRecord(paymentId, {
        status: 'failed',
        error: error.message,
        failedAt: new Date()
      });

      // Remove from processing state
      this.state.processingPayments.delete(paymentId);

      throw error;
    }
  }

  /**
   * Process PIX payment
   */
  async processPixPayment(payment, paymentData) {
    try {
      this.logger.info('Processing PIX payment', {
        paymentId: payment.id,
        amount: payment.amount
      });

      // Generate PIX QR Code and payment data
      const pixData = await this.generatePixPayment({
        amount: payment.amount,
        description: payment.description,
        customer: paymentData.customer,
        expiresIn: this.config.pixTimeout
      });

      const result = {
        status: 'pending',
        method: 'pix',
        providerPaymentId: pixData.id,
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
        pixCopyPaste: pixData.qr_code_url,
        expiresAt: pixData.expires_at,
        instructions: {
          title: 'Pagamento via PIX',
          steps: [
            '1. Abra o app do seu banco',
            '2. Escaneie o QR Code ou copie e cole o código PIX',
            '3. Confirme o pagamento',
            '4. O crédito será adicionado automaticamente'
          ]
        },
        providerData: pixData
      };

      // Schedule expiry check
      setTimeout(() => {
        this.checkPixPaymentStatus(payment.id);
      }, this.config.pixTimeout);

      return result;

    } catch (error) {
      this.logger.error('PIX payment generation failed', {
        paymentId: payment.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process card payment
   */
  async processCardPayment(payment, paymentData) {
    try {
      this.logger.info('Processing card payment', {
        paymentId: payment.id,
        method: payment.method,
        amount: payment.amount
      });

      // Validate card data
      if (!paymentData.card || !paymentData.card.token) {
        throw new Error('Card token is required for card payments');
      }

      // Process card payment via Stripe
      const cardPayment = await this.processStripePayment({
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: paymentData.card.token,
        customer: paymentData.customer,
        description: payment.description,
        metadata: {
          paymentId: payment.id,
          tenantId: payment.tenantId,
          ...payment.metadata
        }
      });

      const result = {
        status: cardPayment.status === 'succeeded' ? 'completed' : 'pending',
        method: payment.method,
        providerPaymentId: cardPayment.id,
        last4: paymentData.card.last4,
        brand: paymentData.card.brand,
        receipt: cardPayment.receipt_url,
        providerData: cardPayment
      };

      if (result.status === 'completed') {
        result.completedAt = new Date();
        result.transactionId = cardPayment.id;
      }

      return result;

    } catch (error) {
      this.logger.error('Card payment processing failed', {
        paymentId: payment.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Generate PIX payment via PagarMe API
   */
  async generatePixPayment(pixData) {
    try {
      // This would integrate with actual PIX provider (PagarMe, Stripe, etc.)
      // For demonstration, we'll simulate the API call
      
      const response = await this.simulatePixAPI({
        amount: pixData.amount,
        description: pixData.description,
        customer: pixData.customer
      });

      return response;

    } catch (error) {
      this.logger.error('PIX API call failed', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment(paymentData) {
    try {
      // This would integrate with actual Stripe API
      // For demonstration, we'll simulate the API call
      
      const response = await this.simulateStripeAPI(paymentData);

      return response;

    } catch (error) {
      this.logger.error('Stripe API call failed', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle payment webhook from providers
   */
  async handlePaymentWebhook(provider, webhookData, signature) {
    try {
      this.logger.info('Processing payment webhook', {
        provider,
        eventType: webhookData.type || webhookData.event
      });

      // Verify webhook signature
      const isValid = await this.verifyWebhookSignature(provider, webhookData, signature);
      
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Process webhook based on provider and event type
      let result;
      
      switch (provider) {
        case 'stripe':
          result = await this.handleStripeWebhook(webhookData);
          break;
        
        case 'pagarme':
          result = await this.handlePagarMeWebhook(webhookData);
          break;
        
        default:
          throw new Error(`Unsupported webhook provider: ${provider}`);
      }

      // Store webhook for audit
      await this.storeWebhookEvent(provider, webhookData, result);

      return result;

    } catch (error) {
      this.logger.error('Webhook processing failed', {
        provider,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleStripeWebhook(webhookData) {
    const event = webhookData;
    
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event.data.object, 'stripe');
        
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object, 'stripe');
        
        case 'charge.dispute.created':
          return await this.handlePaymentDispute(event.data.object, 'stripe');
        
        default:
          this.logger.debug('Unhandled Stripe webhook event', {
            type: event.type
          });
          
          return { processed: false, reason: 'Event type not handled' };
      }

    } catch (error) {
      this.logger.error('Stripe webhook handling failed', {
        eventType: event.type,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle PagarMe webhooks
   */
  async handlePagarMeWebhook(webhookData) {
    const event = webhookData;
    
    try {
      switch (event.event) {
        case 'transaction_status_changed':
          if (event.current_status === 'paid') {
            return await this.handlePaymentSuccess(event.transaction, 'pagarme');
          } else if (event.current_status === 'failed') {
            return await this.handlePaymentFailed(event.transaction, 'pagarme');
          }
          break;
        
        case 'pix_payment_paid':
          return await this.handlePixPaymentSuccess(event.transaction);
        
        default:
          this.logger.debug('Unhandled PagarMe webhook event', {
            event: event.event
          });
          
          return { processed: false, reason: 'Event type not handled' };
      }

    } catch (error) {
      this.logger.error('PagarMe webhook handling failed', {
        eventType: event.event,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentData, provider) {
    try {
      // Find payment by provider payment ID
      const payment = await this.findPaymentByProviderId(
        paymentData.id,
        provider
      );

      if (!payment) {
        this.logger.warn('Payment not found for webhook', {
          providerPaymentId: paymentData.id,
          provider
        });

        return { processed: false, reason: 'Payment not found' };
      }

      if (payment.status === 'completed') {
        this.logger.debug('Payment already completed', {
          paymentId: payment.payment_id
        });

        return { processed: true, reason: 'Already completed' };
      }

      // Update payment status
      await this.updatePaymentRecord(payment.payment_id, {
        status: 'completed',
        completedAt: new Date(),
        providerData: JSON.stringify(paymentData)
      });

      // Publish payment completed event
      await this.eventPublisher.publish('billing.payment.completed', {
        paymentId: payment.payment_id,
        tenantId: payment.tenant_id,
        amount: payment.amount,
        method: payment.method,
        provider,
        timestamp: new Date()
      });

      this.logger.info('Payment completed via webhook', {
        paymentId: payment.payment_id,
        provider,
        amount: payment.amount
      });

      return { processed: true, paymentId: payment.payment_id };

    } catch (error) {
      this.logger.error('Payment success handling failed', {
        providerPaymentId: paymentData.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(paymentData, provider) {
    try {
      const payment = await this.findPaymentByProviderId(
        paymentData.id,
        provider
      );

      if (!payment) {
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment status
      await this.updatePaymentRecord(payment.payment_id, {
        status: 'failed',
        failedAt: new Date(),
        error: paymentData.failure_reason || paymentData.refuse_reason,
        providerData: JSON.stringify(paymentData)
      });

      // Publish payment failed event
      await this.eventPublisher.publish('billing.payment.failed', {
        paymentId: payment.payment_id,
        tenantId: payment.tenant_id,
        amount: payment.amount,
        method: payment.method,
        error: paymentData.failure_reason || paymentData.refuse_reason,
        provider,
        timestamp: new Date()
      });

      this.logger.info('Payment failed via webhook', {
        paymentId: payment.payment_id,
        provider,
        error: paymentData.failure_reason || paymentData.refuse_reason
      });

      return { processed: true, paymentId: payment.payment_id };

    } catch (error) {
      this.logger.error('Payment failure handling failed', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(paymentId, refundData) {
    try {
      this.logger.info('Processing refund', {
        paymentId,
        amount: refundData.amount,
        reason: refundData.reason
      });

      // Get payment record
      const payment = await this.getPaymentById(paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      // Check refund eligibility
      const daysSincePayment = (Date.now() - new Date(payment.completed_at).getTime()) / (24 * 60 * 60 * 1000);
      
      if (daysSincePayment > this.config.maxRefundDays) {
        throw new Error(`Refund period expired. Maximum ${this.config.maxRefundDays} days`);
      }

      const refundAmount = refundData.amount || payment.amount;
      
      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      // Process refund with payment provider
      let refundResult;
      
      const providerData = JSON.parse(payment.provider_data || '{}');
      
      if (payment.method === 'pix' || payment.method.includes('card')) {
        refundResult = await this.processProviderRefund(
          payment.provider_payment_id,
          refundAmount,
          refundData.reason
        );
      }

      // Create refund record
      const refund = {
        refund_id: this.generateRefundId(),
        payment_id: paymentId,
        tenant_id: payment.tenant_id,
        amount: refundAmount,
        reason: refundData.reason,
        status: refundResult.success ? 'completed' : 'failed',
        provider_refund_id: refundResult.refundId,
        provider_data: JSON.stringify(refundResult),
        created_at: new Date()
      };

      await this.db('payment_refunds').insert(refund);

      // Publish refund event
      await this.eventPublisher.publish('billing.payment.refunded', {
        paymentId,
        refundId: refund.refund_id,
        tenantId: payment.tenant_id,
        amount: refundAmount,
        reason: refundData.reason,
        timestamp: new Date()
      });

      this.logger.info('Refund processed', {
        paymentId,
        refundId: refund.refund_id,
        amount: refundAmount
      });

      return {
        success: true,
        refundId: refund.refund_id,
        amount: refundAmount,
        status: refund.status
      };

    } catch (error) {
      this.logger.error('Refund processing failed', {
        paymentId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const payment = await this.getPaymentById(paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      const response = {
        paymentId: payment.payment_id,
        status: payment.status,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      };

      // Add method-specific data
      if (payment.provider_data) {
        const providerData = JSON.parse(payment.provider_data);
        
        if (payment.method === 'pix') {
          response.qrCode = providerData.qr_code;
          response.qrCodeBase64 = providerData.qr_code_base64;
          response.pixCopyPaste = providerData.qr_code_url;
          response.expiresAt = providerData.expires_at;
        } else if (payment.method.includes('card')) {
          response.last4 = providerData.last4;
          response.brand = providerData.brand;
          response.receipt = providerData.receipt_url;
        }
      }

      if (payment.completed_at) {
        response.completedAt = payment.completed_at;
      }

      if (payment.failed_at) {
        response.failedAt = payment.failed_at;
        response.error = payment.error_message;
      }

      return response;

    } catch (error) {
      this.logger.error('Failed to get payment status', {
        paymentId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper methods
   */

  generatePaymentId() {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRefundId() {
    return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async validatePaymentData(paymentData) {
    if (!paymentData.amount || paymentData.amount < this.config.minAmount) {
      throw new Error(`Minimum payment amount is ${this.config.minAmount / 100} ${paymentData.currency || 'BRL'}`);
    }

    if (paymentData.amount > this.config.maxAmount) {
      throw new Error(`Maximum payment amount is ${this.config.maxAmount / 100} ${paymentData.currency || 'BRL'}`);
    }

    if (!this.config.supportedMethods.includes(paymentData.method)) {
      throw new Error(`Unsupported payment method: ${paymentData.method}`);
    }

    if (!paymentData.tenantId) {
      throw new Error('Tenant ID is required');
    }
  }

  async createPaymentRecord(paymentData) {
    const payment = {
      payment_id: paymentData.id,
      tenant_id: paymentData.tenantId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      method: paymentData.method,
      description: paymentData.description,
      customer_data: JSON.stringify(paymentData.customerData || {}),
      metadata: JSON.stringify(paymentData.metadata || {}),
      status: 'pending',
      created_at: new Date()
    };

    await this.db('payments').insert(payment);
    
    return payment;
  }

  async updatePaymentRecord(paymentId, updateData) {
    const updates = {
      ...updateData,
      updated_at: new Date()
    };

    if (updateData.providerData && typeof updateData.providerData === 'object') {
      updates.provider_data = JSON.stringify(updateData.providerData);
      delete updates.providerData;
    }

    await this.db('payments')
      .where('payment_id', paymentId)
      .update(updates);
  }

  async getPaymentById(paymentId) {
    return await this.db('payments')
      .where('payment_id', paymentId)
      .first();
  }

  async findPaymentByProviderId(providerPaymentId, provider) {
    return await this.db('payments')
      .where('provider_payment_id', providerPaymentId)
      .first();
  }

  async verifyWebhookSignature(provider, webhookData, signature) {
    // Implement signature verification logic for each provider
    // This is crucial for security
    
    try {
      switch (provider) {
        case 'stripe':
          return this.verifyStripeSignature(webhookData, signature);
        
        case 'pagarme':
          return this.verifyPagarMeSignature(webhookData, signature);
        
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('Webhook signature verification failed', {
        provider,
        error: error.message
      });
      
      return false;
    }
  }

  verifyStripeSignature(webhookData, signature) {
    // Implement Stripe webhook signature verification
    const secret = this.providers.creditCard.webhookSecret;
    
    if (!secret) {
      this.logger.warn('Stripe webhook secret not configured');
      return false;
    }

    // Stripe signature verification logic would go here
    return true; // Simplified for demo
  }

  verifyPagarMeSignature(webhookData, signature) {
    // Implement PagarMe webhook signature verification
    const secret = this.providers.pix.webhookSecret;
    
    if (!secret) {
      this.logger.warn('PagarMe webhook secret not configured');
      return false;
    }

    // PagarMe signature verification logic would go here
    return true; // Simplified for demo
  }

  async storeWebhookEvent(provider, webhookData, result) {
    try {
      await this.db('payment_webhooks').insert({
        webhook_id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        provider,
        event_type: webhookData.type || webhookData.event,
        payload: JSON.stringify(webhookData),
        result: JSON.stringify(result),
        processed: result.processed || false,
        created_at: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to store webhook event', {
        provider,
        error: error.message
      });
    }
  }

  async checkPixPaymentStatus(paymentId) {
    try {
      const payment = await this.getPaymentById(paymentId);
      
      if (!payment || payment.status !== 'pending') {
        return;
      }

      // Check if PIX payment expired
      const providerData = JSON.parse(payment.provider_data || '{}');
      const expiresAt = new Date(providerData.expires_at);
      
      if (Date.now() > expiresAt.getTime()) {
        // Mark as expired
        await this.updatePaymentRecord(paymentId, {
          status: 'expired',
          expiredAt: new Date()
        });

        // Publish expiry event
        await this.eventPublisher.publish('billing.payment.expired', {
          paymentId,
          tenantId: payment.tenant_id,
          method: 'pix',
          timestamp: new Date()
        });

        this.logger.info('PIX payment expired', { paymentId });
      }

    } catch (error) {
      this.logger.error('PIX payment status check failed', {
        paymentId,
        error: error.message
      });
    }
  }

  // Simulation methods for demo purposes
  async simulatePixAPI(pixData) {
    // Simulate PIX API response
    return {
      id: `pix_${Date.now()}`,
      qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      qr_code_url: '00020126580014BR.GOV.BCB.PIX013636123456-7890-1234-abcd-123456789012520400005303986540510.005802BR5913Test Merchant6008Sao Paulo62070503***6304A1B2',
      expires_at: new Date(Date.now() + this.config.pixTimeout).toISOString(),
      status: 'pending'
    };
  }

  async simulateStripeAPI(paymentData) {
    // Simulate Stripe API response
    return {
      id: `pi_${Date.now()}`,
      status: 'succeeded',
      amount: paymentData.amount,
      currency: paymentData.currency,
      receipt_url: `https://pay.stripe.com/receipts/pi_${Date.now()}`,
      created: Math.floor(Date.now() / 1000)
    };
  }

  async processProviderRefund(providerPaymentId, amount, reason) {
    // Simulate refund processing
    return {
      success: true,
      refundId: `re_${Date.now()}`,
      status: 'completed'
    };
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(tenantId = null, period = '30d') {
    try {
      const startDate = moment().subtract(30, 'days').toDate();

      let query = this.db('payments')
        .where('created_at', '>=', startDate);

      if (tenantId) {
        query = query.where('tenant_id', tenantId);
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_payments'),
          this.db.raw('SUM(CASE WHEN status = ? THEN amount ELSE 0 END) as completed_amount', ['completed']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as completed_count', ['completed']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed_count', ['failed']),
          this.db.raw('COUNT(CASE WHEN method = ? THEN 1 END) as pix_count', ['pix']),
          this.db.raw('COUNT(CASE WHEN method LIKE ? THEN 1 END) as card_count', ['%card%'])
        )
        .first();

      return {
        period: '30d',
        totalPayments: parseInt(stats.total_payments) || 0,
        completedAmount: parseFloat(stats.completed_amount) || 0,
        completedCount: parseInt(stats.completed_count) || 0,
        failedCount: parseInt(stats.failed_count) || 0,
        pixCount: parseInt(stats.pix_count) || 0,
        cardCount: parseInt(stats.card_count) || 0,
        successRate: stats.total_payments > 0 
          ? (stats.completed_count / stats.total_payments * 100).toFixed(2)
          : 0
      };

    } catch (error) {
      this.logger.error('Failed to get payment statistics', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get system statistics
   */
  getSystemStatistics() {
    return {
      processingPayments: this.state.processingPayments.size,
      webhookQueue: this.state.webhookQueue.length,
      paymentCache: this.state.paymentCache.size,
      providers: Object.keys(this.providers).filter(key => this.providers[key].enabled),
      supportedMethods: this.config.supportedMethods,
      config: {
        minAmount: this.config.minAmount,
        maxAmount: this.config.maxAmount,
        pixTimeout: this.config.pixTimeout,
        maxRefundDays: this.config.maxRefundDays
      }
    };
  }
}

module.exports = PaymentProcessor;