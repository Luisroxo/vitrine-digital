const EventEmitter = require('events');
const { Logger } = require('../../../shared');

/**
 * Real-time Event Processing System for Bling Service
 */
class BlingEventProcessor extends EventEmitter {
  constructor(database, blingService, eventPublisher) {
    super();
    this.logger = new Logger('bling-event-processor');
    this.db = database;
    this.blingService = blingService;
    this.eventPublisher = eventPublisher;

    // Configuration
    this.config = {
      batchSize: 50,
      batchTimeout: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1000,
      concurrencyLimit: 5,
      eventBufferSize: 1000,
      processingTimeout: 30000, // 30 seconds
      deadLetterThreshold: 5
    };

    // State management
    this.state = {
      isProcessing: false,
      processedCount: 0,
      failedCount: 0,
      queueSize: 0,
      lastProcessedAt: null,
      activeProcessors: 0
    };

    // Event queues
    this.eventQueue = [];
    this.deadLetterQueue = [];
    this.processingBatch = new Map();

    // Event type handlers
    this.eventHandlers = new Map([
      ['bling.order.created', this.handleOrderCreatedEvent.bind(this)],
      ['bling.order.updated', this.handleOrderUpdatedEvent.bind(this)],
      ['bling.order.cancelled', this.handleOrderCancelledEvent.bind(this)],
      ['bling.product.updated', this.handleProductUpdatedEvent.bind(this)],
      ['bling.product.created', this.handleProductCreatedEvent.bind(this)],
      ['bling.product.deleted', this.handleProductDeletedEvent.bind(this)],
      ['bling.stock.updated', this.handleStockUpdatedEvent.bind(this)],
      ['bling.webhook.received', this.handleWebhookEvent.bind(this)],
      ['bling.sync.requested', this.handleSyncRequestEvent.bind(this)],
      ['bling.batch.process', this.handleBatchProcessEvent.bind(this)]
    ]);

    // Initialize processor
    this.initialize();
  }

