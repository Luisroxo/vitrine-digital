const { Logger, EventPublisher } = require('../../../shared');
const moment = require('moment');

/**
 * Advanced Credit System for Multi-tenant Billing
 */
class CreditManager {
  constructor(database, eventPublisher) {
    this.logger = new Logger('credit-manager');
    this.db = database;
    this.eventPublisher = eventPublisher;

    // Configuration
    this.config = {
      defaultCreditExpiry: 365, // days
      reservationTimeout: 15, // minutes
      maxCreditBalance: 100000, // maximum credits per tenant
      minPurchaseAmount: 10, // minimum credit purchase
      creditToReais: 1, // 1 credit = R$ 1.00
      bonusThresholds: {
        100: 0.05,   // 5% bonus for R$ 100+
        500: 0.10,   // 10% bonus for R$ 500+
        1000: 0.15,  // 15% bonus for R$ 1000+
        5000: 0.20   // 20% bonus for R$ 5000+
      }
    };

    // State management
    this.state = {
      activeReservations: new Map(),
      processingTransactions: new Set(),
      balanceCache: new Map(),
      cacheTtl: 5 * 60 * 1000 // 5 minutes
    };

    this.logger.info('Credit manager initialized', {
      maxBalance: this.config.maxCreditBalance,
      creditToReais: this.config.creditToReais
    });
  }

