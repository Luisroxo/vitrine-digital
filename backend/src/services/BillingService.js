const db = require('../database/connection');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * BillingService - Sistema de cobrança simplificado
 * Modelo: Fornecedor STARTER + Lojista STANDARD (sem comissões)
 */
class BillingService {
  constructor(tenantId = null) {
    this.tenantId = tenantId;
  }

  /**
   * Cria assinatura para tenant
   * @param {number} tenantId - ID do tenant
   * @param {string} planType - 'supplier' ou 'retailer'
   * @param {Object} paymentData - Dados de pagamento
   * @returns {Object} Assinatura criada
   */
  async createSubscription(tenantId, planType, paymentData = {}) {
    try {
      // Buscar plano
      const plan = await db('billing_plans')
        .where('target_type', planType)
        .where('active', true)
        .first();

      if (!plan) {
        throw new Error(`Plano ${planType} não encontrado`);
      }

      // Verificar se tenant já tem assinatura
      const existingSubscription = await db('billing_subscriptions')
        .where('tenant_id', tenantId)
        .first();

      if (existingSubscription) {
        throw new Error('Tenant já possui uma assinatura ativa');
      }

      // Buscar dados do tenant
      const tenant = await db('tenants').where('id', tenantId).first();
      if (!tenant) {
        throw new Error('Tenant não encontrado');
      }

      const trx = await db.transaction();

      try {
        // Criar customer no Stripe (se necessário)
        let stripeCustomerId = null;
        let stripeSubscriptionId = null;

        if (paymentData.stripe_token || paymentData.payment_method) {
          const customer = await stripe.customers.create({
            email: tenant.email || `${tenant.slug}@vitrine360.com.br`,
            name: tenant.name,
            metadata: {
              tenant_id: tenantId.toString(),
              plan_type: planType
            }
          });
          stripeCustomerId = customer.id;

          // Criar produto e price no Stripe
          const stripeProduct = await stripe.products.create({
            name: `Vitrine Digital - ${plan.name}`,
            metadata: {
              plan_id: plan.id.toString(),
              target_type: planType
            }
          });

          const stripePrice = await stripe.prices.create({
            unit_amount: plan.price_cents,
            currency: 'brl',
            recurring: { interval: 'month' },
            product: stripeProduct.id
          });

          // Criar assinatura no Stripe
          const stripeSubscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{ price: stripePrice.id }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            trial_period_days: planType === 'supplier' ? 7 : 30, // Trial diferenciado
            metadata: {
              tenant_id: tenantId.toString(),
              plan_id: plan.id.toString()
            }
          });

          stripeSubscriptionId = stripeSubscription.id;
        }

        // Calcular datas de trial e período
        const now = new Date();
        const trialDays = planType === 'supplier' ? 7 : 30;
        const trialEndsAt = new Date(now.getTime() + (trialDays * 24 * 60 * 60 * 1000));
        
        // Criar assinatura local
        const subscription = await trx('billing_subscriptions').insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status: 'trial',
          trial_ends_at: trialEndsAt,
          current_period_start: now,
          current_period_end: trialEndsAt,
          created_at: now,
          updated_at: now
        });

        await trx.commit();

        return {
          subscription_id: subscription[0],
          plan: plan.name,
          trial_days: trialDays,
          trial_ends_at: trialEndsAt,
          monthly_price: plan.price_cents / 100,
          setup_fee: plan.setup_fee_cents / 100,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId
        };

      } catch (error) {
        await trx.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      throw error;
    }
  }

  /**
   * Busca assinatura do tenant
   * @param {number} tenantId - ID do tenant
   * @returns {Object} Dados da assinatura
   */
  async getSubscription(tenantId) {
    const subscription = await db('billing_subscriptions as s')
      .leftJoin('billing_plans as p', 's.plan_id', 'p.id')
      .where('s.tenant_id', tenantId)
      .select(
        's.*',
        'p.name as plan_name',
        'p.price_cents',
        'p.setup_fee_cents',
        'p.features',
        'p.limits',
        'p.target_type'
      )
      .first();

    if (!subscription) {
      return null;
    }

    // Calcular status do trial
    const now = new Date();
    const isTrialActive = subscription.trial_ends_at && new Date(subscription.trial_ends_at) > now;
    const daysUntilTrialEnd = isTrialActive ? 
      Math.ceil((new Date(subscription.trial_ends_at) - now) / (1000 * 60 * 60 * 24)) : 0;

    return {
      ...subscription,
      is_trial_active: isTrialActive,
      days_until_trial_end: daysUntilTrialEnd,
      monthly_price: subscription.price_cents / 100,
      setup_fee: subscription.setup_fee_cents / 100,
      features: JSON.parse(subscription.features || '{}'),
      limits: JSON.parse(subscription.limits || '{}')
    };
  }

  /**
   * Processar webhook do Stripe
   * @param {Object} event - Evento do Stripe
   */
  async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
          
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object);
          break;
          
        default:
          console.log(`Webhook não tratado: ${event.type}`);
      }
    } catch (error) {
      console.error('Erro no webhook:', error);
      throw error;
    }
  }

  /**
   * Lidar com pagamento bem-sucedido
   */
  async handlePaymentSucceeded(invoice) {
    const subscription = await db('billing_subscriptions')
      .where('stripe_subscription_id', invoice.subscription)
      .first();

    if (!subscription) return;

    await db('billing_subscriptions')
      .where('id', subscription.id)
      .update({
        status: 'active',
        updated_at: new Date()
      });

    // Registrar pagamento
    await db('billing_payments').insert({
      invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      method: 'card',
      status: 'succeeded',
      gateway: 'stripe',
      processed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`✅ Pagamento processado para tenant ${subscription.tenant_id}`);
  }

  /**
   * Lidar com falha no pagamento
   */
  async handlePaymentFailed(invoice) {
    const subscription = await db('billing_subscriptions')
      .where('stripe_subscription_id', invoice.subscription)
      .first();

    if (!subscription) return;

    await db('billing_subscriptions')
      .where('id', subscription.id)
      .update({
        status: 'past_due',
        updated_at: new Date()
      });

    console.log(`❌ Falha no pagamento para tenant ${subscription.tenant_id}`);
  }

  /**
   * Cancelar assinatura
   * @param {number} tenantId - ID do tenant
   * @param {string} reason - Motivo do cancelamento
   */
  async cancelSubscription(tenantId, reason = 'Cancelamento solicitado') {
    const subscription = await db('billing_subscriptions')
      .where('tenant_id', tenantId)
      .first();

    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Cancelar no Stripe
    if (subscription.stripe_subscription_id) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    }

    // Cancelar localmente
    await db('billing_subscriptions')
      .where('id', subscription.id)
      .update({
        status: 'canceled',
        canceled_at: new Date(),
        cancellation_reason: reason,
        updated_at: new Date()
      });

    return true;
  }

  /**
   * Obter estatísticas de billing
   * @returns {Object} Estatísticas
   */
  async getBillingStats() {
    const stats = await db('billing_subscriptions as s')
      .leftJoin('billing_plans as p', 's.plan_id', 'p.id')
      .select(
        db.raw('COUNT(*) as total_subscriptions'),
        db.raw('SUM(CASE WHEN s.status = "active" THEN 1 ELSE 0 END) as active_subscriptions'),
        db.raw('SUM(CASE WHEN s.status = "trial" THEN 1 ELSE 0 END) as trial_subscriptions'),
        db.raw('SUM(CASE WHEN s.status = "active" THEN p.price_cents ELSE 0 END) as monthly_revenue_cents'),
        db.raw('SUM(CASE WHEN p.target_type = "supplier" THEN 1 ELSE 0 END) as suppliers'),
        db.raw('SUM(CASE WHEN p.target_type = "retailer" THEN 1 ELSE 0 END) as retailers')
      )
      .first();

    return {
      total_subscriptions: parseInt(stats.total_subscriptions) || 0,
      active_subscriptions: parseInt(stats.active_subscriptions) || 0,
      trial_subscriptions: parseInt(stats.trial_subscriptions) || 0,
      monthly_revenue: (stats.monthly_revenue_cents || 0) / 100,
      annual_revenue: ((stats.monthly_revenue_cents || 0) / 100) * 12,
      suppliers: parseInt(stats.suppliers) || 0,
      retailers: parseInt(stats.retailers) || 0
    };
  }

  /**
   * Verificar limites do plano
   * @param {number} tenantId - ID do tenant
   * @param {string} resource - Recurso a verificar ('retailers', 'domains', etc)
   * @returns {Object} Status dos limites
   */
  async checkPlanLimits(tenantId, resource = null) {
    const subscription = await this.getSubscription(tenantId);
    
    if (!subscription) {
      return { allowed: false, reason: 'Sem assinatura ativa' };
    }

    if (subscription.status !== 'active' && subscription.status !== 'trial') {
      return { allowed: false, reason: 'Assinatura inativa' };
    }

    const limits = subscription.limits;
    
    if (resource && limits[resource] !== undefined) {
      if (limits[resource] === -1) {
        return { allowed: true, unlimited: true };
      }
      
      // Verificar uso atual vs limite
      // (implementar conforme necessário)
      return { allowed: true, limit: limits[resource] };
    }

    return { allowed: true, limits };
  }
}

module.exports = BillingService;