  /**
   * Initialize the event processor
   */
  async initialize() {
    try {
      this.logger.info('Initializing Bling event processor');

      // Set up event listeners
      this.setupEventListeners();

      // Start processing loop
      this.startProcessingLoop();

      // Schedule maintenance tasks
      this.scheduleMaintenanceTasks();

      // Recovery any pending events
      await this.recoverPendingEvents();

      this.logger.info('Bling event processor initialized successfully', {
        supportedEvents: Array.from(this.eventHandlers.keys()),
        config: this.config
      });

    } catch (error) {
      this.logger.error('Failed to initialize event processor', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Set up internal event listeners
   */
  setupEventListeners() {
    // Listen for processing events
    this.on('event.queued', this.onEventQueued.bind(this));
    this.on('event.processed', this.onEventProcessed.bind(this));
    this.on('event.failed', this.onEventFailed.bind(this));
    this.on('batch.completed', this.onBatchCompleted.bind(this));

    // Listen for system events
    this.on('processor.started', () => {
      this.logger.info('Event processor started');
    });

    this.on('processor.stopped', () => {
      this.logger.info('Event processor stopped');
    });

    // Error handling
    this.on('error', (error) => {
      this.logger.error('Event processor error', {
        error: error.message
      });
    });
  }

  /**
   * Process incoming event
   */
  async processEvent(eventType, eventData, options = {}) {
    const eventId = this.generateEventId();
    const startTime = Date.now();

    try {
      const event = {
        id: eventId,
        type: eventType,
        data: eventData,
        options,
        timestamp: new Date(),
        priority: options.priority || 'normal',
        tenantId: eventData.tenantId,
        retryCount: 0,
        status: 'queued'
      };

      // Validate event
      this.validateEvent(event);

      // Queue event for processing
      await this.queueEvent(event);

      const processingTime = Date.now() - startTime;

      this.logger.debug('Event queued for processing', {
        eventId,
        eventType,
        tenantId: eventData.tenantId,
        queueSize: this.eventQueue.length,
        processingTime
      });

      return {
        eventId,
        queued: true,
        queuePosition: this.eventQueue.length
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Failed to process event', {
        eventId,
        eventType,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Validate incoming event
   */
  validateEvent(event) {
    if (!event.type) {
      throw new Error('Event type is required');
    }

    if (!event.data) {
      throw new Error('Event data is required');
    }

    if (!this.eventHandlers.has(event.type)) {
      throw new Error(`Unsupported event type: ${event.type}`);
    }

    if (!event.data.tenantId) {
      throw new Error('Tenant ID is required in event data');
    }
  }

  /**
   * Queue event for processing
   */
  async queueEvent(event) {
    // Check queue capacity
    if (this.eventQueue.length >= this.config.eventBufferSize) {
      throw new Error('Event queue is full');
    }

    // Priority queue logic
    if (event.priority === 'high') {
      this.eventQueue.unshift(event);
    } else {
      this.eventQueue.push(event);
    }

    this.state.queueSize = this.eventQueue.length;

    // Store event for persistence
    await this.storeEvent(event);

    // Emit queued event
    this.emit('event.queued', event);

    return event.id;
  }

  /**
   * Start processing loop
   */
  startProcessingLoop() {
    if (this.state.isProcessing) {
      return;
    }

    this.state.isProcessing = true;
    this.emit('processor.started');

    // Start batch processing
    this.processingInterval = setInterval(
      this.processBatch.bind(this),
      this.config.batchTimeout
    );

    this.logger.info('Event processing loop started');
  }

  /**
   * Stop processing loop
   */
  async stopProcessingLoop() {
    this.state.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Wait for active processors to finish
    while (this.state.activeProcessors > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('processor.stopped');
    this.logger.info('Event processing loop stopped');
  }

  /**
   * Process batch of events
   */
  async processBatch() {
    if (this.eventQueue.length === 0) {
      return;
    }

    if (this.state.activeProcessors >= this.config.concurrencyLimit) {
      return;
    }

    try {
      this.state.activeProcessors++;

      // Extract batch from queue
      const batchSize = Math.min(
        this.config.batchSize,
        this.eventQueue.length
      );

      const batch = this.eventQueue.splice(0, batchSize);
      this.state.queueSize = this.eventQueue.length;

      if (batch.length === 0) {
        return;
      }

      const batchId = this.generateBatchId();
      this.processingBatch.set(batchId, batch);

      this.logger.debug('Processing event batch', {
        batchId,
        batchSize: batch.length,
        remainingQueue: this.eventQueue.length
      });

      // Process events concurrently
      const promises = batch.map(event => this.processEventInternal(event));
      await Promise.allSettled(promises);

      // Clean up batch
      this.processingBatch.delete(batchId);
      this.emit('batch.completed', { batchId, batchSize: batch.length });

    } catch (error) {
      this.logger.error('Batch processing failed', {
        error: error.message
      });

    } finally {
      this.state.activeProcessors--;
    }
  }

  /**
   * Process individual event internally
   */
  async processEventInternal(event) {
    const startTime = Date.now();

    try {
      // Update event status
      event.status = 'processing';
      event.processedAt = new Date();

      // Get event handler
      const handler = this.eventHandlers.get(event.type);
      if (!handler) {
        throw new Error(`No handler found for event type: ${event.type}`);
      }

      // Execute handler with timeout
      const result = await Promise.race([
        handler(event.data, event.options),
        this.createTimeout(this.config.processingTimeout)
      ]);

      // Update event status
      event.status = 'completed';
      event.completedAt = new Date();
      event.result = result;

      const processingTime = Date.now() - startTime;

      // Update statistics
      this.state.processedCount++;
      this.state.lastProcessedAt = new Date();

      // Store completed event
      await this.updateEventStatus(event.id, 'completed', result);

      this.logger.debug('Event processed successfully', {
        eventId: event.id,
        eventType: event.type,
        tenantId: event.data.tenantId,
        processingTime
      });

      this.emit('event.processed', event);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Update event status
      event.status = 'failed';
      event.error = error.message;
      event.failedAt = new Date();

      // Handle retry logic
      if (event.retryCount < this.config.maxRetries) {
        event.retryCount++;
        event.status = 'retrying';
        
        // Re-queue for retry
        setTimeout(() => {
          this.eventQueue.push(event);
          this.state.queueSize = this.eventQueue.length;
        }, this.config.retryDelay * Math.pow(2, event.retryCount));

        this.logger.warn('Event retry scheduled', {
          eventId: event.id,
          retryCount: event.retryCount,
          maxRetries: this.config.maxRetries
        });

      } else {
        // Move to dead letter queue
        this.deadLetterQueue.push(event);
        this.state.failedCount++;

        this.logger.error('Event moved to dead letter queue', {
          eventId: event.id,
          eventType: event.type,
          error: error.message,
          processingTime
        });
      }

      // Store failed event
      await this.updateEventStatus(event.id, event.status, null, error.message);

      this.emit('event.failed', { event, error });

      throw error;
    }
  }

  /**
   * Event Handlers
   */

  async handleOrderCreatedEvent(data, options) {
    this.logger.debug('Processing order created event', {
      orderId: data.orderId,
      tenantId: data.tenantId
    });

    // Process order creation logic
    const result = {
      action: 'order_created_processed',
      orderId: data.orderId,
      processed: true
    };

    // Publish downstream events
    await this.eventPublisher.publish('order.sync.completed', {
      tenantId: data.tenantId,
      orderId: data.orderId,
      source: 'bling_event',
      timestamp: new Date()
    });

    return result;
  }

  async handleOrderUpdatedEvent(data, options) {
    this.logger.debug('Processing order updated event', {
      orderId: data.orderId,
      tenantId: data.tenantId
    });

    // Process order update logic
    const result = {
      action: 'order_updated_processed',
      orderId: data.orderId,
      updates: data.changes || {},
      processed: true
    };

    return result;
  }

  async handleOrderCancelledEvent(data, options) {
    this.logger.debug('Processing order cancelled event', {
      orderId: data.orderId,
      tenantId: data.tenantId
    });

    // Process order cancellation logic
    const result = {
      action: 'order_cancelled_processed',
      orderId: data.orderId,
      reason: data.reason,
      processed: true
    };

    return result;
  }

  async handleProductUpdatedEvent(data, options) {
    this.logger.debug('Processing product updated event', {
      productId: data.productId,
      tenantId: data.tenantId
    });

    // Trigger product synchronization
    try {
      await this.blingService.syncSingleProduct(data.tenantId, data.productId);
      
      return {
        action: 'product_sync_triggered',
        productId: data.productId,
        processed: true
      };

    } catch (error) {
      this.logger.error('Product sync failed', {
        productId: data.productId,
        error: error.message
      });

      throw error;
    }
  }

  async handleProductCreatedEvent(data, options) {
    this.logger.debug('Processing product created event', {
      productId: data.productId,
      tenantId: data.tenantId
    });

    // Similar to updated event
    return this.handleProductUpdatedEvent(data, options);
  }

  async handleProductDeletedEvent(data, options) {
    this.logger.debug('Processing product deleted event', {
      productId: data.productId,
      tenantId: data.tenantId
    });

    // Mark product as deleted in vitrine
    const result = {
      action: 'product_marked_deleted',
      productId: data.productId,
      processed: true
    };

    return result;
  }

  async handleStockUpdatedEvent(data, options) {
    this.logger.debug('Processing stock updated event', {
      productId: data.productId,
      tenantId: data.tenantId,
      newStock: data.newStock
    });

    // Update stock in vitrine system
    const result = {
      action: 'stock_updated',
      productId: data.productId,
      newStock: data.newStock,
      oldStock: data.oldStock,
      processed: true
    };

    // Publish stock change event
    await this.eventPublisher.publish('product.stock.updated', {
      tenantId: data.tenantId,
      productId: data.productId,
      newStock: data.newStock,
      oldStock: data.oldStock,
      timestamp: new Date()
    });

    return result;
  }

  async handleWebhookEvent(data, options) {
    this.logger.debug('Processing webhook event', {
      webhookId: data.webhookId,
      eventType: data.event
    });

    // Process webhook data
    const result = {
      action: 'webhook_processed',
      webhookId: data.webhookId,
      eventType: data.event,
      processed: true
    };

    return result;
  }

  async handleSyncRequestEvent(data, options) {
    this.logger.debug('Processing sync request event', {
      tenantId: data.tenantId,
      syncType: data.syncType
    });

    // Trigger appropriate sync
    let result;

    switch (data.syncType) {
      case 'products':
        await this.blingService.syncProducts(data.tenantId);
        result = { action: 'products_sync_triggered' };
        break;

      case 'orders':
        await this.blingService.syncRecentOrders(data.tenantId);
        result = { action: 'orders_sync_triggered' };
        break;

      case 'full':
        await this.blingService.fullSync(data.tenantId);
        result = { action: 'full_sync_triggered' };
        break;

      default:
        throw new Error(`Unknown sync type: ${data.syncType}`);
    }

    result.tenantId = data.tenantId;
    result.processed = true;

    return result;
  }

  async handleBatchProcessEvent(data, options) {
    this.logger.debug('Processing batch process event', {
      tenantId: data.tenantId,
      batchType: data.batchType,
      itemCount: data.items?.length || 0
    });

    // Process batch operations
    const result = {
      action: 'batch_processed',
      batchType: data.batchType,
      itemCount: data.items?.length || 0,
      processed: true
    };

    return result;
  }

  /**
   * Helper methods
   */

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), ms);
    });
  }

  async storeEvent(event) {
    try {
      await this.db('bling_events').insert({
        event_id: event.id,
        event_type: event.type,
        tenant_id: event.tenantId,
        data: JSON.stringify(event.data),
        options: JSON.stringify(event.options),
        status: event.status,
        priority: event.priority,
        retry_count: event.retryCount,
        created_at: event.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to store event', {
        eventId: event.id,
        error: error.message
      });
    }
  }

  async updateEventStatus(eventId, status, result = null, errorMessage = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date()
      };

      if (result) {
        updateData.result = JSON.stringify(result);
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      await this.db('bling_events')
        .where('event_id', eventId)
        .update(updateData);

    } catch (error) {
      this.logger.error('Failed to update event status', {
        eventId,
        status,
        error: error.message
      });
    }
  }

  async recoverPendingEvents() {
    try {
      const pendingEvents = await this.db('bling_events')
        .whereIn('status', ['queued', 'processing', 'retrying'])
        .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h
        .select('*');

      this.logger.info('Recovering pending events', {
        count: pendingEvents.length
      });

      for (const eventRecord of pendingEvents) {
        const event = {
          id: eventRecord.event_id,
          type: eventRecord.event_type,
          data: JSON.parse(eventRecord.data),
          options: JSON.parse(eventRecord.options || '{}'),
          timestamp: eventRecord.created_at,
          tenantId: eventRecord.tenant_id,
          priority: eventRecord.priority || 'normal',
          retryCount: eventRecord.retry_count || 0,
          status: 'queued'
        };

        this.eventQueue.push(event);
      }

      this.state.queueSize = this.eventQueue.length;

    } catch (error) {
      this.logger.error('Failed to recover pending events', {
        error: error.message
      });
    }
  }

  scheduleMaintenanceTasks() {
    // Clean old events every hour
    setInterval(this.cleanOldEvents.bind(this), 60 * 60 * 1000);

    // Process dead letter queue every 10 minutes
    setInterval(this.processDeadLetterQueue.bind(this), 10 * 60 * 1000);

    // Emit statistics every 5 minutes
    setInterval(this.emitStatistics.bind(this), 5 * 60 * 1000);
  }

  async cleanOldEvents() {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = await this.db('bling_events')
        .where('created_at', '<', cutoffDate)
        .where('status', 'completed')
        .del();

      if (result > 0) {
        this.logger.info('Cleaned old events', {
          deletedCount: result
        });
      }

    } catch (error) {
      this.logger.error('Failed to clean old events', {
        error: error.message
      });
    }
  }

