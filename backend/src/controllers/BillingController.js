const BillingService = require('../services/BillingService');

class BillingController {

  /**
   * Listar planos disponíveis
   * GET /billing/plans
   */
  static async getPlans(req, res) {
    try {
      const db = require('../database/connection');
      
      const plans = await db('billing_plans')
        .where('active', true)
        .select('*');

      const formattedPlans = plans.map(plan => ({
        ...plan,
        price: plan.price_cents / 100,
        setup_fee: plan.setup_fee_cents / 100,
        features: JSON.parse(plan.features || '{}'),
        limits: JSON.parse(plan.limits || '{}')
      }));

      res.json({
        success: true,
        data: formattedPlans
      });

    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Criar nova assinatura
   * POST /billing/subscribe
   */
  static async createSubscription(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { plan_type, payment_data } = req.body;

      if (!plan_type || !['supplier', 'retailer'].includes(plan_type)) {
        return res.status(400).json({
          error: 'Tipo de plano inválido. Use "supplier" ou "retailer"'
        });
      }

      const billingService = new BillingService(tenantId);
      
      const subscription = await billingService.createSubscription(
        tenantId, 
        plan_type, 
        payment_data || {}
      );

      res.status(201).json({
        success: true,
        message: 'Assinatura criada com sucesso!',
        data: subscription
      });

    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Buscar assinatura atual do tenant
   * GET /billing/subscription
   */
  static async getSubscription(req, res) {
    try {
      const { tenantId } = req.tenant;
      const billingService = new BillingService(tenantId);
      
      const subscription = await billingService.getSubscription(tenantId);

      if (!subscription) {
        return res.json({
          success: true,
          data: null,
          message: 'Nenhuma assinatura encontrada'
        });
      }

      res.json({
        success: true,
        data: subscription
      });

    } catch (error) {
      console.error('Erro ao buscar assinatura:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Cancelar assinatura
   * DELETE /billing/subscription
   */
  static async cancelSubscription(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { reason } = req.body;

      const billingService = new BillingService(tenantId);
      
      await billingService.cancelSubscription(
        tenantId, 
        reason || 'Cancelamento solicitado pelo usuário'
      );

      res.json({
        success: true,
        message: 'Assinatura cancelada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  /**
   * Webhook do Stripe
   * POST /billing/webhook/stripe
   */
  static async stripeWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;
      
      if (endpointSecret) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        event = req.body;
      }

      const billingService = new BillingService();
      await billingService.handleStripeWebhook(event);

      res.json({ received: true });

    } catch (error) {
      console.error('Erro no webhook Stripe:', error);
      res.status(400).json({
        error: `Webhook error: ${error.message}`
      });
    }
  }

  /**
   * Estatísticas de billing (admin)
   * GET /billing/stats
   */
  static async getBillingStats(req, res) {
    try {
      const billingService = new BillingService();
      const stats = await billingService.getBillingStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Verificar limites do plano
   * GET /billing/limits/:resource?
   */
  static async checkLimits(req, res) {
    try {
      const { tenantId } = req.tenant;
      const { resource } = req.params;

      const billingService = new BillingService(tenantId);
      const limits = await billingService.checkPlanLimits(tenantId, resource);

      res.json({
        success: true,
        data: limits
      });

    } catch (error) {
      console.error('Erro ao verificar limites:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Histórico de pagamentos
   * GET /billing/payments
   */
  static async getPaymentHistory(req, res) {
    try {
      const { tenantId } = req.tenant;
      const db = require('../database/connection');

      const payments = await db('billing_payments as p')
        .leftJoin('billing_invoices as i', 'p.invoice_id', 'i.id')
        .leftJoin('billing_subscriptions as s', 'i.subscription_id', 's.id')
        .where('s.tenant_id', tenantId)
        .select(
          'p.*',
          'i.invoice_number',
          'i.due_date',
          db.raw('p.amount_cents / 100 as amount')
        )
        .orderBy('p.created_at', 'desc');

      res.json({
        success: true,
        data: payments
      });

    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Próxima cobrança
   * GET /billing/next-charge
   */
  static async getNextCharge(req, res) {
    try {
      const { tenantId } = req.tenant;
      const billingService = new BillingService(tenantId);
      
      const subscription = await billingService.getSubscription(tenantId);

      if (!subscription) {
        return res.json({
          success: true,
          data: null,
          message: 'Nenhuma assinatura ativa'
        });
      }

      const nextCharge = {
        date: subscription.current_period_end,
        amount: subscription.monthly_price,
        plan: subscription.plan_name,
        status: subscription.status,
        is_trial: subscription.is_trial_active
      };

      res.json({
        success: true,
        data: nextCharge
      });

    } catch (error) {
      console.error('Erro ao buscar próxima cobrança:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * Dashboard financeiro resumido
   * GET /billing/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const { tenantId } = req.tenant;
      const billingService = new BillingService(tenantId);
      
      const [subscription, stats] = await Promise.all([
        billingService.getSubscription(tenantId),
        billingService.getBillingStats()
      ]);

      const dashboard = {
        subscription: subscription,
        stats: {
          monthly_cost: subscription ? subscription.monthly_price : 0,
          annual_cost: subscription ? subscription.monthly_price * 12 : 0,
          trial_active: subscription ? subscription.is_trial_active : false,
          days_until_charge: subscription ? subscription.days_until_trial_end : 0
        }
      };

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      console.error('Erro ao buscar dashboard:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }
}

module.exports = BillingController;