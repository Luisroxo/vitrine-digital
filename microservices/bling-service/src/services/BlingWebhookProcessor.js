const crypto = require('crypto');
const { Logger } = require('../../../shared');

/**
 * Enhanced Webhook Processing Service for Bling ERP integration
 */
class BlingWebhookProcessor {
  constructor(database, eventPublisher) {
    this.logger = new Logger('bling-webhook-processor');
    this.db = database;
    this.eventPublisher = eventPublisher;

    // Configuration
    this.config = {
      webhookSecret: process.env.BLING_WEBHOOK_SECRET || 'default-secret',
      maxRetries: 3,
      retryDelay: 1000,
      signatureHeader: 'x-bling-signature',
      timestampHeader: 'x-bling-timestamp',
      maxTimestampAge: 5 * 60 * 1000, // 5 minutes
      supportedEvents: [
        'product.updated',
        'product.created',
        'product.deleted',
        'stock.updated',
        'order.created',
        'order.updated',
        'order.status_changed',
        'order.cancelled',
        'invoice.created',
        'customer.updated'
      ],
      eventMapping: {
        'product.updated': 'bling.product.updated',
        'product.created': 'bling.product.created',
        'product.deleted': 'bling.product.deleted',
        'stock.updated': 'bling.stock.updated',
        'order.created': 'bling.order.webhook_received',
        'order.updated': 'bling.order.webhook_received',
        'order.status_changed': 'bling.order.status_changed',
        'order.cancelled': 'bling.order.webhook_cancelled'
      }
    };

    this.logger.info('Bling webhook processor initialized', {
      supportedEvents: this.config.supportedEvents.length,
      maxRetries: this.config.maxRetries
    });
  }

