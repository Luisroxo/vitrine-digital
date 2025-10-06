const db = require('../database/connection');

/**
 * Serviço Multi-Tenant para Gerenciamento de Pedidos
 * Isolamento completo de pedidos por tenant
 */
class OrderMultiTenantService {
  constructor(tenantId) {
    this.tenantId = tenantId;
    
    // Cache para configurações do tenant
    this.settingsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtém configurações de pedidos do tenant
   */
  async getTenantOrderSettings() {
    try {
      const cacheKey = `order_settings_${this.tenantId}`;
      const cached = this.settingsCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        return cached.data;
      }

      let settings = await db('order_settings')
        .where('tenant_id', this.tenantId)
        .first();

      // Criar configurações padrão se não existir
      if (!settings) {
        settings = await this.createDefaultSettings();
      }

      // Atualizar cache
      this.settingsCache.set(cacheKey, {
        data: settings,
        timestamp: Date.now()
      });

      return settings;
    } catch (error) {
      console.error(`Erro ao buscar configurações do tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Cria configurações padrão para o tenant
   */
  async createDefaultSettings() {
    try {
      const defaultSettings = {
        tenant_id: this.tenantId,
        order_prefix: 'PED',
        next_order_number: 1,
        auto_confirm: false,
        auto_process: false,
        payment_gateways: {
          pix: { enabled: true },
          credit_card: { enabled: false },
          bank_slip: { enabled: false }
        },
        default_shipping_cost: 0,
        notify_customer: true,
        notify_admin: true,
        send_to_bling: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      const [id] = await db('order_settings').insert(defaultSettings);
      return { id, ...defaultSettings };
    } catch (error) {
      console.error(`Erro ao criar configurações padrão para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Gera próximo número de pedido para o tenant
   */
  async generateOrderNumber() {
    try {
      const settings = await this.getTenantOrderSettings();
      const orderNumber = `${settings.order_prefix}-${this.tenantId}-${settings.next_order_number.toString().padStart(6, '0')}`;
      
      // Atualizar próximo número
      await db('order_settings')
        .where('tenant_id', this.tenantId)
        .increment('next_order_number', 1);

      // Limpar cache
      this.settingsCache.delete(`order_settings_${this.tenantId}`);
      
      return orderNumber;
    } catch (error) {
      console.error(`Erro ao gerar número do pedido para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Cria um novo pedido
   */
  async createOrder(orderData) {
    const trx = await db.transaction();
    
    try {
      console.log(`📋 Criando pedido para tenant ${this.tenantId}:`, {
        customer: orderData.customer_name,
        items: orderData.items?.length || 0,
        total: orderData.total
      });

      // Gerar número do pedido
      const orderNumber = await this.generateOrderNumber();

      // Preparar dados do pedido
      const order = {
        tenant_id: this.tenantId,
        order_number: orderNumber,
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone || null,
        customer_document: orderData.customer_document || null,
        shipping_address: JSON.stringify(orderData.shipping_address),
        subtotal: orderData.subtotal,
        shipping_cost: orderData.shipping_cost || 0,
        discount: orderData.discount || 0,
        total: orderData.total,
        payment_method: orderData.payment_method || null,
        notes: orderData.notes || null,
        metadata: orderData.metadata ? JSON.stringify(orderData.metadata) : null,
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Inserir pedido
      const [orderId] = await trx('orders').insert(order);

      // Inserir itens do pedido
      if (orderData.items && orderData.items.length > 0) {
        const orderItems = await Promise.all(orderData.items.map(async (item) => {
          // Buscar dados atuais do produto para snapshot
          const product = await trx('products')
            .where('id', item.product_id)
            .where('tenant_id', this.tenantId)
            .first();

          if (!product) {
            throw new Error(`Produto ${item.product_id} não encontrado para o tenant`);
          }

          return {
            order_id: orderId,
            product_id: item.product_id,
            tenant_id: this.tenantId,
            product_name: product.nome,
            product_sku: product.codigo || null,
            product_image: product.imagem || null,
            product_data: JSON.stringify({
              id: product.id,
              nome: product.nome,
              preco: product.preco,
              categoria: product.categoria,
              codigo: product.codigo
            }),
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            created_at: new Date(),
            updated_at: new Date()
          };
        }));

        await trx('order_items').insert(orderItems);
      }

      // Registrar status inicial
      await this.addStatusHistory(trx, orderId, 'pending', null, 'Pedido criado', 'system');

      await trx.commit();

      // Buscar pedido completo
      const completeOrder = await this.getOrderById(orderId);

      // Processar ações pós-criação
      await this.processOrderCreated(completeOrder);

      console.log(`✅ Pedido ${orderNumber} criado com sucesso para tenant ${this.tenantId}`);
      
      return completeOrder;

    } catch (error) {
      await trx.rollback();
      console.error(`Erro ao criar pedido para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Busca pedido por ID (isolado por tenant)
   */
  async getOrderById(orderId) {
    try {
      const order = await db('orders')
        .where('id', orderId)
        .where('tenant_id', this.tenantId)
        .first();

      if (!order) {
        throw new Error(`Pedido ${orderId} não encontrado para o tenant ${this.tenantId}`);
      }

      // Buscar itens do pedido
      const items = await db('order_items')
        .where('order_id', orderId)
        .where('tenant_id', this.tenantId)
        .select('*');

      // Buscar histórico de status
      const statusHistory = await db('order_status_history')
        .where('order_id', orderId)
        .where('tenant_id', this.tenantId)
        .orderBy('created_at', 'desc');

      // Parsear dados JSON
      order.shipping_address = JSON.parse(order.shipping_address || '{}');
      order.payment_data = order.payment_data ? JSON.parse(order.payment_data) : null;
      order.metadata = order.metadata ? JSON.parse(order.metadata) : null;

      // Parsear dados dos itens
      order.items = items.map(item => ({
        ...item,
        product_data: item.product_data ? JSON.parse(item.product_data) : null
      }));

      order.status_history = statusHistory;

      return order;
    } catch (error) {
      console.error(`Erro ao buscar pedido ${orderId} para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Lista pedidos do tenant com filtros
   */
  async getOrders(filters = {}) {
    try {
      let query = db('orders')
        .where('tenant_id', this.tenantId)
        .orderBy('created_at', 'desc');

      // Aplicar filtros
      if (filters.status) {
        query = query.where('status', filters.status);
      }

      if (filters.payment_status) {
        query = query.where('payment_status', filters.payment_status);
      }

      if (filters.customer_email) {
        query = query.where('customer_email', 'like', `%${filters.customer_email}%`);
      }

      if (filters.date_from) {
        query = query.where('created_at', '>=', filters.date_from);
      }

      if (filters.date_to) {
        query = query.where('created_at', '<=', filters.date_to);
      }

      // Paginação
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      const [orders, [{ total }]] = await Promise.all([
        query.limit(limit).offset(offset),
        db('orders')
          .where('tenant_id', this.tenantId)
          .count('* as total')
      ]);

      // Parsear dados JSON dos pedidos
      const formattedOrders = orders.map(order => ({
        ...order,
        shipping_address: JSON.parse(order.shipping_address || '{}'),
        payment_data: order.payment_data ? JSON.parse(order.payment_data) : null,
        metadata: order.metadata ? JSON.parse(order.metadata) : null
      }));

      return {
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error(`Erro ao listar pedidos para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza status do pedido
   */
  async updateOrderStatus(orderId, newStatus, comment = null, updatedBy = 'system') {
    const trx = await db.transaction();
    
    try {
      // Buscar pedido atual
      const order = await trx('orders')
        .where('id', orderId)
        .where('tenant_id', this.tenantId)
        .first();

      if (!order) {
        throw new Error(`Pedido ${orderId} não encontrado para o tenant ${this.tenantId}`);
      }

      const previousStatus = order.status;

      // Validar transição de status
      if (previousStatus === newStatus) {
        throw new Error(`Pedido já está no status ${newStatus}`);
      }

      // Atualizar status do pedido
      await trx('orders')
        .where('id', orderId)
        .where('tenant_id', this.tenantId)
        .update({
          status: newStatus,
          updated_at: new Date(),
          ...(newStatus === 'shipped' && { shipped_at: new Date() }),
          ...(newStatus === 'delivered' && { delivered_at: new Date() })
        });

      // Registrar no histórico
      await this.addStatusHistory(trx, orderId, newStatus, previousStatus, comment, updatedBy);

      await trx.commit();

      // Buscar pedido atualizado
      const updatedOrder = await this.getOrderById(orderId);

      // Processar ações pós-atualização
      await this.processStatusChange(updatedOrder, previousStatus, newStatus);

      console.log(`✅ Status do pedido ${order.order_number} alterado de ${previousStatus} para ${newStatus}`);
      
      return updatedOrder;

    } catch (error) {
      await trx.rollback();
      console.error(`Erro ao atualizar status do pedido ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Adiciona entrada no histórico de status
   */
  async addStatusHistory(trx, orderId, status, previousStatus, comment, updatedBy) {
    return await trx('order_status_history').insert({
      order_id: orderId,
      tenant_id: this.tenantId,
      status,
      previous_status: previousStatus,
      comment,
      updated_by: updatedBy,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  /**
   * Processa ações após criação do pedido
   */
  async processOrderCreated(order) {
    try {
      const settings = await this.getTenantOrderSettings();

      // Enviar notificação de pedido criado
      if (settings.notify_customer) {
        await this.sendNotification(order.id, 'order_created', 'email', order.customer_email);
      }

      // Auto-confirmar pedido se configurado
      if (settings.auto_confirm) {
        setTimeout(async () => {
          try {
            await this.updateOrderStatus(order.id, 'confirmed', 'Auto-confirmado pelo sistema', 'system');
          } catch (error) {
            console.error('Erro na auto-confirmação:', error);
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Erro no processamento pós-criação:', error);
    }
  }

  /**
   * Processa mudanças de status
   */
  async processStatusChange(order, previousStatus, newStatus) {
    try {
      const settings = await this.getTenantOrderSettings();

      // Mapear status para tipos de notificação
      const statusNotificationMap = {
        'confirmed': 'payment_confirmed',
        'shipped': 'order_shipped',
        'delivered': 'order_delivered',
        'cancelled': 'order_cancelled'
      };

      const notificationType = statusNotificationMap[newStatus];
      
      if (notificationType && settings.notify_customer) {
        await this.sendNotification(order.id, notificationType, 'email', order.customer_email);
      }

      // Enviar para Bling se configurado
      if (settings.send_to_bling && newStatus === 'confirmed') {
        await this.sendOrderToBling(order);
      }

    } catch (error) {
      console.error('Erro no processamento de mudança de status:', error);
    }
  }

  /**
   * Envia notificação
   */
  async sendNotification(orderId, type, channel, recipient) {
    try {
      await db('order_notifications').insert({
        order_id: orderId,
        tenant_id: this.tenantId,
        type,
        channel,
        recipient,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      console.log(`📧 Notificação ${type} agendada para ${recipient}`);
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
    }
  }

  /**
   * Envia pedido para o Bling
   */
  async sendOrderToBling(order) {
    try {
      // Integração com BlingMultiTenantService
      const BlingService = require('./BlingMultiTenantService');
      const blingService = new BlingService(this.tenantId);
      
      await blingService.initialize();
      const blingOrder = await blingService.createOrder({
        numero: order.order_number,
        cliente: {
          nome: order.customer_name,
          email: order.customer_email,
          telefone: order.customer_phone
        },
        itens: order.items.map(item => ({
          produtoId: item.product_data?.bling_id || item.product_id,
          quantidade: item.quantity,
          preco: item.unit_price
        })),
        total: order.total
      });

      // Atualizar pedido com ID externo
      await db('orders')
        .where('id', order.id)
        .where('tenant_id', this.tenantId)
        .update({
          external_id: blingOrder.id,
          updated_at: new Date()
        });

      console.log(`✅ Pedido ${order.order_number} enviado para Bling com ID ${blingOrder.id}`);

    } catch (error) {
      console.error('Erro ao enviar pedido para Bling:', error);
    }
  }

  /**
   * Obtém estatísticas de pedidos do tenant
   */
  async getOrderStats(period = '30days') {
    try {
      const periodMap = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
        '1year': 365
      };

      const days = periodMap[period] || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await db('orders')
        .where('tenant_id', this.tenantId)
        .where('created_at', '>=', startDate)
        .select(
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(CASE WHEN status = "completed" OR status = "delivered" THEN total ELSE 0 END) as total_revenue'),
          db.raw('AVG(total) as average_order_value'),
          db.raw('SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_orders'),
          db.raw('SUM(CASE WHEN status = "confirmed" THEN 1 ELSE 0 END) as confirmed_orders'),
          db.raw('SUM(CASE WHEN status = "shipped" THEN 1 ELSE 0 END) as shipped_orders'),
          db.raw('SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered_orders'),
          db.raw('SUM(CASE WHEN status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders')
        )
        .first();

      return {
        period,
        tenant_id: this.tenantId,
        stats: {
          total_orders: parseInt(stats.total_orders) || 0,
          total_revenue: parseFloat(stats.total_revenue) || 0,
          average_order_value: parseFloat(stats.average_order_value) || 0,
          pending_orders: parseInt(stats.pending_orders) || 0,
          confirmed_orders: parseInt(stats.confirmed_orders) || 0,
          shipped_orders: parseInt(stats.shipped_orders) || 0,
          delivered_orders: parseInt(stats.delivered_orders) || 0,
          cancelled_orders: parseInt(stats.cancelled_orders) || 0
        }
      };
    } catch (error) {
      console.error(`Erro ao buscar estatísticas para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }
}

module.exports = OrderMultiTenantService;