  /**
   * Get credit balance for tenant
   */
  async getCreditBalance(tenantId) {
    try {
      // Check cache first
      const cacheKey = `balance_${tenantId}`;
      const cached = this.state.balanceCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.state.cacheTtl) {
        return cached.balance;
      }

      // Calculate balance from transactions
      const result = await this.db('credit_transactions')
        .where('tenant_id', tenantId)
        .where('status', 'completed')
        .sum('amount as total');

      const balance = parseFloat(result[0].total) || 0;

      // Cache the result
      this.state.balanceCache.set(cacheKey, {
        balance,
        timestamp: Date.now()
      });

      this.logger.debug('Credit balance retrieved', {
        tenantId,
        balance,
        cached: false
      });

      return balance;

    } catch (error) {
      this.logger.error('Failed to get credit balance', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Purchase credits with payment
   */
  async purchaseCredits(tenantId, purchaseData) {
    const transactionId = this.generateTransactionId();
    
    try {
      this.logger.info('Starting credit purchase', {
        transactionId,
        tenantId,
        amount: purchaseData.amount,
        paymentMethod: purchaseData.paymentMethod
      });

      // Validate purchase
      await this.validatePurchase(tenantId, purchaseData);

      // Calculate credits and bonus
      const creditCalculation = this.calculateCreditsWithBonus(purchaseData.amount);

      // Create transaction record
      const transaction = await this.createTransaction({
        id: transactionId,
        tenantId,
        type: 'purchase',
        amount: creditCalculation.totalCredits,
        baseAmount: creditCalculation.baseCredits,
        bonusAmount: creditCalculation.bonusCredits,
        paymentAmount: purchaseData.amount,
        paymentMethod: purchaseData.paymentMethod,
        description: `Credit purchase - ${creditCalculation.baseCredits} base + ${creditCalculation.bonusCredits} bonus`,
        metadata: {
          originalAmount: purchaseData.amount,
          bonusPercentage: creditCalculation.bonusPercentage,
          paymentData: purchaseData.paymentData
        }
      });

      // Process payment (this would integrate with payment provider)
      const paymentResult = await this.processPayment(transactionId, purchaseData);

      if (paymentResult.success) {
        // Complete the transaction
        await this.completeTransaction(transactionId, paymentResult);

        // Clear balance cache
        this.clearBalanceCache(tenantId);

        // Publish event
        await this.eventPublisher.publish('billing.credits.purchased', {
          tenantId,
          transactionId,
          credits: creditCalculation.totalCredits,
          amount: purchaseData.amount,
          bonusCredits: creditCalculation.bonusCredits,
          timestamp: new Date()
        });

        this.logger.info('Credit purchase completed', {
          transactionId,
          tenantId,
          creditsAdded: creditCalculation.totalCredits,
          paymentAmount: purchaseData.amount
        });

        return {
          success: true,
          transactionId,
          creditsAdded: creditCalculation.totalCredits,
          bonusCredits: creditCalculation.bonusCredits,
          newBalance: await this.getCreditBalance(tenantId),
          paymentResult
        };

      } else {
        // Payment failed
        await this.failTransaction(transactionId, paymentResult.error);

        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

    } catch (error) {
      this.logger.error('Credit purchase failed', {
        transactionId,
        tenantId,
        error: error.message
      });

      // Ensure transaction is marked as failed
      await this.failTransaction(transactionId, error.message);

      throw error;
    }
  }

  /**
   * Reserve credits for a purchase
   */
  async reserveCredits(tenantId, amount, purpose, metadata = {}) {
    const reservationId = this.generateReservationId();
    
    try {
      this.logger.debug('Reserving credits', {
        reservationId,
        tenantId,
        amount,
        purpose
      });

      // Check available balance
      const currentBalance = await this.getCreditBalance(tenantId);
      const reservedAmount = await this.getReservedAmount(tenantId);
      const availableBalance = currentBalance - reservedAmount;

      if (availableBalance < amount) {
        throw new Error(`Insufficient credits. Available: ${availableBalance}, Required: ${amount}`);
      }

      // Create reservation
      const reservation = {
        id: reservationId,
        tenantId,
        amount,
        purpose,
        metadata,
        expiresAt: moment().add(this.config.reservationTimeout, 'minutes').toDate(),
        status: 'active'
      };

      await this.db('credit_reservations').insert({
        reservation_id: reservation.id,
        tenant_id: reservation.tenantId,
        amount: reservation.amount,
        purpose: reservation.purpose,
        metadata: JSON.stringify(reservation.metadata),
        expires_at: reservation.expiresAt,
        status: reservation.status,
        created_at: new Date()
      });

      // Store in memory for quick access
      this.state.activeReservations.set(reservationId, reservation);

      // Schedule automatic expiry
      setTimeout(() => {
        this.expireReservation(reservationId);
      }, this.config.reservationTimeout * 60 * 1000);

      this.logger.info('Credits reserved successfully', {
        reservationId,
        tenantId,
        amount,
        expiresAt: reservation.expiresAt
      });

      return {
        reservationId,
        amount,
        expiresAt: reservation.expiresAt,
        availableBalance: availableBalance - amount
      };

    } catch (error) {
      this.logger.error('Credit reservation failed', {
        reservationId,
        tenantId,
        amount,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Consume reserved credits (complete purchase)
   */
  async consumeReservedCredits(reservationId, consumeData = {}) {
    const transactionId = this.generateTransactionId();

    try {
      this.logger.debug('Consuming reserved credits', {
        reservationId,
        transactionId
      });

      // Get reservation
      const reservation = await this.getReservation(reservationId);
      
      if (!reservation) {
        throw new Error('Reservation not found or expired');
      }

      if (reservation.status !== 'active') {
        throw new Error(`Reservation is ${reservation.status}`);
      }

      // Create debit transaction
      const transaction = await this.createTransaction({
        id: transactionId,
        tenantId: reservation.tenantId,
        type: 'consumption',
        amount: -reservation.amount,
        description: `Credit consumption - ${reservation.purpose}`,
        reservationId: reservationId,
        metadata: {
          originalReservation: reservation.metadata,
          consumeData
        }
      });

      // Complete the transaction
      await this.completeTransaction(transactionId);

      // Mark reservation as consumed
      await this.markReservationAsConsumed(reservationId, transactionId);

      // Remove from active reservations
      this.state.activeReservations.delete(reservationId);

      // Clear balance cache
      this.clearBalanceCache(reservation.tenantId);

      // Publish event
      await this.eventPublisher.publish('billing.credits.consumed', {
        tenantId: reservation.tenantId,
        transactionId,
        reservationId,
        amount: reservation.amount,
        purpose: reservation.purpose,
        timestamp: new Date()
      });

      const newBalance = await this.getCreditBalance(reservation.tenantId);

      this.logger.info('Credits consumed successfully', {
        reservationId,
        transactionId,
        tenantId: reservation.tenantId,
        amount: reservation.amount,
        newBalance
      });

      return {
        success: true,
        transactionId,
        consumedAmount: reservation.amount,
        newBalance,
        purpose: reservation.purpose
      };

    } catch (error) {
      this.logger.error('Credit consumption failed', {
        reservationId,
        transactionId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Release reserved credits (cancel purchase)
   */
  async releaseReservedCredits(reservationId, reason = 'Manual release') {
    try {
      this.logger.debug('Releasing reserved credits', {
        reservationId,
        reason
      });

      const reservation = await this.getReservation(reservationId);
      
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'active') {
        throw new Error(`Reservation is ${reservation.status}`);
      }

      // Mark reservation as released
      await this.db('credit_reservations')
        .where('reservation_id', reservationId)
        .update({
          status: 'released',
          released_at: new Date(),
          release_reason: reason,
          updated_at: new Date()
        });

      // Remove from active reservations
      this.state.activeReservations.delete(reservationId);

      // Publish event
      await this.eventPublisher.publish('billing.credits.released', {
        tenantId: reservation.tenantId,
        reservationId,
        amount: reservation.amount,
        reason,
        timestamp: new Date()
      });

      this.logger.info('Credits released successfully', {
        reservationId,
        tenantId: reservation.tenantId,
        amount: reservation.amount,
        reason
      });

      return {
        success: true,
        releasedAmount: reservation.amount,
        reason
      };

    } catch (error) {
      this.logger.error('Credit release failed', {
        reservationId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get credit transaction history
   */
  async getTransactionHistory(tenantId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        type = null,
        startDate = null,
        endDate = null
      } = options;

      let query = this.db('credit_transactions')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (type) {
        query = query.where('type', type);
      }

      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }

      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      const transactions = await query.select('*');

      // Parse metadata
      const parsedTransactions = transactions.map(tx => ({
        ...tx,
        metadata: tx.metadata ? JSON.parse(tx.metadata) : null
      }));

      return parsedTransactions;

    } catch (error) {
      this.logger.error('Failed to get transaction history', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get credit statistics for tenant
   */
  async getCreditStatistics(tenantId, period = '30d') {
    try {
      const startDate = moment().subtract(30, 'days').toDate();

      const stats = {
        currentBalance: await this.getCreditBalance(tenantId),
        reserved: await this.getReservedAmount(tenantId),
        period: {
          purchased: 0,
          consumed: 0,
          bonusReceived: 0,
          transactions: 0
        }
      };

      // Get period statistics
      const periodStats = await this.db('credit_transactions')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('status', 'completed')
        .select(
          this.db.raw('SUM(CASE WHEN type = ? THEN amount ELSE 0 END) as purchased', ['purchase']),
          this.db.raw('SUM(CASE WHEN type = ? THEN ABS(amount) ELSE 0 END) as consumed', ['consumption']),
          this.db.raw('SUM(CASE WHEN type = ? THEN bonus_amount ELSE 0 END) as bonus_received', ['purchase']),
          this.db.raw('COUNT(*) as transactions')
        )
        .first();

      stats.period = {
        purchased: parseFloat(periodStats.purchased) || 0,
        consumed: parseFloat(periodStats.consumed) || 0,
        bonusReceived: parseFloat(periodStats.bonus_received) || 0,
        transactions: parseInt(periodStats.transactions) || 0
      };

      stats.available = stats.currentBalance - stats.reserved;

      return stats;

    } catch (error) {
      this.logger.error('Failed to get credit statistics', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReservationId() {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async validatePurchase(tenantId, purchaseData) {
    if (!purchaseData.amount || purchaseData.amount < this.config.minPurchaseAmount) {
      throw new Error(`Minimum purchase amount is ${this.config.minPurchaseAmount}`);
    }

    const currentBalance = await this.getCreditBalance(tenantId);
    const creditAmount = this.calculateCreditsWithBonus(purchaseData.amount).totalCredits;
    
    if (currentBalance + creditAmount > this.config.maxCreditBalance) {
      throw new Error(`Purchase would exceed maximum credit balance of ${this.config.maxCreditBalance}`);
    }

    if (!purchaseData.paymentMethod) {
      throw new Error('Payment method is required');
    }
  }

  calculateCreditsWithBonus(amount) {
    const baseCredits = amount / this.config.creditToReais;
    
    let bonusPercentage = 0;
    
    // Find the highest applicable bonus
    for (const [threshold, bonus] of Object.entries(this.config.bonusThresholds)) {
      if (amount >= parseInt(threshold)) {
        bonusPercentage = bonus;
      }
    }

    const bonusCredits = baseCredits * bonusPercentage;
    const totalCredits = baseCredits + bonusCredits;

    return {
      baseCredits: Math.round(baseCredits * 100) / 100,
      bonusCredits: Math.round(bonusCredits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      bonusPercentage
    };
  }

  async createTransaction(transactionData) {
    const transaction = {
      transaction_id: transactionData.id,
      tenant_id: transactionData.tenantId,
      type: transactionData.type,
      amount: transactionData.amount,
      base_amount: transactionData.baseAmount || null,
      bonus_amount: transactionData.bonusAmount || null,
      payment_amount: transactionData.paymentAmount || null,
      payment_method: transactionData.paymentMethod || null,
      description: transactionData.description,
      reservation_id: transactionData.reservationId || null,
      metadata: JSON.stringify(transactionData.metadata || {}),
      status: 'pending',
      created_at: new Date()
    };

    await this.db('credit_transactions').insert(transaction);
    
    return transaction;
  }

  async completeTransaction(transactionId, paymentResult = null) {
    const updateData = {
      status: 'completed',
      completed_at: new Date(),
      updated_at: new Date()
    };

    if (paymentResult) {
      updateData.payment_data = JSON.stringify(paymentResult);
    }

    await this.db('credit_transactions')
      .where('transaction_id', transactionId)
      .update(updateData);
  }

  async failTransaction(transactionId, errorMessage) {
    try {
      await this.db('credit_transactions')
        .where('transaction_id', transactionId)
        .update({
          status: 'failed',
          error_message: errorMessage,
          failed_at: new Date(),
          updated_at: new Date()
        });
    } catch (error) {
      this.logger.error('Failed to update failed transaction', {
        transactionId,
        error: error.message
      });
    }
  }

  async processPayment(transactionId, purchaseData) {
    try {
      // This would integrate with actual payment providers (Stripe, PagarMe, etc.)
      // For now, we'll simulate payment processing
      
      this.logger.info('Processing payment', {
        transactionId,
        paymentMethod: purchaseData.paymentMethod,
        amount: purchaseData.amount
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate payment success (in real implementation, this would call payment API)
      const paymentResult = {
        success: true,
        paymentId: `pay_${Date.now()}`,
        method: purchaseData.paymentMethod,
        amount: purchaseData.amount,
        status: 'completed',
        processedAt: new Date()
      };

      return paymentResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReservation(reservationId) {
    // Check memory first
    const memoryReservation = this.state.activeReservations.get(reservationId);
    if (memoryReservation) {
      return memoryReservation;
    }

    // Check database
    const dbReservation = await this.db('credit_reservations')
      .where('reservation_id', reservationId)
      .first();

    if (dbReservation) {
      return {
        id: dbReservation.reservation_id,
        tenantId: dbReservation.tenant_id,
        amount: parseFloat(dbReservation.amount),
        purpose: dbReservation.purpose,
        metadata: dbReservation.metadata ? JSON.parse(dbReservation.metadata) : {},
        expiresAt: dbReservation.expires_at,
        status: dbReservation.status
      };
    }

    return null;
  }

  async getReservedAmount(tenantId) {
    const result = await this.db('credit_reservations')
      .where('tenant_id', tenantId)
      .where('status', 'active')
      .where('expires_at', '>', new Date())
      .sum('amount as total');

    return parseFloat(result[0].total) || 0;
  }

  async markReservationAsConsumed(reservationId, transactionId) {
    await this.db('credit_reservations')
      .where('reservation_id', reservationId)
      .update({
        status: 'consumed',
        consumed_at: new Date(),
        transaction_id: transactionId,
        updated_at: new Date()
      });
  }

  async expireReservation(reservationId) {
    try {
      const reservation = this.state.activeReservations.get(reservationId);
      
      if (reservation && reservation.status === 'active') {
        await this.db('credit_reservations')
          .where('reservation_id', reservationId)
          .update({
            status: 'expired',
            expired_at: new Date(),
            updated_at: new Date()
          });

        this.state.activeReservations.delete(reservationId);

        this.logger.info('Reservation expired', {
          reservationId,
          tenantId: reservation.tenantId,
          amount: reservation.amount
        });

        // Publish event
        await this.eventPublisher.publish('billing.credits.reservation_expired', {
          tenantId: reservation.tenantId,
          reservationId,
          amount: reservation.amount,
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.logger.error('Failed to expire reservation', {
        reservationId,
        error: error.message
      });
    }
  }

  clearBalanceCache(tenantId) {
    const cacheKey = `balance_${tenantId}`;
    this.state.balanceCache.delete(cacheKey);
  }

  /**
   * Maintenance and cleanup
   */

  async cleanupExpiredReservations() {
    try {
      const expiredCount = await this.db('credit_reservations')
        .where('status', 'active')
        .where('expires_at', '<', new Date())
        .update({
          status: 'expired',
          expired_at: new Date(),
          updated_at: new Date()
        });

      if (expiredCount > 0) {
        this.logger.info('Cleaned up expired reservations', {
          count: expiredCount
        });
      }

      return expiredCount;

    } catch (error) {
      this.logger.error('Failed to cleanup expired reservations', {
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
      activeReservations: this.state.activeReservations.size,
      processingTransactions: this.state.processingTransactions.size,
      cachedBalances: this.state.balanceCache.size,
      config: {
        maxCreditBalance: this.config.maxCreditBalance,
        minPurchaseAmount: this.config.minPurchaseAmount,
        creditToReais: this.config.creditToReais,
        bonusThresholds: this.config.bonusThresholds
      }
    };
  }
}

module.exports = CreditManager;