  /**
   * Process incoming webhook request
   */
  async processWebhook(req) {
    const webhookId = this.generateWebhookId();
    const startTime = Date.now();

    try {
      this.logger.info('Processing webhook', {
        webhookId,
        event: req.body?.event,
        timestamp: req.headers[this.config.timestampHeader]
      });

      // Validate webhook signature
      await this.validateWebhookSignature(req);

      // Validate timestamp
      await this.validateTimestamp(req);

      // Parse and validate payload
      const payload = await this.parseWebhookPayload(req);

      // Store webhook for audit
      await this.storeWebhookEvent(webhookId, payload, req);

      // Process the webhook event
      const result = await this.processWebhookEvent(webhookId, payload);

      const processingTime = Date.now() - startTime;

      this.logger.info('Webhook processed successfully', {
        webhookId,
        event: payload.event,
        processingTime,
        eventsPublished: result.eventsPublished
      });

      return {
        success: true,
        webhookId,
        processingTime,
        result
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Webhook processing failed', {
        webhookId,
        error: error.message,
        processingTime
      });

      // Store failed webhook for retry
      await this.storeFailedWebhook(webhookId, req, error);

      throw error;
    }
  }

  /**
   * Validate webhook signature using HMAC
   */
  async validateWebhookSignature(req) {
    const signature = req.headers[this.config.signatureHeader];
    
    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    // Remove 'sha256=' prefix if present
    const receivedSignature = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )) {
      throw new Error('Invalid webhook signature');
    }

    this.logger.debug('Webhook signature validated successfully');
  }

  /**
   * Validate webhook timestamp
   */
  async validateTimestamp(req) {
    const timestamp = req.headers[this.config.timestampHeader];
    
    if (!timestamp) {
      throw new Error('Missing webhook timestamp');
    }

    const webhookTime = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const age = now.getTime() - webhookTime.getTime();

    if (age > this.config.maxTimestampAge) {
      throw new Error(`Webhook too old: ${age}ms > ${this.config.maxTimestampAge}ms`);
    }

    this.logger.debug('Webhook timestamp validated', {
      webhookTime: webhookTime.toISOString(),
      age
    });
  }

  /**
   * Parse and validate webhook payload
   */
  async parseWebhookPayload(req) {
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid webhook payload');
    }

    // Validate required fields
    if (!payload.event) {
      throw new Error('Missing event type in payload');
    }

    if (!payload.data) {
      throw new Error('Missing data in payload');
    }

    // Check if event type is supported
    if (!this.config.supportedEvents.includes(payload.event)) {
      throw new Error(`Unsupported event type: ${payload.event}`);
    }

    // Add metadata
    payload.metadata = {
      receivedAt: new Date(),
      source: 'bling_webhook',
      version: payload.version || '1.0'
    };

    return payload;
  }

  /**
   * Process specific webhook event
   */
  async processWebhookEvent(webhookId, payload) {
    const { event, data, metadata } = payload;
    const result = { eventsPublished: 0, actions: [] };

    try {
      switch (event) {
        case 'product.updated':
        case 'product.created':
          await this.processProductEvent(webhookId, event, data, result);
          break;

        case 'product.deleted':
          await this.processProductDeletedEvent(webhookId, data, result);
          break;

        case 'stock.updated':
          await this.processStockEvent(webhookId, data, result);
          break;

        case 'order.created':
        case 'order.updated':
        case 'order.status_changed':
          await this.processOrderEvent(webhookId, event, data, result);
          break;

        case 'order.cancelled':
          await this.processOrderCancelledEvent(webhookId, data, result);
          break;

        default:
          this.logger.warn('Unhandled webhook event', { event, webhookId });
      }

      // Publish generic webhook event
      await this.publishWebhookEvent(webhookId, payload, result);

      return result;

    } catch (error) {
      this.logger.error('Webhook event processing failed', {
        webhookId,
        event,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process product-related webhook events
   */
  async processProductEvent(webhookId, event, data, result) {
    try {
      const tenantId = data.tenantId || await this.resolveTenantFromBlingData(data);
      
      // Update product sync status
      await this.updateProductSyncStatus(tenantId, data.id, {
        lastSyncAt: new Date(),
        syncSource: 'webhook',
        webhookId
      });

      // Publish event for product service
      const eventName = this.config.eventMapping[event];
      await this.eventPublisher.publish(eventName, {
        tenantId,
        productId: data.id,
        blingData: data,
        webhookId,
        timestamp: new Date()
      });

      result.eventsPublished++;
      result.actions.push(`Product ${data.id} sync triggered`);

      this.logger.debug('Product event processed', {
        webhookId,
        event,
        productId: data.id,
        tenantId
      });

    } catch (error) {
      this.logger.error('Product event processing failed', {
        webhookId,
        event,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process product deletion event
   */
  async processProductDeletedEvent(webhookId, data, result) {
    try {
      const tenantId = data.tenantId || await this.resolveTenantFromBlingData(data);

      // Mark product as deleted
      await this.markProductAsDeleted(tenantId, data.id);

      // Publish deletion event
      await this.eventPublisher.publish('bling.product.deleted', {
        tenantId,
        productId: data.id,
        blingData: data,
        webhookId,
        timestamp: new Date()
      });

      result.eventsPublished++;
      result.actions.push(`Product ${data.id} marked as deleted`);

    } catch (error) {
      this.logger.error('Product deletion event processing failed', {
        webhookId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process stock update event
   */
  async processStockEvent(webhookId, data, result) {
    try {
      const tenantId = data.tenantId || await this.resolveTenantFromBlingData(data);

      // Update stock information
      await this.updateStockInfo(tenantId, data.productId, {
        currentStock: data.quantidade,
        lastStockUpdate: new Date(),
        stockSource: 'bling_webhook',
        webhookId
      });

      // Publish stock event
      await this.eventPublisher.publish('bling.stock.updated', {
        tenantId,
        productId: data.productId,
        newStock: data.quantidade,
        oldStock: data.quantidadeAnterior,
        blingData: data,
        webhookId,
        timestamp: new Date()
      });

      result.eventsPublished++;
      result.actions.push(`Stock updated for product ${data.productId}`);

    } catch (error) {
      this.logger.error('Stock event processing failed', {
        webhookId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process order-related webhook events
   */
  async processOrderEvent(webhookId, event, data, result) {
    try {
      const tenantId = data.tenantId || await this.resolveTenantFromBlingData(data);

      // Find order mapping
      const orderMapping = await this.findOrderMapping(tenantId, data.id);

      if (orderMapping) {
        // Update order status
        await this.updateOrderFromWebhook(tenantId, orderMapping.vitrine_order_id, {
          blingStatus: data.status,
          lastWebhookAt: new Date(),
          webhookId
        });

        result.actions.push(`Order ${orderMapping.vitrine_order_id} status updated`);
      } else {
        // Log unmapped order
        this.logger.warn('Webhook for unmapped order', {
          webhookId,
          blingOrderId: data.id,
          tenantId
        });

        result.actions.push(`Unmapped order webhook: ${data.id}`);
      }

      // Publish order event
      const eventName = this.config.eventMapping[event];
      await this.eventPublisher.publish(eventName, {
        tenantId,
        blingOrderId: data.id,
        vitrineOrderId: orderMapping?.vitrine_order_id,
        orderData: data,
        webhookId,
        timestamp: new Date()
      });

      result.eventsPublished++;

    } catch (error) {
      this.logger.error('Order event processing failed', {
        webhookId,
        event,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process order cancellation event
   */
  async processOrderCancelledEvent(webhookId, data, result) {
    try {
      const tenantId = data.tenantId || await this.resolveTenantFromBlingData(data);

      // Find and update order
      const orderMapping = await this.findOrderMapping(tenantId, data.id);
      
      if (orderMapping) {
        await this.updateOrderFromWebhook(tenantId, orderMapping.vitrine_order_id, {
          blingStatus: 'Cancelado',
          cancelledAt: new Date(),
          cancelReason: data.motivoCancelamento,
          webhookId
        });

        result.actions.push(`Order ${orderMapping.vitrine_order_id} cancelled`);
      }

      // Publish cancellation event
      await this.eventPublisher.publish('bling.order.webhook_cancelled', {
        tenantId,
        blingOrderId: data.id,
        vitrineOrderId: orderMapping?.vitrine_order_id,
        reason: data.motivoCancelamento,
        webhookId,
        timestamp: new Date()
      });

      result.eventsPublished++;

    } catch (error) {
      this.logger.error('Order cancellation event processing failed', {
        webhookId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Publish generic webhook event
   */
  async publishWebhookEvent(webhookId, payload, result) {
    await this.eventPublisher.publish('bling.webhook.processed', {
      webhookId,
      event: payload.event,
      result,
      timestamp: new Date()
    });

    result.eventsPublished++;
  }

  /**
   * Store webhook event for audit
   */
  async storeWebhookEvent(webhookId, payload, req) {
    await this.db('bling_webhooks').insert({
      webhook_id: webhookId,
      event_type: payload.event,
      payload: JSON.stringify(payload),
      headers: JSON.stringify(req.headers),
      processed_at: new Date(),
      status: 'processed',
      created_at: new Date()
    });
  }

  /**
   * Store failed webhook for retry
   */
  async storeFailedWebhook(webhookId, req, error) {
    try {
      await this.db('bling_webhooks').insert({
        webhook_id: webhookId,
        event_type: req.body?.event || 'unknown',
        payload: JSON.stringify(req.body),
        headers: JSON.stringify(req.headers),
        error_message: error.message,
        status: 'failed',
        retry_count: 0,
        created_at: new Date()
      });
    } catch (storeError) {
      this.logger.error('Failed to store failed webhook', {
        webhookId,
        storeError: storeError.message
      });
    }
  }

  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks(limit = 10) {
    try {
      const failedWebhooks = await this.db('bling_webhooks')
        .where('status', 'failed')
        .where('retry_count', '<', this.config.maxRetries)
        .limit(limit)
        .select('*');

      const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        details: []
      };

      for (const webhook of failedWebhooks) {
        try {
          // Reconstruct request object
          const mockReq = {
            body: JSON.parse(webhook.payload),
            headers: JSON.parse(webhook.headers)
          };

          // Retry processing
          await this.processWebhook(mockReq);

          // Update status
          await this.db('bling_webhooks')
            .where('webhook_id', webhook.webhook_id)
            .update({
              status: 'processed',
              processed_at: new Date(),
              retry_count: webhook.retry_count + 1
            });

          results.succeeded++;
          results.details.push({
            webhookId: webhook.webhook_id,
            success: true
          });

        } catch (error) {
          // Update retry count
          await this.db('bling_webhooks')
            .where('webhook_id', webhook.webhook_id)
            .update({
              retry_count: webhook.retry_count + 1,
              error_message: error.message
            });

          results.failed++;
          results.details.push({
            webhookId: webhook.webhook_id,
            success: false,
            error: error.message
          });
        }

        results.processed++;
      }

      this.logger.info('Webhook retry completed', results);
      return results;

    } catch (error) {
      this.logger.error('Webhook retry process failed', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateWebhookId() {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async resolveTenantFromBlingData(data) {
    // Implementation depends on how tenant info is included in webhook data
    // This might involve looking up by Bling account ID or other identifiers
    return data.tenantId || 1; // Default tenant for now
  }

  async updateProductSyncStatus(tenantId, productId, syncData) {
    // Update product sync status in database
    return await this.db('bling_product_sync')
      .where({ tenant_id: tenantId, bling_product_id: productId })
      .update(syncData);
  }

  async markProductAsDeleted(tenantId, productId) {
    return await this.db('bling_product_sync')
      .where({ tenant_id: tenantId, bling_product_id: productId })
      .update({
        status: 'deleted',
        deleted_at: new Date(),
        last_sync_at: new Date()
      });
  }

  async updateStockInfo(tenantId, productId, stockData) {
    return await this.db('bling_product_sync')
      .where({ tenant_id: tenantId, bling_product_id: productId })
      .update(stockData);
  }

  async findOrderMapping(tenantId, blingOrderId) {
    return await this.db('bling_order_mappings')
      .where({
        tenant_id: tenantId,
        bling_order_id: blingOrderId
      })
      .first();
  }

  async updateOrderFromWebhook(tenantId, vitrineOrderId, updateData) {
    return await this.db('bling_order_mappings')
      .where({
        tenant_id: tenantId,
        vitrine_order_id: vitrineOrderId
      })
      .update(updateData);
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(tenantId = null, days = 7) {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      let query = this.db('bling_webhooks')
        .where('created_at', '>=', startDate);

      if (tenantId) {
        // This would require storing tenant_id in webhook records
        // query = query.where('tenant_id', tenantId);
      }

      const stats = await query
        .select('event_type', 'status')
        .count('* as count')
        .groupBy('event_type', 'status');

      const summary = {
        total: 0,
        byEventType: {},
        byStatus: {
          processed: 0,
          failed: 0,
          retrying: 0
        }
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count);
        summary.total += count;

        if (!summary.byEventType[stat.event_type]) {
          summary.byEventType[stat.event_type] = 0;
        }
        summary.byEventType[stat.event_type] += count;

        if (summary.byStatus.hasOwnProperty(stat.status)) {
          summary.byStatus[stat.status] += count;
        }
      });

      return summary;

    } catch (error) {
      this.logger.error('Failed to get webhook stats', {
        error: error.message
      });

      throw error;
    }
  }
}

module.exports = BlingWebhookProcessor;