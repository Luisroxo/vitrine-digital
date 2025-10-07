const redis = require('redis');

/**
 * Event Publisher for Inter-Service Communication
 * Handles publishing events to Redis pub/sub system
 */
class EventPublisher {
  constructor(redisUrl = 'redis://localhost:6379') {
    this.client = redis.createClient({ url: redisUrl });
    this.isConnected = false;
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Event Publisher connected to Redis');
    } catch (error) {
      console.error('❌ Event Publisher connection failed:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Publish an event to the message queue
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event payload
   * @param {Object} metadata - Event metadata (timestamp, source, etc.)
   */
  async publish(eventName, data, metadata = {}) {
    if (!this.isConnected) {
      console.warn('⚠️ Event Publisher not connected, attempting reconnection...');
      await this.connect();
    }

    const event = {
      eventName,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        source: metadata.source || 'unknown-service',
        correlationId: metadata.correlationId || this.generateCorrelationId(),
        version: metadata.version || '1.0',
        ...metadata
      }
    };

    try {
      await this.client.publish(eventName, JSON.stringify(event));
      console.log(`📢 Event published: ${eventName}`, { 
        correlationId: event.metadata.correlationId,
        source: event.metadata.source
      });
    } catch (error) {
      console.error(`❌ Failed to publish event ${eventName}:`, error.message);
      throw error;
    }
  }

  /**
   * Publish user-related events
   */
  async publishUserEvent(eventType, userId, data, metadata = {}) {
    const eventName = `user.${eventType}`;
    const payload = { userId, ...data };
    await this.publish(eventName, payload, { ...metadata, source: 'auth-service' });
  }

  /**
   * Publish product-related events
   */
  async publishProductEvent(eventType, productId, data, metadata = {}) {
    const eventName = `product.${eventType}`;
    const payload = { productId, ...data };
    await this.publish(eventName, payload, { ...metadata, source: 'product-service' });
  }

  /**
   * Publish order-related events
   */
  async publishOrderEvent(eventType, orderId, data, metadata = {}) {
    const eventName = `order.${eventType}`;
    const payload = { orderId, ...data };
    await this.publish(eventName, payload, { ...metadata, source: 'order-service' });
  }

  /**
   * Publish billing-related events
   */
  async publishBillingEvent(eventType, tenantId, data, metadata = {}) {
    const eventName = `billing.${eventType}`;
    const payload = { tenantId, ...data };
    await this.publish(eventName, payload, { ...metadata, source: 'billing-service' });
  }

  /**
   * Publish Bling integration events
   */
  async publishBlingEvent(eventType, tenantId, data, metadata = {}) {
    const eventName = `bling.${eventType}`;
    const payload = { tenantId, ...data };
    await this.publish(eventName, payload, { ...metadata, source: 'bling-service' });
  }

  /**
   * Generate unique correlation ID for event tracing
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close the publisher connection
   */
  async close() {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('🔒 Event Publisher disconnected');
    }
  }
}

module.exports = EventPublisher;