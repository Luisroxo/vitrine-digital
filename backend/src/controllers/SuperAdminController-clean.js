const db = require('../database/connection');

/**
 * Super Admin Controller - Controle global da plataforma
 * Para o dono da plataforma (HUB360PLUS) gerenciar todos fornecedores e assinaturas
 */
class SuperAdminController {

  /**
   * Dashboard com métricas globais da plataforma
   */
  async getDashboardMetrics(req, res) {
    try {
      // Métricas de Receita
      const revenueStats = await db('billing_subscriptions as bs')
        .join('billing_plans as bp', 'bs.plan_id', 'bp.id')
        .select(
          db.raw('COALESCE(SUM(bp.price_cents), 0) / 100 as total_mrr'),
          db.raw('COUNT(CASE WHEN bs.status = ? THEN 1 END) as active_subs', ['active']),
          db.raw('COUNT(CASE WHEN bs.status = ? THEN 1 END) as canceled_subs', ['canceled']),
          db.raw('COALESCE(AVG(bp.price_cents), 0) / 100 as avg_subscription_value')
        )
        .first();

      // Métricas de Tenants (Fornecedores)
      const tenantStats = await db('tenants')
        .select(
          db.raw('COUNT(*) as total_suppliers'),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as active_suppliers', ['active']),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_suppliers', ['pending'])
        )
        .first();

      // Métricas de Lojistas (usando partnerships)
      const retailerStats = await db('partnerships')
        .select(
          db.raw('COUNT(*) as total_retailers'),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as active_partnerships', ['active'])
        )
        .first();

      // Métricas de Pedidos
      const orderStats = await db('orders')
        .select(
          db.raw('COUNT(*) as total_orders'),
          db.raw('COALESCE(SUM(total_amount), 0) as total_revenue'),
          db.raw('COALESCE(AVG(total_amount), 0) as avg_order_value')
        )
        .first();

      res.json({
        success: true,
        metrics: {
          revenue: {
            total_mrr: parseFloat(revenueStats.total_mrr || 0),
            active_subscriptions: parseInt(revenueStats.active_subs || 0),
            canceled_subscriptions: parseInt(revenueStats.canceled_subs || 0),
            avg_subscription_value: parseFloat(revenueStats.avg_subscription_value || 0)
          },
          suppliers: {
            total: parseInt(tenantStats.total_suppliers || 0),
            active: parseInt(tenantStats.active_suppliers || 0),
            pending: parseInt(tenantStats.pending_suppliers || 0)
          },
          retailers: {
            total: parseInt(retailerStats.total_retailers || 0),
            active_partnerships: parseInt(retailerStats.active_partnerships || 0)
          },
          orders: {
            total: parseInt(orderStats.total_orders || 0),
            total_revenue: parseFloat(orderStats.total_revenue || 0),
            avg_order_value: parseFloat(orderStats.avg_order_value || 0)
          }
        }
      });

    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Listar todos os fornecedores com suas assinaturas
   */
  async getAllSuppliers(req, res) {
    try {
      const { page = 1, limit = 20, status = '', search = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = db('tenants as t')
        .leftJoin('billing_subscriptions as bs', 't.id', 'bs.tenant_id')
        .leftJoin('billing_plans as bp', 'bs.plan_id', 'bp.id')
        .leftJoin('bling_config as bc', 't.id', 'bc.tenant_id')
        .select(
          't.id',
          't.name',
          't.email',
          't.domain',
          't.status as tenant_status',
          't.created_at',
          'bs.id as subscription_id',
          'bs.status as subscription_status',
          'bp.name as plan_name',
          db.raw('COALESCE(bp.price_cents, 0) / 100 as plan_value'),
          db.raw(`CASE 
            WHEN bc.access_token IS NOT NULL AND bc.expires_at > NOW() THEN 'connected'
            WHEN bc.access_token IS NOT NULL AND bc.expires_at <= NOW() THEN 'expired'
            WHEN bc.id IS NOT NULL THEN 'error'
            ELSE 'pending'
          END as bling_status`)
        );

      // Filtros
      if (status) {
        query = query.where('t.status', status);
      }
      
      if (search) {
        query = query.where(function() {
          this.where('t.name', 'ilike', `%${search}%`)
              .orWhere('t.email', 'ilike', `%${search}%`)
              .orWhere('t.domain', 'ilike', `%${search}%`);
        });
      }

      const suppliers = await query
        .orderBy('t.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const totalQuery = db('tenants').count('id as count');
      if (status) totalQuery.where('status', status);
      const total = await totalQuery.first();

      res.json({
        success: true,
        data: suppliers,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total.count / limit),
          total_items: parseInt(total.count),
          per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Gerar NFe de Serviço via Bling para assinatura
   */
  async generateServiceNFe(req, res) {
    try {
      const { subscriptionId } = req.params;

      // Buscar dados da assinatura
      const subscription = await db('billing_subscriptions as bs')
        .join('billing_plans as bp', 'bs.plan_id', 'bp.id')
        .join('tenants as t', 'bs.tenant_id', 't.id')
        .select(
          'bs.*',
          'bp.name as plan_name',
          'bp.price_cents',
          't.name as supplier_name',
          't.email as supplier_email'
        )
        .where('bs.id', subscriptionId)
        .first();

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Assinatura não encontrada'
        });
      }

      // Simular geração de NFe (aqui você integraria com Bling)
      const nfeData = {
        id: `NFE-${Date.now()}`,
        numero: `SV-${Date.now()}`,
        status: 'generated',
        amount: subscription.price_cents / 100,
        supplier_name: subscription.supplier_name,
        plan_name: subscription.plan_name,
        generated_at: new Date()
      };

      res.json({
        success: true,
        message: 'NFe de serviço simulada com sucesso',
        nfe: nfeData
      });

    } catch (error) {
      console.error('Erro ao gerar NFe de serviço:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Suspender/Reativar fornecedor
   */
  async toggleSupplierStatus(req, res) {
    try {
      const { supplierId } = req.params;
      const { action, reason } = req.body; // action: 'suspend' | 'activate'

      const supplier = await db('tenants').where('id', supplierId).first();
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: 'Fornecedor não encontrado'
        });
      }

      const newStatus = action === 'suspend' ? 'suspended' : 'active';
      
      await db('tenants')
        .where('id', supplierId)
        .update({
          status: newStatus,
          updated_at: new Date()
        });

      res.json({
        success: true,
        message: `Fornecedor ${action === 'suspend' ? 'suspenso' : 'reativado'} com sucesso`
      });

    } catch (error) {
      console.error('Erro ao alterar status do fornecedor:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }

  /**
   * Listar todas as assinaturas
   */
  async getAllSubscriptions(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const subscriptions = await db('billing_subscriptions as bs')
        .join('billing_plans as bp', 'bs.plan_id', 'bp.id')
        .join('tenants as t', 'bs.tenant_id', 't.id')
        .select(
          'bs.id',
          'bs.status',
          'bs.created_at',
          'bp.name as plan_name',
          'bp.price_cents',
          't.name as supplier_name',
          't.email as supplier_email'
        )
        .orderBy('bs.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await db('billing_subscriptions').count('id as count').first();

      res.json({
        success: true,
        data: subscriptions,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total.count / limit),
          total_items: parseInt(total.count),
          per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
}

module.exports = SuperAdminController;