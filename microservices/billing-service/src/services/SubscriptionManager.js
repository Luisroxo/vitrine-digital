const { Logger, EventPublisher } = require('../../../shared');
const moment = require('moment-timezone');
const cron = require('node-cron');

/**
 * Advanced Subscription Management System
 * Handles plans, billing cycles, upgrades, downgrades, and proration
 */
class SubscriptionManager {
  constructor(database, eventPublisher, creditManager, paymentProcessor) {
    this.logger = new Logger('subscription-manager');
    this.db = database;
    this.eventPublisher = eventPublisher;
    this.creditManager = creditManager;
    this.paymentProcessor = paymentProcessor;

    // Configuration
    this.config = {
      defaultCurrency: 'BRL',
      defaultTimezone: 'America/Sao_Paulo',
      prorationType: 'immediate', // immediate, next_cycle, none
      gracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      retryAttempts: 3,
      retryDelay: 24 * 60 * 60 * 1000, // 24 hours
      dunningCycles: [1, 3, 7], // days before suspension
      suspensionGracePeriod: 15 * 24 * 60 * 60 * 1000 // 15 days before cancellation
    };

    // State management
    this.state = {
      activeJobs: new Map(),
      billingQueue: [],
      subscriptionCache: new Map(),
      planCache: new Map()
    };

    // Billing plans
    this.predefinedPlans = [
      {
        plan_id: 'starter',
        name: 'Plano Starter',
        description: 'Perfeito para começar sua loja virtual',
        price: 2900, // R$ 29,00
        interval: 'monthly',
        credits_included: 500,
        features: {
          products: 100,
          orders_per_month: 50,
          storage_gb: 1,
          support: 'email',
          themes: ['basic'],
          integrations: ['bling'],
          analytics: 'basic'
        },
        limits: {
          api_calls_per_hour: 1000,
          bandwidth_gb: 10,
          users: 1
        }
      },
      {
        plan_id: 'growth',
        name: 'Plano Growth',
        description: 'Para lojas em crescimento',
        price: 5900, // R$ 59,00
        interval: 'monthly',
        credits_included: 1500,
        features: {
          products: 500,
          orders_per_month: 200,
          storage_gb: 5,
          support: 'priority_email',
          themes: ['basic', 'premium'],
          integrations: ['bling', 'mercadolivre', 'shopee'],
          analytics: 'advanced',
          seo_tools: true,
          marketing_automation: true
        },
        limits: {
          api_calls_per_hour: 5000,
          bandwidth_gb: 50,
          users: 3
        }
      },
      {
        plan_id: 'professional',
        name: 'Plano Professional',
        description: 'Para empresas estabelecidas',
        price: 9900, // R$ 99,00
        interval: 'monthly',
        credits_included: 3000,
        features: {
          products: 2000,
          orders_per_month: 1000,
          storage_gb: 20,
          support: 'phone_priority',
          themes: ['all'],
          integrations: ['all'],
          analytics: 'enterprise',
          seo_tools: true,
          marketing_automation: true,
          custom_domain: true,
          white_label: true
        },
        limits: {
          api_calls_per_hour: 20000,
          bandwidth_gb: 200,
          users: 10
        }
      },
      {
        plan_id: 'enterprise',
        name: 'Plano Enterprise',
        description: 'Solução completa para grandes empresas',
        price: 19900, // R$ 199,00
        interval: 'monthly',
        credits_included: 10000,
        features: {
          products: 'unlimited',
          orders_per_month: 'unlimited',
          storage_gb: 100,
          support: 'dedicated_manager',
          themes: ['all'],
          integrations: ['all'],
          analytics: 'enterprise',
          seo_tools: true,
          marketing_automation: true,
          custom_domain: true,
          white_label: true,
          api_access: true,
          custom_integrations: true
        },
        limits: {
          api_calls_per_hour: 100000,
          bandwidth_gb: 1000,
          users: 50
        }
      }
    ];

    this.logger.info('Subscription manager initialized', {
      plans: this.predefinedPlans.length,
      config: this.config
    });

    // Initialize billing cycles
    this.initializeBillingJobs();
  }

