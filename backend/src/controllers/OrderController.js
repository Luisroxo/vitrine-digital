const OrderMultiTenantService = require('../services/OrderMultiTenantService');
const db = require('../database/connection');

/**
 * Controller Multi-Tenant para Gerenciamento de Pedidos
 * Endpoints isolados por tenant para operações de pedidos
 */
class OrderController {
  // Instâncias são criadas por tenant conforme necessário
  getTenantOrderService(tenantId) {
    return new OrderMultiTenantService(tenantId);
  }

  /**
   * Cria novo pedido
   * POST /api/orders
   */
  async createOrder(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const {
        customer_name,
        customer_email,
        customer_phone,
        customer_document,
        shipping_address,
        items,
        payment_method,
        notes,
        metadata
      } = req.body;

      // Validar dados obrigatórios
      if (!customer_name || !customer_email || !shipping_address || !items || items.length === 0) {
        return res.status(400).json({
          error: 'Dados incompletos',
          message: 'Nome, email, endereço e itens são obrigatórios'
        });
      }

      // Validar itens
      for (const item of items) {
        if (!item.product_id || !item.quantity || !item.unit_price) {
          return res.status(400).json({
            error: 'Item inválido',
            message: 'Cada item deve ter product_id, quantity e unit_price'
          });
        }
      }

      // Calcular valores
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const shipping_cost = req.body.shipping_cost || 0;
      const discount = req.body.discount || 0;
      const total = subtotal + shipping_cost - discount;

      const orderService = this.getTenantOrderService(tenantId);
      
      const order = await orderService.createOrder({
        customer_name,
        customer_email,
        customer_phone,
        customer_document,
        shipping_address,
        items,
        subtotal,
        shipping_cost,
        discount,
        total,
        payment_method,
        notes,
        metadata
      });

      res.status(201).json({
        success: true,
        message: 'Pedido criado com sucesso',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total: order.total,
          created_at: order.created_at
        }
      });

    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Lista pedidos do tenant
   * GET /api/orders
   */
  async getOrders(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const filters = {
        status: req.query.status,
        payment_status: req.query.payment_status,
        customer_email: req.query.customer_email,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const orderService = this.getTenantOrderService(tenantId);
      const result = await orderService.getOrders(filters);

      res.json({
        success: true,
        tenant_id: tenantId,
        ...result
      });

    } catch (error) {
      console.error('Erro ao listar pedidos:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Busca pedido específico por ID
   * GET /api/orders/:id
   */
  async getOrderById(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          error: 'ID do pedido inválido'
        });
      }

      const orderService = this.getTenantOrderService(tenantId);
      const order = await orderService.getOrderById(parseInt(id));

      res.json({
        success: true,
        tenant_id: tenantId,
        order
      });

    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          error: 'Pedido não encontrado',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Atualiza status do pedido
   * PATCH /api/orders/:id/status
   */
  async updateOrderStatus(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { id } = req.params;
      const { status, comment } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          error: 'ID do pedido inválido'
        });
      }

      if (!status) {
        return res.status(400).json({
          error: 'Status é obrigatório'
        });
      }

      // Validar status permitidos
      const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Status inválido',
          message: `Status deve ser um dos: ${allowedStatuses.join(', ')}`
        });
      }

      const orderService = this.getTenantOrderService(tenantId);
      const updatedOrder = await orderService.updateOrderStatus(
        parseInt(id), 
        status, 
        comment, 
        req.user?.id || 'admin'
      );

      res.json({
        success: true,
        message: `Status atualizado para ${status}`,
        order: {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          updated_at: updatedOrder.updated_at
        }
      });

    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          error: 'Pedido não encontrado',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Atualiza dados do pedido
   * PUT /api/orders/:id
   */
  async updateOrder(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          error: 'ID do pedido inválido'
        });
      }

      // Campos permitidos para atualização
      const allowedFields = [
        'customer_phone', 'shipping_address', 'notes', 
        'tracking_code', 'shipping_company', 'payment_id'
      ];

      const updateFields = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields[key] = updateData[key];
        }
      });

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          error: 'Nenhum campo válido para atualização'
        });
      }

      // Preparar dados para atualização
      if (updateFields.shipping_address && typeof updateFields.shipping_address === 'object') {
        updateFields.shipping_address = JSON.stringify(updateFields.shipping_address);
      }

      updateFields.updated_at = new Date();

      // Atualizar no banco
      const updatedRows = await db('orders')
        .where('id', parseInt(id))
        .where('tenant_id', tenantId)
        .update(updateFields);

      if (updatedRows === 0) {
        return res.status(404).json({
          error: 'Pedido não encontrado'
        });
      }

      // Buscar pedido atualizado
      const orderService = this.getTenantOrderService(tenantId);
      const updatedOrder = await orderService.getOrderById(parseInt(id));

      res.json({
        success: true,
        message: 'Pedido atualizado com sucesso',
        order: updatedOrder
      });

    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Obtém estatísticas de pedidos
   * GET /api/orders/stats
   */
  async getOrderStats(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { period = '30days' } = req.query;

      const orderService = this.getTenantOrderService(tenantId);
      const stats = await orderService.getOrderStats(period);

      res.json({
        success: true,
        ...stats
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Obtém configurações de pedidos do tenant
   * GET /api/orders/settings
   */
  async getOrderSettings(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const orderService = this.getTenantOrderService(tenantId);
      const settings = await orderService.getTenantOrderSettings();

      res.json({
        success: true,
        tenant_id: tenantId,
        settings
      });

    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Atualiza configurações de pedidos do tenant
   * PUT /api/orders/settings
   */
  async updateOrderSettings(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const updateData = req.body;

      // Campos permitidos para atualização
      const allowedFields = [
        'order_prefix', 'auto_confirm', 'auto_process',
        'payment_gateways', 'payment_settings',
        'default_shipping_cost', 'shipping_options', 'calculate_shipping',
        'notify_customer', 'notify_admin', 'email_templates',
        'send_to_bling', 'bling_settings'
      ];

      const updateFields = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields[key] = updateData[key];
        }
      });

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          error: 'Nenhum campo válido para atualização'
        });
      }

      // Preparar campos JSON
      ['payment_gateways', 'payment_settings', 'shipping_options', 'email_templates', 'bling_settings'].forEach(field => {
        if (updateFields[field] && typeof updateFields[field] === 'object') {
          updateFields[field] = JSON.stringify(updateFields[field]);
        }
      });

      updateFields.updated_at = new Date();

      // Verificar se configuração existe
      const existingSettings = await db('order_settings')
        .where('tenant_id', tenantId)
        .first();

      if (existingSettings) {
        // Atualizar existente
        await db('order_settings')
          .where('tenant_id', tenantId)
          .update(updateFields);
      } else {
        // Criar nova configuração
        await db('order_settings').insert({
          tenant_id: tenantId,
          ...updateFields,
          created_at: new Date()
        });
      }

      // Buscar configurações atualizadas
      const orderService = this.getTenantOrderService(tenantId);
      const settings = await orderService.getTenantOrderSettings();

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso',
        settings
      });

    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Busca notificações de pedidos
   * GET /api/orders/:id/notifications
   */
  async getOrderNotifications(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          error: 'ID do pedido inválido'
        });
      }

      const notifications = await db('order_notifications')
        .where('order_id', parseInt(id))
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc');

      res.json({
        success: true,
        tenant_id: tenantId,
        order_id: parseInt(id),
        notifications
      });

    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  /**
   * Cancela pedido
   * POST /api/orders/:id/cancel
   */
  async cancelOrder(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { id } = req.params;
      const { reason } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          error: 'ID do pedido inválido'
        });
      }

      const orderService = this.getTenantOrderService(tenantId);
      
      // Verificar se o pedido pode ser cancelado
      const order = await orderService.getOrderById(parseInt(id));
      
      if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
        return res.status(400).json({
          error: 'Pedido não pode ser cancelado',
          message: `Pedido está no status ${order.status}`
        });
      }

      const updatedOrder = await orderService.updateOrderStatus(
        parseInt(id), 
        'cancelled', 
        reason || 'Cancelado via API',
        req.user?.id || 'admin'
      );

      res.json({
        success: true,
        message: 'Pedido cancelado com sucesso',
        order: {
          id: updatedOrder.id,
          order_number: updatedOrder.order_number,
          status: updatedOrder.status,
          updated_at: updatedOrder.updated_at
        }
      });

    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      
      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          error: 'Pedido não encontrado',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
}

module.exports = OrderController;