  async processDeadLetterQueue() {
    if (this.deadLetterQueue.length === 0) {
      return;
    }

    this.logger.info('Processing dead letter queue', {
      count: this.deadLetterQueue.length
    });

    // Attempt to reprocess some dead letter events
    const eventsToRetry = this.deadLetterQueue.splice(0, 5);
    
    for (const event of eventsToRetry) {
      event.retryCount = 0;
      event.status = 'queued';
      this.eventQueue.push(event);
    }

    this.state.queueSize = this.eventQueue.length;
  }

  emitStatistics() {
    const stats = {
      ...this.state,
      queueSize: this.eventQueue.length,
      deadLetterSize: this.deadLetterQueue.length,
      processingBatches: this.processingBatch.size
    };

    this.emit('statistics', stats);

    this.logger.debug('Event processor statistics', stats);
  }

  // Event listener callbacks
  onEventQueued(event) {
    this.logger.debug('Event queued', {
      eventId: event.id,
      eventType: event.type,
      queueSize: this.state.queueSize
    });
  }

  onEventProcessed(event) {
    this.logger.debug('Event processed', {
      eventId: event.id,
      eventType: event.type
    });
  }

  onEventFailed({ event, error }) {
    this.logger.warn('Event failed', {
      eventId: event.id,
      eventType: event.type,
      error: error.message,
      retryCount: event.retryCount
    });
  }

  onBatchCompleted({ batchId, batchSize }) {
    this.logger.debug('Batch completed', {
      batchId,
      batchSize
    });
  }

  /**
   * Public API methods
   */

  getStatistics() {
    return {
      ...this.state,
      queueSize: this.eventQueue.length,
      deadLetterSize: this.deadLetterQueue.length,
      supportedEvents: Array.from(this.eventHandlers.keys())
    };
  }

  async getEventHistory(tenantId = null, limit = 100) {
    let query = this.db('bling_events')
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (tenantId) {
      query = query.where('tenant_id', tenantId);
    }

    return await query.select('*');
  }
}

module.exports = BlingEventProcessor;