  /**
   * Create or update subscription plan
   */
  async createPlan(planData) {
    try {
      this.logger.info('Creating subscription plan', {
        planId: planData.plan_id,
        name: planData.name,
        price: planData.price
      });

      // Validate plan data
      await this.validatePlanData(planData);

      const plan = {
        plan_id: planData.plan_id,
        name: planData.name,
        description: planData.description,
        price: planData.price,
        currency: planData.currency || this.config.defaultCurrency,
        interval: planData.interval || 'monthly',
        credits_included: planData.credits_included || 0,
        features: JSON.stringify(planData.features || {}),
        limits: JSON.stringify(planData.limits || {}),
        trial_days: planData.trial_days || 0,
        is_active: planData.is_active !== false,
        metadata: JSON.stringify(planData.metadata || {}),
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert or update plan
      await this.db('subscription_plans')
        .insert(plan)
        .onConflict('plan_id')
        .merge();

      // Clear cache
      this.state.planCache.delete(planData.plan_id);

      // Publish plan event
      await this.eventPublisher.publish('billing.plan.created', {
        planId: planData.plan_id,
        name: planData.name,
        price: planData.price,
        timestamp: new Date()
      });

      this.logger.info('Plan created successfully', {
        planId: planData.plan_id
      });

      return plan;

    } catch (error) {
      this.logger.error('Failed to create plan', {
        planId: planData.plan_id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Subscribe tenant to a plan
   */
  async createSubscription(subscriptionData) {
    const subscriptionId = this.generateSubscriptionId();
    
    try {
      this.logger.info('Creating subscription', {
        subscriptionId,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId
      });

      // Validate subscription data
      await this.validateSubscriptionData(subscriptionData);

      // Get plan details
      const plan = await this.getPlan(subscriptionData.planId);
      
      if (!plan || !plan.is_active) {
        throw new Error(`Plan not found or inactive: ${subscriptionData.planId}`);
      }

      // Check for existing active subscription
      const existingSubscription = await this.getActiveSubscription(subscriptionData.tenantId);
      
      if (existingSubscription && !subscriptionData.allowMultiple) {
        throw new Error('Tenant already has an active subscription');
      }

      // Calculate billing dates
      const now = moment().tz(this.config.defaultTimezone);
      const trialEndDate = plan.trial_days > 0 
        ? moment(now).add(plan.trial_days, 'days')
        : null;
      
      let nextBillingDate;
      
      if (trialEndDate) {
        nextBillingDate = trialEndDate.clone();
      } else {
        nextBillingDate = moment(now);
      }

      // Add billing interval
      switch (plan.interval) {
        case 'daily':
          nextBillingDate.add(1, 'day');
          break;
        case 'weekly':
          nextBillingDate.add(1, 'week');
          break;
        case 'monthly':
          nextBillingDate.add(1, 'month');
          break;
        case 'yearly':
          nextBillingDate.add(1, 'year');
          break;
        default:
          throw new Error(`Unsupported billing interval: ${plan.interval}`);
      }

      const subscription = {
        subscription_id: subscriptionId,
        tenant_id: subscriptionData.tenantId,
        plan_id: subscriptionData.planId,
        status: trialEndDate ? 'trialing' : 'active',
        current_period_start: now.toDate(),
        current_period_end: nextBillingDate.toDate(),
        trial_end: trialEndDate ? trialEndDate.toDate() : null,
        quantity: subscriptionData.quantity || 1,
        metadata: JSON.stringify(subscriptionData.metadata || {}),
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create subscription record
      await this.db('subscriptions').insert(subscription);

      // Add included credits if not in trial
      if (!trialEndDate && plan.credits_included > 0) {
        await this.creditManager.addCredits(
          subscriptionData.tenantId,
          plan.credits_included,
          {
            type: 'subscription_included',
            subscriptionId,
            planId: subscriptionData.planId,
            period: `${subscription.current_period_start} - ${subscription.current_period_end}`
          }
        );
      }

      // Schedule next billing
      await this.scheduleNextBilling(subscriptionId);

      // Publish subscription event
      await this.eventPublisher.publish('billing.subscription.created', {
        subscriptionId,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        nextBilling: subscription.current_period_end,
        timestamp: new Date()
      });

      this.logger.info('Subscription created successfully', {
        subscriptionId,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscription.status
      });

      return {
        subscriptionId,
        status: subscription.status,
        plan: {
          id: plan.plan_id,
          name: plan.name,
          price: plan.price,
          features: JSON.parse(plan.features),
          limits: JSON.parse(plan.limits)
        },
        currentPeriod: {
          start: subscription.current_period_start,
          end: subscription.current_period_end
        },
        trial: subscription.trial_end ? {
          endDate: subscription.trial_end
        } : null
      };

    } catch (error) {
      this.logger.error('Failed to create subscription', {
        subscriptionId,
        tenantId: subscriptionData.tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  async changePlan(subscriptionId, newPlanId, options = {}) {
    try {
      this.logger.info('Changing subscription plan', {
        subscriptionId,
        newPlanId,
        proration: options.proration !== false
      });

      // Get current subscription
      const subscription = await this.getSubscription(subscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        throw new Error(`Cannot change plan for subscription with status: ${subscription.status}`);
      }

      // Get current and new plans
      const currentPlan = await this.getPlan(subscription.plan_id);
      const newPlan = await this.getPlan(newPlanId);

      if (!newPlan || !newPlan.is_active) {
        throw new Error(`New plan not found or inactive: ${newPlanId}`);
      }

      if (currentPlan.plan_id === newPlan.plan_id) {
        throw new Error('Cannot change to the same plan');
      }

      const now = moment().tz(this.config.defaultTimezone);
      let prorationAmount = 0;
      let immediateCharge = false;

      // Calculate proration if enabled
      if (options.proration !== false && subscription.status === 'active') {
        const currentPeriodStart = moment(subscription.current_period_start);
        const currentPeriodEnd = moment(subscription.current_period_end);
        const periodDuration = currentPeriodEnd.diff(currentPeriodStart, 'milliseconds');
        const usedDuration = now.diff(currentPeriodStart, 'milliseconds');
        const remainingDuration = currentPeriodEnd.diff(now, 'milliseconds');

        // Calculate unused amount from current plan
        const unusedAmount = (currentPlan.price * remainingDuration) / periodDuration;

        // Calculate prorated amount for new plan
        const newPlanAmount = (newPlan.price * remainingDuration) / periodDuration;

        prorationAmount = newPlanAmount - unusedAmount;

        // If upgrade (higher price), charge immediately
        if (prorationAmount > 0) {
          immediateCharge = true;
        }
      }

      // Process immediate charge if needed
      let chargeResult = null;
      
      if (immediateCharge && prorationAmount > 0) {
        // Try to charge credits first
        const creditBalance = await this.creditManager.getCreditBalance(subscription.tenant_id);
        
        if (creditBalance >= prorationAmount) {
          await this.creditManager.consumeCredits(
            subscription.tenant_id,
            prorationAmount,
            {
              type: 'subscription_upgrade',
              subscriptionId,
              fromPlan: currentPlan.plan_id,
              toPlan: newPlan.plan_id,
              prorationAmount
            }
          );

          chargeResult = { success: true, method: 'credits' };
        } else {
          // Would need to integrate with payment processor for card charges
          this.logger.warn('Insufficient credits for plan upgrade', {
            subscriptionId,
            required: prorationAmount,
            available: creditBalance
          });

          throw new Error('Insufficient credits for plan upgrade. Please add credits first.');
        }
      }

      // Update subscription
      const updates = {
        plan_id: newPlan.plan_id,
        updated_at: new Date()
      };

      // If immediate change, update period dates
      if (options.immediate !== false) {
        if (subscription.status === 'active') {
          // Calculate new period end based on new plan interval
          const newPeriodEnd = moment(now);
          
          switch (newPlan.interval) {
            case 'daily':
              newPeriodEnd.add(1, 'day');
              break;
            case 'weekly':
              newPeriodEnd.add(1, 'week');
              break;
            case 'monthly':
              newPeriodEnd.add(1, 'month');
              break;
            case 'yearly':
              newPeriodEnd.add(1, 'year');
              break;
          }

          updates.current_period_start = now.toDate();
          updates.current_period_end = newPeriodEnd.toDate();
        }
      }

      await this.db('subscriptions')
        .where('subscription_id', subscriptionId)
        .update(updates);

      // Create plan change record
      await this.db('subscription_changes').insert({
        change_id: `chg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        subscription_id: subscriptionId,
        from_plan_id: currentPlan.plan_id,
        to_plan_id: newPlan.plan_id,
        proration_amount: Math.round(prorationAmount),
        change_type: newPlan.price > currentPlan.price ? 'upgrade' : 'downgrade',
        effective_date: now.toDate(),
        metadata: JSON.stringify({
          immediate: options.immediate !== false,
          proration: options.proration !== false,
          chargeResult
        }),
        created_at: new Date()
      });

      // Clear subscription cache
      this.state.subscriptionCache.delete(subscriptionId);

      // Reschedule billing
      await this.scheduleNextBilling(subscriptionId);

      // Publish plan change event
      await this.eventPublisher.publish('billing.subscription.plan_changed', {
        subscriptionId,
        tenantId: subscription.tenant_id,
        fromPlan: currentPlan.plan_id,
        toPlan: newPlan.plan_id,
        changeType: newPlan.price > currentPlan.price ? 'upgrade' : 'downgrade',
        prorationAmount: Math.round(prorationAmount),
        timestamp: new Date()
      });

      this.logger.info('Plan changed successfully', {
        subscriptionId,
        fromPlan: currentPlan.plan_id,
        toPlan: newPlan.plan_id,
        prorationAmount: Math.round(prorationAmount)
      });

      return {
        success: true,
        subscriptionId,
        fromPlan: {
          id: currentPlan.plan_id,
          name: currentPlan.name,
          price: currentPlan.price
        },
        toPlan: {
          id: newPlan.plan_id,
          name: newPlan.name,
          price: newPlan.price
        },
        prorationAmount: Math.round(prorationAmount),
        changeType: newPlan.price > currentPlan.price ? 'upgrade' : 'downgrade',
        effectiveDate: now.toDate(),
        nextBilling: updates.current_period_end
      };

    } catch (error) {
      this.logger.error('Failed to change plan', {
        subscriptionId,
        newPlanId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    try {
      this.logger.info('Canceling subscription', {
        subscriptionId,
        immediate: options.immediate,
        reason: options.reason
      });

      const subscription = await this.getSubscription(subscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status === 'canceled') {
        throw new Error('Subscription is already canceled');
      }

      const now = moment().tz(this.config.defaultTimezone);
      let cancelationDate;
      let newStatus;

      if (options.immediate) {
        // Immediate cancellation
        cancelationDate = now.toDate();
        newStatus = 'canceled';
      } else {
        // Cancel at period end
        cancelationDate = new Date(subscription.current_period_end);
        newStatus = 'cancel_at_period_end';
      }

      // Update subscription
      await this.db('subscriptions')
        .where('subscription_id', subscriptionId)
        .update({
          status: newStatus,
          canceled_at: now.toDate(),
          cancel_at_period_end: !options.immediate,
          cancellation_reason: options.reason,
          updated_at: new Date()
        });

      // Create cancellation record
      await this.db('subscription_cancellations').insert({
        cancellation_id: `can_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        subscription_id: subscriptionId,
        tenant_id: subscription.tenant_id,
        reason: options.reason,
        canceled_by: options.canceledBy || 'tenant',
        immediate: options.immediate || false,
        effective_date: cancelationDate,
        created_at: new Date()
      });

      // Clear subscription cache
      this.state.subscriptionCache.delete(subscriptionId);

      // Cancel scheduled billing jobs
      if (options.immediate) {
        this.cancelScheduledBilling(subscriptionId);
      }

      // Publish cancellation event
      await this.eventPublisher.publish('billing.subscription.canceled', {
        subscriptionId,
        tenantId: subscription.tenant_id,
        planId: subscription.plan_id,
        immediate: options.immediate || false,
        reason: options.reason,
        effectiveDate: cancelationDate,
        timestamp: new Date()
      });

      this.logger.info('Subscription canceled successfully', {
        subscriptionId,
        immediate: options.immediate,
        effectiveDate: cancelationDate
      });

      return {
        success: true,
        subscriptionId,
        status: newStatus,
        effectiveDate: cancelationDate,
        immediate: options.immediate || false
      };

    } catch (error) {
      this.logger.error('Failed to cancel subscription', {
        subscriptionId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process billing for subscription
   */
  async processBilling(subscriptionId) {
    try {
      this.logger.info('Processing billing', {
        subscriptionId
      });

      const subscription = await this.getSubscription(subscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        this.logger.debug('Skipping billing for inactive subscription', {
          subscriptionId,
          status: subscription.status
        });

        return { success: false, reason: 'Subscription not active' };
      }

      const plan = await this.getPlan(subscription.plan_id);
      
      if (!plan) {
        throw new Error(`Plan not found: ${subscription.plan_id}`);
      }

      const now = moment().tz(this.config.defaultTimezone);
      const periodEnd = moment(subscription.current_period_end);

      // Check if billing is due
      if (now.isBefore(periodEnd)) {
        this.logger.debug('Billing not yet due', {
          subscriptionId,
          currentTime: now.toDate(),
          periodEnd: periodEnd.toDate()
        });

        return { success: false, reason: 'Billing not yet due' };
      }

      // If trialing and trial ended, transition to active
      if (subscription.status === 'trialing' && subscription.trial_end && now.isAfter(moment(subscription.trial_end))) {
        await this.transitionFromTrial(subscriptionId);
        
        // Refresh subscription data
        const updatedSubscription = await this.getSubscription(subscriptionId);
        subscription.status = updatedSubscription.status;
      }

      const billingAmount = plan.price * (subscription.quantity || 1);
      
      // Try to charge from credits first
      const creditBalance = await this.creditManager.getCreditBalance(subscription.tenant_id);
      
      let billingResult;
      
      if (creditBalance >= billingAmount) {
        // Pay with credits
        await this.creditManager.consumeCredits(
          subscription.tenant_id,
          billingAmount,
          {
            type: 'subscription_billing',
            subscriptionId,
            planId: subscription.plan_id,
            billingPeriod: `${subscription.current_period_start} - ${subscription.current_period_end}`
          }
        );

        billingResult = {
          success: true,
          method: 'credits',
          amount: billingAmount
        };
      } else {
        // Insufficient credits - would need to charge payment method
        // For now, we'll mark as failed and start dunning process
        billingResult = {
          success: false,
          method: 'credits',
          amount: billingAmount,
          error: 'Insufficient credits'
        };

        await this.startDunningProcess(subscriptionId, billingAmount);
      }

      if (billingResult.success) {
        // Update subscription for next billing cycle
        const nextPeriodStart = moment(subscription.current_period_end);
        const nextPeriodEnd = moment(nextPeriodStart);

        switch (plan.interval) {
          case 'daily':
            nextPeriodEnd.add(1, 'day');
            break;
          case 'weekly':
            nextPeriodEnd.add(1, 'week');
            break;
          case 'monthly':
            nextPeriodEnd.add(1, 'month');
            break;
          case 'yearly':
            nextPeriodEnd.add(1, 'year');
            break;
        }

        await this.db('subscriptions')
          .where('subscription_id', subscriptionId)
          .update({
            current_period_start: nextPeriodStart.toDate(),
            current_period_end: nextPeriodEnd.toDate(),
            last_billing_date: now.toDate(),
            updated_at: new Date()
          });

        // Add included credits for new period
        if (plan.credits_included > 0) {
          await this.creditManager.addCredits(
            subscription.tenant_id,
            plan.credits_included,
            {
              type: 'subscription_included',
              subscriptionId,
              planId: subscription.plan_id,
              period: `${nextPeriodStart.toDate()} - ${nextPeriodEnd.toDate()}`
            }
          );
        }

        // Schedule next billing
        await this.scheduleNextBilling(subscriptionId);

        // Clear subscription cache
        this.state.subscriptionCache.delete(subscriptionId);
      }

      // Create billing record
      await this.db('subscription_billing').insert({
        billing_id: `bil_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        subscription_id: subscriptionId,
        tenant_id: subscription.tenant_id,
        amount: billingAmount,
        currency: plan.currency,
        status: billingResult.success ? 'completed' : 'failed',
        payment_method: billingResult.method,
        billing_date: now.toDate(),
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        metadata: JSON.stringify(billingResult),
        created_at: new Date()
      });

      // Publish billing event
      await this.eventPublisher.publish('billing.subscription.billed', {
        subscriptionId,
        tenantId: subscription.tenant_id,
        planId: subscription.plan_id,
        amount: billingAmount,
        success: billingResult.success,
        method: billingResult.method,
        timestamp: new Date()
      });

      this.logger.info('Billing processed', {
        subscriptionId,
        amount: billingAmount,
        success: billingResult.success,
        method: billingResult.method
      });

      return billingResult;

    } catch (error) {
      this.logger.error('Billing processing failed', {
        subscriptionId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      // Check cache first
      if (this.state.subscriptionCache.has(subscriptionId)) {
        return this.state.subscriptionCache.get(subscriptionId);
      }

      const subscription = await this.db('subscriptions')
        .where('subscription_id', subscriptionId)
        .first();

      if (subscription) {
        // Cache for 5 minutes
        this.state.subscriptionCache.set(subscriptionId, subscription);
        setTimeout(() => {
          this.state.subscriptionCache.delete(subscriptionId);
        }, 5 * 60 * 1000);
      }

      return subscription;

    } catch (error) {
      this.logger.error('Failed to get subscription', {
        subscriptionId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get active subscription for tenant
   */
  async getActiveSubscription(tenantId) {
    try {
      return await this.db('subscriptions')
        .where('tenant_id', tenantId)
        .whereIn('status', ['active', 'trialing', 'cancel_at_period_end'])
        .orderBy('created_at', 'desc')
        .first();

    } catch (error) {
      this.logger.error('Failed to get active subscription', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get subscription plan
   */
  async getPlan(planId) {
    try {
      // Check cache first
      if (this.state.planCache.has(planId)) {
        return this.state.planCache.get(planId);
      }

      let plan = await this.db('subscription_plans')
        .where('plan_id', planId)
        .first();

      // If not in database, check predefined plans
      if (!plan) {
        const predefinedPlan = this.predefinedPlans.find(p => p.plan_id === planId);
        
        if (predefinedPlan) {
          // Insert predefined plan into database
          await this.createPlan(predefinedPlan);
          plan = await this.db('subscription_plans')
            .where('plan_id', planId)
            .first();
        }
      }

      if (plan) {
        // Cache for 10 minutes
        this.state.planCache.set(planId, plan);
        setTimeout(() => {
          this.state.planCache.delete(planId);
        }, 10 * 60 * 1000);
      }

      return plan;

    } catch (error) {
      this.logger.error('Failed to get plan', {
        planId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get all available plans
   */
  async getAllPlans() {
    try {
      // Ensure all predefined plans are in database
      for (const predefinedPlan of this.predefinedPlans) {
        const existingPlan = await this.db('subscription_plans')
          .where('plan_id', predefinedPlan.plan_id)
          .first();

        if (!existingPlan) {
          await this.createPlan(predefinedPlan);
        }
      }

      const plans = await this.db('subscription_plans')
        .where('is_active', true)
        .orderBy('price', 'asc');

      return plans.map(plan => ({
        ...plan,
        features: JSON.parse(plan.features || '{}'),
        limits: JSON.parse(plan.limits || '{}'),
        metadata: JSON.parse(plan.metadata || '{}')
      }));

    } catch (error) {
      this.logger.error('Failed to get all plans', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async validatePlanData(planData) {
    if (!planData.plan_id) {
      throw new Error('Plan ID is required');
    }

    if (!planData.name) {
      throw new Error('Plan name is required');
    }

    if (!planData.price || planData.price < 0) {
      throw new Error('Valid price is required');
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(planData.interval)) {
      throw new Error('Invalid billing interval');
    }
  }

  async validateSubscriptionData(subscriptionData) {
    if (!subscriptionData.tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!subscriptionData.planId) {
      throw new Error('Plan ID is required');
    }

    if (subscriptionData.quantity && subscriptionData.quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }
  }

  async scheduleNextBilling(subscriptionId) {
    // In a real implementation, this would schedule jobs using a job queue
    // For demo purposes, we'll store the scheduled billing in memory
    
    try {
      const subscription = await this.getSubscription(subscriptionId);
      
      if (!subscription) {
        return;
      }

      const billingDate = new Date(subscription.current_period_end);
      const now = Date.now();
      const delay = billingDate.getTime() - now;

      if (delay > 0) {
        const jobId = setTimeout(() => {
          this.processBilling(subscriptionId).catch(error => {
            this.logger.error('Scheduled billing failed', {
              subscriptionId,
              error: error.message
            });
          });
        }, delay);

        this.state.activeJobs.set(subscriptionId, jobId);

        this.logger.debug('Next billing scheduled', {
          subscriptionId,
          billingDate,
          delay
        });
      }

    } catch (error) {
      this.logger.error('Failed to schedule billing', {
        subscriptionId,
        error: error.message
      });
    }
  }

  cancelScheduledBilling(subscriptionId) {
    const jobId = this.state.activeJobs.get(subscriptionId);
    
    if (jobId) {
      clearTimeout(jobId);
      this.state.activeJobs.delete(subscriptionId);

      this.logger.debug('Scheduled billing canceled', {
        subscriptionId
      });
    }
  }

  async transitionFromTrial(subscriptionId) {
    try {
      await this.db('subscriptions')
        .where('subscription_id', subscriptionId)
        .update({
          status: 'active',
          updated_at: new Date()
        });

      // Clear cache
      this.state.subscriptionCache.delete(subscriptionId);

      this.logger.info('Subscription transitioned from trial to active', {
        subscriptionId
      });

    } catch (error) {
      this.logger.error('Failed to transition from trial', {
        subscriptionId,
        error: error.message
      });

      throw error;
    }
  }

  async startDunningProcess(subscriptionId, amount) {
    try {
      this.logger.info('Starting dunning process', {
        subscriptionId,
        amount
      });

      // Create dunning record
      await this.db('subscription_dunning').insert({
        dunning_id: `dun_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        subscription_id: subscriptionId,
        amount,
        attempt: 1,
        max_attempts: this.config.retryAttempts,
        next_attempt: new Date(Date.now() + this.config.retryDelay),
        status: 'active',
        created_at: new Date()
      });

      // Schedule retry attempt
      setTimeout(() => {
        this.retryBilling(subscriptionId).catch(error => {
          this.logger.error('Retry billing failed', {
            subscriptionId,
            error: error.message
          });
        });
      }, this.config.retryDelay);

    } catch (error) {
      this.logger.error('Failed to start dunning process', {
        subscriptionId,
        error: error.message
      });
    }
  }

  async retryBilling(subscriptionId) {
    // Implementation would retry billing and update dunning records
    // This is a simplified version
    
    this.logger.info('Retrying billing', {
      subscriptionId
    });

    // Would attempt billing again here
    // If all attempts fail, suspend or cancel subscription
  }

  initializeBillingJobs() {
    // Initialize cron jobs for billing cycles
    // This runs every hour to check for due subscriptions
    
    cron.schedule('0 * * * *', () => {
      this.processDueBilling().catch(error => {
        this.logger.error('Scheduled billing check failed', {
          error: error.message
        });
      });
    });

    this.logger.info('Billing cron jobs initialized');
  }

  async processDueBilling() {
    try {
      const now = new Date();
      
      const dueSubscriptions = await this.db('subscriptions')
        .where('status', 'active')
        .where('current_period_end', '<=', now)
        .limit(100);

      this.logger.info('Processing due subscriptions', {
        count: dueSubscriptions.length
      });

      for (const subscription of dueSubscriptions) {
        try {
          await this.processBilling(subscription.subscription_id);
        } catch (error) {
          this.logger.error('Failed to process billing for subscription', {
            subscriptionId: subscription.subscription_id,
            error: error.message
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to process due billing', {
        error: error.message
      });
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStatistics(tenantId = null, period = '30d') {
    try {
      const startDate = moment().subtract(30, 'days').toDate();

      let query = this.db('subscriptions')
        .where('created_at', '>=', startDate);

      if (tenantId) {
        query = query.where('tenant_id', tenantId);
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_subscriptions'),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as active_count', ['active']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as trialing_count', ['trialing']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as canceled_count', ['canceled'])
        )
        .first();

      // Calculate MRR (Monthly Recurring Revenue)
      const mrrQuery = this.db('subscriptions as s')
        .join('subscription_plans as p', 's.plan_id', 'p.plan_id')
        .where('s.status', 'active')
        .select(this.db.raw('SUM(p.price * s.quantity) as mrr'))
        .first();

      const mrrResult = await mrrQuery;

      return {
        period: '30d',
        totalSubscriptions: parseInt(stats.total_subscriptions) || 0,
        activeCount: parseInt(stats.active_count) || 0,
        trialingCount: parseInt(stats.trialing_count) || 0,
        canceledCount: parseInt(stats.canceled_count) || 0,
        monthlyRecurringRevenue: parseFloat(mrrResult.mrr) || 0,
        churnRate: stats.total_subscriptions > 0 
          ? (stats.canceled_count / stats.total_subscriptions * 100).toFixed(2)
          : 0
      };

    } catch (error) {
      this.logger.error('Failed to get subscription statistics', {
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
      activeJobs: this.state.activeJobs.size,
      billingQueue: this.state.billingQueue.length,
      subscriptionCache: this.state.subscriptionCache.size,
      planCache: this.state.planCache.size,
      predefinedPlans: this.predefinedPlans.length,
      config: {
        defaultCurrency: this.config.defaultCurrency,
        gracePeriod: this.config.gracePeriod,
        retryAttempts: this.config.retryAttempts
      }
    };
  }
}

module.exports = SubscriptionManager;