const redis = require('redis');

/**
 * Event Subscriber for Inter-Service Communication
 * Handles subscribing to events from Redis pub/sub system
 */
class EventSubscriber {
  constructor(redisUrl = 'redis://localhost:6379') {
    this.subscriber = redis.createClient({ url: redisUrl });
    this.handlers = new Map();
    this.isConnected = false;
    this.connect();
  }

  async connect() {
    try {
      await this.subscriber.connect();
      this.isConnected = true;
      console.log('✅ Event Subscriber connected to Redis');
    } catch (error) {
      console.error('❌ Event Subscriber connection failed:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} handler - Handler function for the event
   */
  async subscribe(eventName, handler) {
    if (!this.isConnected) {
      console.warn('⚠️ Event Subscriber not connected, attempting reconnection...');
      await this.connect();
    }

    // Store handler for this event
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(handler);

    // Subscribe to Redis channel
    await this.subscriber.subscribe(eventName, (message) => {
      this.handleMessage(eventName, message);
    });

    console.log(`👂 Subscribed to event: ${eventName}`);
  }

  /**
   * Subscribe to multiple events with pattern matching
   * @param {string} pattern - Event pattern (e.g., 'user.*')
   * @param {Function} handler - Handler function for matching events
   */
  async subscribePattern(pattern, handler) {
    if (!this.isConnected) {
      await this.connect();
    }

    await this.subscriber.pSubscribe(pattern, (message, channel) => {
      this.handleMessage(channel, message);
    });

    // Store pattern handler
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, []);
    }
    this.handlers.get(pattern).push(handler);

    console.log(`👂 Subscribed to pattern: ${pattern}`);
  }

  /**
   * Handle incoming message
   * @param {string} eventName - Name of the event
   * @param {string} message - Raw message from Redis
   */
  async handleMessage(eventName, message) {
    try {
      const event = JSON.parse(message);
      
      console.log(`📨 Received event: ${eventName}`, {
        correlationId: event.metadata?.correlationId,
        source: event.metadata?.source
      });

      // Execute all handlers for this event
      const handlers = this.handlers.get(eventName) || [];
      
      for (const handler of handlers) {
        try {
          await handler(event.data, event.metadata);
        } catch (handlerError) {
          console.error(`❌ Handler error for event ${eventName}:`, handlerError.message);
        }
      }

    } catch (error) {
      console.error(`❌ Failed to process event ${eventName}:`, error.message);
    }
  }

  /**
   * Subscribe to user events
   * @param {string} eventType - Type of user event ('created', 'updated', etc.)
   * @param {Function} handler - Handler function
   */
  async subscribeToUserEvents(eventType, handler) {
    const eventName = `user.${eventType}`;
    await this.subscribe(eventName, handler);
  }

  /**
   * Subscribe to all user events
   * @param {Function} handler - Handler function
   */
  async subscribeToAllUserEvents(handler) {
    await this.subscribePattern('user.*', handler);
  }

  /**
   * Subscribe to product events
   * @param {string} eventType - Type of product event
   * @param {Function} handler - Handler function
   */
  async subscribeToProductEvents(eventType, handler) {
    const eventName = `product.${eventType}`;
    await this.subscribe(eventName, handler);
  }

  /**
   * Subscribe to order events
   * @param {string} eventType - Type of order event
   * @param {Function} handler - Handler function
   */
  async subscribeToOrderEvents(eventType, handler) {
    const eventName = `order.${eventType}`;
    await this.subscribe(eventName, handler);
  }

  /**
   * Subscribe to billing events
   * @param {string} eventType - Type of billing event
   * @param {Function} handler - Handler function
   */
  async subscribeToBillingEvents(eventType, handler) {
    const eventName = `billing.${eventType}`;
    await this.subscribe(eventName, handler);
  }

  /**
   * Subscribe to Bling events
   * @param {string} eventType - Type of Bling event
   * @param {Function} handler - Handler function
   */
  async subscribeToBlingEvents(eventType, handler) {
    const eventName = `bling.${eventType}`;
    await this.subscribe(eventName, handler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   */
  async unsubscribe(eventName) {
    try {
      await this.subscriber.unsubscribe(eventName);
      this.handlers.delete(eventName);
      console.log(`👋 Unsubscribed from event: ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from ${eventName}:`, error.message);
    }
  }

  /**
   * Close the subscriber connection
   */
  async close() {
    if (this.isConnected) {
      await this.subscriber.quit();
      this.isConnected = false;
      console.log('🔒 Event Subscriber disconnected');
    }
  }
}

module.exports = EventSubscriber;