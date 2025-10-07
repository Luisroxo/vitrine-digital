const { Logger } = require('../../../shared');
const BlingAPI = require('./BlingAPI');
const BlingTokenManager = require('./BlingTokenManager');

/**
 * Advanced Order Management Service for Bling ERP integration
 */
class BlingOrderManager {
  constructor(database, eventPublisher) {
    this.logger = new Logger('bling-order-manager');
    this.db = database;
    this.eventPublisher = eventPublisher;
    this.tokenManager = new BlingTokenManager(database);
    this.blingAPI = new BlingAPI();

    // Configuration
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      batchSize: 50,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      statusMapping: {
        // Vitrine -> Bling status mapping
        'pending': 'Em aberto',
        'processing': 'Em produção',
        'shipped': 'Enviado',
        'delivered': 'Entregue',
        'cancelled': 'Cancelado',
        'refunded': 'Cancelado'
      },
      trackingStatuses: [
        'Em produção',
        'Enviado',
        'Entregue',
        'Cancelado'
      ]
    };

    this.logger.info('Bling order manager initialized', this.config);
  }

  /**
   * Create order in Bling ERP
   */
  async createOrder(tenantId, orderData) {
    try {
      this.logger.info('Creating order in Bling', {
        tenantId,
        orderId: orderData.id
      });

      // Get valid token
      const token = await this.tokenManager.getValidToken(tenantId);

      // Transform order data for Bling format
      const blingOrder = this.transformOrderForBling(orderData);

      // Create order in Bling
      const blingResponse = await this.blingAPI.createOrder(token, blingOrder);

      // Store order mapping
      await this.storeOrderMapping(tenantId, orderData.id, blingResponse.id);

      // Publish event
      await this.eventPublisher.publish('bling.order.created', {
        tenantId,
        vitrineOrderId: orderData.id,
        blingOrderId: blingResponse.id,
        status: blingResponse.status,
        timestamp: new Date()
      });

      this.logger.info('Order created successfully in Bling', {
        tenantId,
        vitrineOrderId: orderData.id,
        blingOrderId: blingResponse.id
      });

      return {
        blingOrderId: blingResponse.id,
        status: blingResponse.status,
        blingData: blingResponse
      };

    } catch (error) {
      this.logger.error('Failed to create order in Bling', {
        error: error.message,
        tenantId,
        orderId: orderData.id
      });

      throw new Error(`Bling order creation failed: ${error.message}`);
    }
  }

  /**
   * Update order status in Bling
   */
  async updateOrderStatus(tenantId, vitrineOrderId, newStatus, additionalData = {}) {
    try {
      this.logger.info('Updating order status in Bling', {
        tenantId,
        vitrineOrderId,
        newStatus
      });

      // Get Bling order ID
      const orderMapping = await this.getOrderMapping(tenantId, vitrineOrderId);
      if (!orderMapping) {
        throw new Error(`Order mapping not found for order ${vitrineOrderId}`);
      }

      // Get valid token
      const token = await this.tokenManager.getValidToken(tenantId);

      // Map status to Bling format
      const blingStatus = this.config.statusMapping[newStatus] || newStatus;

      // Update order in Bling
      const updateData = {
        status: blingStatus,
        observacoes: additionalData.notes || '',
        ...additionalData
      };

      const blingResponse = await this.blingAPI.updateOrder(
        token, 
        orderMapping.bling_order_id, 
        updateData
      );

      // Update local mapping
      await this.updateOrderMapping(tenantId, vitrineOrderId, {
        status: blingStatus,
        last_updated: new Date(),
        sync_data: blingResponse
      });

      // Publish event
      await this.eventPublisher.publish('bling.order.updated', {
        tenantId,
        vitrineOrderId,
        blingOrderId: orderMapping.bling_order_id,
        oldStatus: orderMapping.status,
        newStatus: blingStatus,
        additionalData,
        timestamp: new Date()
      });

      this.logger.info('Order status updated successfully in Bling', {
        tenantId,
        vitrineOrderId,
        blingOrderId: orderMapping.bling_order_id,
        newStatus: blingStatus
      });

      return {
        blingOrderId: orderMapping.bling_order_id,
        status: blingStatus,
        blingData: blingResponse
      };

    } catch (error) {
      this.logger.error('Failed to update order status in Bling', {
        error: error.message,
        tenantId,
        vitrineOrderId,
        newStatus
      });

      throw error;
    }
  }

  /**
   * Cancel order in Bling
   */
  async cancelOrder(tenantId, vitrineOrderId, reason = '') {
    try {
      this.logger.info('Cancelling order in Bling', {
        tenantId,
        vitrineOrderId,
        reason
      });

      // Get order mapping
      const orderMapping = await this.getOrderMapping(tenantId, vitrineOrderId);
      if (!orderMapping) {
        throw new Error(`Order mapping not found for order ${vitrineOrderId}`);
      }

      // Check if order can be cancelled
      const canCancel = await this.canCancelOrder(tenantId, orderMapping.bling_order_id);
      if (!canCancel.allowed) {
        throw new Error(`Order cannot be cancelled: ${canCancel.reason}`);
      }

      // Get valid token
      const token = await this.tokenManager.getValidToken(tenantId);

      // Cancel order in Bling
      const cancelData = {
        status: 'Cancelado',
        motivoCancelamento: reason,
        dataCancelamento: new Date().toISOString()
      };

      const blingResponse = await this.blingAPI.cancelOrder(
        token,
        orderMapping.bling_order_id,
        cancelData
      );

      // Update local mapping
      await this.updateOrderMapping(tenantId, vitrineOrderId, {
        status: 'Cancelado',
        cancelled_at: new Date(),
        cancel_reason: reason,
        last_updated: new Date(),
        sync_data: blingResponse
      });

      // Publish event
      await this.eventPublisher.publish('bling.order.cancelled', {
        tenantId,
        vitrineOrderId,
        blingOrderId: orderMapping.bling_order_id,
        reason,
        timestamp: new Date()
      });

      this.logger.info('Order cancelled successfully in Bling', {
        tenantId,
        vitrineOrderId,
        blingOrderId: orderMapping.bling_order_id
      });

      return {
        blingOrderId: orderMapping.bling_order_id,
        status: 'Cancelado',
        reason,
        blingData: blingResponse
      };

    } catch (error) {
      this.logger.error('Failed to cancel order in Bling', {
        error: error.message,
        tenantId,
        vitrineOrderId,
        reason
      });

      throw error;
    }
  }

  /**
   * Get order tracking information
   */
  async getOrderTracking(tenantId, vitrineOrderId) {
    try {
      // Get order mapping
      const orderMapping = await this.getOrderMapping(tenantId, vitrineOrderId);
      if (!orderMapping) {
        throw new Error(`Order mapping not found for order ${vitrineOrderId}`);
      }

      // Get valid token
      const token = await this.tokenManager.getValidToken(tenantId);

      // Get order details from Bling
      const blingOrder = await this.blingAPI.getOrder(token, orderMapping.bling_order_id);

      // Get tracking history
      const trackingHistory = await this.getTrackingHistory(tenantId, vitrineOrderId);

      // Parse tracking information
      const tracking = {
        vitrineOrderId,
        blingOrderId: orderMapping.bling_order_id,
        currentStatus: blingOrder.status,
        estimatedDelivery: blingOrder.previsaoEntrega,
        trackingCode: blingOrder.codigoRastreamento,
        carrier: blingOrder.transportadora,
        trackingUrl: blingOrder.urlRastreamento,
        history: trackingHistory,
        lastUpdated: orderMapping.last_updated,
        details: {
          orderDate: blingOrder.dataEmissao,
          shippingDate: blingOrder.dataEnvio,
          deliveryDate: blingOrder.dataEntrega,
          items: blingOrder.items?.map(item => ({
            sku: item.codigo,
            name: item.descricao,
            quantity: item.quantidade,
            price: item.valor
          })) || []
        }
      };

      this.logger.debug('Order tracking retrieved', {
        tenantId,
        vitrineOrderId,
        currentStatus: tracking.currentStatus
      });

      return tracking;

    } catch (error) {
      this.logger.error('Failed to get order tracking', {
        error: error.message,
        tenantId,
        vitrineOrderId
      });

      throw error;
    }
  }

  /**
   * Sync order status from Bling
   */
  async syncOrderStatus(tenantId, vitrineOrderId) {
    try {
      // Get order mapping
      const orderMapping = await this.getOrderMapping(tenantId, vitrineOrderId);
      if (!orderMapping) {
        throw new Error(`Order mapping not found for order ${vitrineOrderId}`);
      }

      // Get valid token
      const token = await this.tokenManager.getValidToken(tenantId);

      // Get current status from Bling
      const blingOrder = await this.blingAPI.getOrder(token, orderMapping.bling_order_id);

      const oldStatus = orderMapping.status;
      const newStatus = blingOrder.status;

      // Check if status changed
      if (oldStatus !== newStatus) {
        // Update local mapping
        await this.updateOrderMapping(tenantId, vitrineOrderId, {
          status: newStatus,
          last_updated: new Date(),
          sync_data: blingOrder
        });

        // Add to tracking history
        await this.addTrackingHistory(tenantId, vitrineOrderId, {
          status: newStatus,
          timestamp: new Date(),
          source: 'bling_sync',
          details: blingOrder
        });

        // Publish event
        await this.eventPublisher.publish('bling.order.status_synced', {
          tenantId,
          vitrineOrderId,
          blingOrderId: orderMapping.bling_order_id,
          oldStatus,
          newStatus,
          blingData: blingOrder,
          timestamp: new Date()
        });

        this.logger.info('Order status synced from Bling', {
          tenantId,
          vitrineOrderId,
          oldStatus,
          newStatus
        });

        return {
          changed: true,
          oldStatus,
          newStatus,
          blingData: blingOrder
        };
      }

      return {
        changed: false,
        status: newStatus,
        blingData: blingOrder
      };

    } catch (error) {
      this.logger.error('Failed to sync order status', {
        error: error.message,
        tenantId,
        vitrineOrderId
      });

      throw error;
    }
  }

  /**
   * Bulk sync orders for tenant
   */
  async bulkSyncOrders(tenantId, limit = null) {
    try {
      this.logger.info('Starting bulk order sync', { tenantId, limit });

      // Get orders to sync
      let query = this.db('bling_order_mappings')
        .where('tenant_id', tenantId)
        .where('status', 'not in', ['Entregue', 'Cancelado']);

      if (limit) {
        query = query.limit(limit);
      }

      const orders = await query.select('*');

      const results = {
        total: orders.length,
        updated: 0,
        errors: 0,
        details: []
      };

      for (const order of orders) {
        try {
          const syncResult = await this.syncOrderStatus(tenantId, order.vitrine_order_id);
          
          if (syncResult.changed) {
            results.updated++;
          }

          results.details.push({
            vitrineOrderId: order.vitrine_order_id,
            success: true,
            changed: syncResult.changed,
            status: syncResult.newStatus || syncResult.status
          });

        } catch (error) {
          results.errors++;
          results.details.push({
            vitrineOrderId: order.vitrine_order_id,
            success: false,
            error: error.message
          });

          this.logger.warn('Order sync failed', {
            vitrineOrderId: order.vitrine_order_id,
            error: error.message
          });
        }
      }

      this.logger.info('Bulk order sync completed', {
        tenantId,
        ...results
      });

      return results;

    } catch (error) {
      this.logger.error('Bulk order sync failed', {
        error: error.message,
        tenantId
      });

      throw error;
    }
  }

  /**
   * Transform order data for Bling format
   */
  transformOrderForBling(orderData) {
    return {
      cliente: {
        nome: orderData.customer.name,
        email: orderData.customer.email,
        cpfCnpj: orderData.customer.cpfCnpj,
        telefone: orderData.customer.phone,
        endereco: {
          logradouro: orderData.shipping.street,
          numero: orderData.shipping.number,
          complemento: orderData.shipping.complement,
          bairro: orderData.shipping.neighborhood,
          cidade: orderData.shipping.city,
          uf: orderData.shipping.state,
          cep: orderData.shipping.zipCode
        }
      },
      itens: orderData.items.map(item => ({
        codigo: item.sku,
        descricao: item.name,
        quantidade: item.quantity,
        valor: item.price,
        unidade: 'UN'
      })),
      observacoes: orderData.notes || '',
      dataEmissao: orderData.createdAt,
      valorTotal: orderData.total,
      valorFrete: orderData.shippingCost || 0,
      formaPagamento: orderData.paymentMethod
    };
  }

  /**
   * Store order mapping in database
   */
  async storeOrderMapping(tenantId, vitrineOrderId, blingOrderId) {
    await this.db('bling_order_mappings').insert({
      tenant_id: tenantId,
      vitrine_order_id: vitrineOrderId,
      bling_order_id: blingOrderId,
      status: 'Em aberto',
      created_at: new Date(),
      last_updated: new Date()
    });
  }

  /**
   * Get order mapping
   */
  async getOrderMapping(tenantId, vitrineOrderId) {
    return await this.db('bling_order_mappings')
      .where({
        tenant_id: tenantId,
        vitrine_order_id: vitrineOrderId
      })
      .first();
  }

  /**
   * Update order mapping
   */
  async updateOrderMapping(tenantId, vitrineOrderId, updateData) {
    await this.db('bling_order_mappings')
      .where({
        tenant_id: tenantId,
        vitrine_order_id: vitrineOrderId
      })
      .update(updateData);
  }

  /**
   * Check if order can be cancelled
   */
  async canCancelOrder(tenantId, blingOrderId) {
    try {
      const token = await this.tokenManager.getValidToken(tenantId);
      const blingOrder = await this.blingAPI.getOrder(token, blingOrderId);

      const nonCancellableStatuses = ['Entregue', 'Cancelado', 'Faturado'];
      
      if (nonCancellableStatuses.includes(blingOrder.status)) {
        return {
          allowed: false,
          reason: `Order is already ${blingOrder.status}`
        };
      }

      return { allowed: true };

    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot verify order status: ${error.message}`
      };
    }
  }

  /**
   * Add tracking history entry
   */
  async addTrackingHistory(tenantId, vitrineOrderId, trackingData) {
    await this.db('bling_order_tracking').insert({
      tenant_id: tenantId,
      vitrine_order_id: vitrineOrderId,
      status: trackingData.status,
      timestamp: trackingData.timestamp,
      source: trackingData.source,
      details: JSON.stringify(trackingData.details),
      created_at: new Date()
    });
  }

  /**
   * Get tracking history
   */
  async getTrackingHistory(tenantId, vitrineOrderId) {
    const history = await this.db('bling_order_tracking')
      .where({
        tenant_id: tenantId,
        vitrine_order_id: vitrineOrderId
      })
      .orderBy('timestamp', 'desc');

    return history.map(entry => ({
      status: entry.status,
      timestamp: entry.timestamp,
      source: entry.source,
      details: entry.details ? JSON.parse(entry.details) : null
    }));
  }

  /**
   * Get order statistics
   */
  async getOrderStats(tenantId) {
    try {
      const stats = await this.db('bling_order_mappings')
        .where('tenant_id', tenantId)
        .select('status')
        .count('* as count')
        .groupBy('status');

      const statusCounts = {};
      stats.forEach(stat => {
        statusCounts[stat.status] = parseInt(stat.count);
      });

      return {
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        byStatus: statusCounts,
        lastSync: await this.getLastSyncTime(tenantId)
      };

    } catch (error) {
      this.logger.error('Failed to get order stats', {
        error: error.message,
        tenantId
      });

      throw error;
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(tenantId) {
    const result = await this.db('bling_order_mappings')
      .where('tenant_id', tenantId)
      .max('last_updated as lastSync')
      .first();

    return result?.lastSync || null;
  }
}

module.exports = BlingOrderManager;