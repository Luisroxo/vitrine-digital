const axios = require('axios');
const { Logger, EventPublisher } = require('../../../shared');
const BlingTokenManager = require('./BlingTokenManager');
const BlingOrderManager = require('./BlingOrderManager');
const BlingWebhookProcessor = require('./BlingWebhookProcessor');
const BlingEventProcessor = require('./BlingEventProcessor');
const BlingJobManager = require('./BlingJobManager');
const BlingPriceSyncService = require('./BlingPriceSyncService');

/**
 * Enhanced Bling Service with full multi-tenant support and advanced features
 */
class BlingService {
  constructor(database) {
    this.logger = new Logger('bling-service');
    this.db = database;

    // Initialize event publisher
    this.eventPublisher = new EventPublisher();

    // Initialize sub-services
    this.tokenManager = new BlingTokenManager(database);
    this.orderManager = new BlingOrderManager(database, this.eventPublisher);
    this.webhookProcessor = new BlingWebhookProcessor(database, this.eventPublisher);
    this.eventProcessor = new BlingEventProcessor(database, this, this.eventPublisher);
    this.jobManager = new BlingJobManager(database, this, this.eventPublisher);
    this.priceSyncService = new BlingPriceSyncService(database, this, this.eventPublisher);

    // Configuration
    this.config = {
      apiBaseUrl: 'https://www.bling.com.br/Api/v3',
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 1000,
      batchSize: 100,
      maxConcurrentRequests: 5
    };

    // State management
    this.state = {
      initialized: false,
      requestQueue: [],
      activeRequests: 0,
      rateLimitResets: new Map()
    };

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalProducts: 0,
      totalOrders: 0,
      lastSyncTime: null
    };

    this.initialize();
  }

  /**
   * Initialize the Bling service
   */
  async initialize() {
    try {
      this.logger.info('Initializing enhanced Bling service');

      // Initialize sub-services
      await this.tokenManager.initialize();
      await this.orderManager.initialize();
      await this.webhookProcessor.initialize();
      await this.eventProcessor.initialize();
      await this.jobManager.initialize();
      await this.priceSyncService.initialize();

      // Set up event listeners
      this.setupEventListeners();

      this.state.initialized = true;

      this.logger.info('Enhanced Bling service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Bling service', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen to token events
    this.tokenManager.on('token.refreshed', (data) => {
      this.logger.debug('Token refreshed', {
        tenantId: data.tenantId
      });
    });

    // Listen to order events
    this.orderManager.on('order.created', (data) => {
      this.logger.info('Order created in Bling', {
        tenantId: data.tenantId,
        orderId: data.orderId
      });
    });

    // Listen to job events
    this.jobManager.on('job.completed', (data) => {
      this.logger.info('Background job completed', {
        jobId: data.job.id,
        jobType: data.job.type
      });
    });
  }

  /**
   * OAuth2 Authorization
   */

  /**
   * Generate authorization URL for tenant
   */
  generateAuthorizationUrl(tenantId, redirectUri) {
    const clientId = process.env.BLING_CLIENT_ID;
    const state = Buffer.from(JSON.stringify({ tenantId, timestamp: Date.now() })).toString('base64');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      state,
      redirect_uri: redirectUri
    });

    return `${this.config.apiBaseUrl}/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, tenantId, redirectUri) {
    try {
      const clientId = process.env.BLING_CLIENT_ID;
      const clientSecret = process.env.BLING_CLIENT_SECRET;

      const response = await axios.post(`${this.config.apiBaseUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Store tokens
      await this.tokenManager.storeTokens(tenantId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in
      });

      this.logger.info('OAuth tokens obtained and stored', {
        tenantId
      });

      return {
        success: true,
        tenantId,
        expiresIn: expires_in
      };

    } catch (error) {
      this.logger.error('Failed to exchange code for token', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Core API Methods
   */

  /**
   * Make authenticated request to Bling API
   */
  async makeRequest(tenantId, method, endpoint, data = null, options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.stats.totalRequests++;

      // Get valid access token
      const accessToken = await this.tokenManager.getValidToken(tenantId);

      // Check rate limits
      await this.checkRateLimit(tenantId);

      // Prepare request configuration
      const config = {
        method: method.toUpperCase(),
        url: `${this.config.apiBaseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: options.timeout || this.config.defaultTimeout
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
        config.data = data;
      }

      if (data && config.method === 'GET') {
        config.params = data;
      }

      // Make request with retry logic
      const response = await this.requestWithRetry(config, requestId);

      const processingTime = Date.now() - startTime;
      this.stats.successfulRequests++;

      this.logger.debug('API request successful', {
        requestId,
        tenantId,
        method,
        endpoint,
        processingTime,
        statusCode: response.status
      });

      return response.data;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.stats.failedRequests++;

      this.logger.error('API request failed', {
        requestId,
        tenantId,
        method,
        endpoint,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Make request with retry logic
   */
  async requestWithRetry(config, requestId, retryCount = 0) {
    try {
      const response = await axios(config);

      // Update rate limit info
      this.updateRateLimitInfo(response.headers);

      return response;

    } catch (error) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || this.config.rateLimitDelay;
        
        this.logger.warn('Rate limit hit, waiting', {
          requestId,
          retryAfter
        });

        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.requestWithRetry(config, requestId, retryCount);
      }

      // Handle token expiration
      if (error.response?.status === 401 && retryCount === 0) {
        this.logger.info('Token expired, refreshing', { requestId });
        
        // Token will be refreshed automatically on next getValidToken call
        return this.requestWithRetry(config, requestId, retryCount + 1);
      }

      // Handle server errors with retry
      if (error.response?.status >= 500 && retryCount < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        
        this.logger.warn('Server error, retrying', {
          requestId,
          attempt: retryCount + 1,
          delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry(config, requestId, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Product Management
   */

  /**
   * Sync all products for tenant
   */
  async syncProducts(tenantId, options = {}) {
    try {
      this.logger.info('Starting product sync', { tenantId });

      const results = {
        synced: 0,
        failed: 0,
        total: 0,
        errors: []
      };

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.makeRequest(tenantId, 'GET', '/produtos', {
            pagina: page,
            limite: this.config.batchSize
          });

          const products = response.data || [];
          results.total += products.length;

          if (products.length === 0) {
            hasMore = false;
            continue;
          }

          // Process products
          for (const product of products) {
            try {
              await this.processProduct(tenantId, product);
              results.synced++;

            } catch (error) {
              results.failed++;
              results.errors.push({
                productId: product.id,
                error: error.message
              });

              this.logger.warn('Failed to process product', {
                tenantId,
                productId: product.id,
                error: error.message
              });
            }
          }

          page++;

          // Check if there are more pages
          if (products.length < this.config.batchSize) {
            hasMore = false;
          }

        } catch (error) {
          this.logger.error('Failed to fetch products page', {
            tenantId,
            page,
            error: error.message
          });

          results.failed += this.config.batchSize;
          break;
        }
      }

      // Update sync status
      await this.updateSyncStatus(tenantId, 'products', {
        lastSyncAt: new Date(),
        results
      });

      this.stats.totalProducts += results.synced;
      this.stats.lastSyncTime = new Date();

      this.logger.info('Product sync completed', {
        tenantId,
        results
      });

      return results;

    } catch (error) {
      this.logger.error('Product sync failed', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Sync single product
   */
  async syncSingleProduct(tenantId, productId) {
    try {
      const response = await this.makeRequest(tenantId, 'GET', `/produtos/${productId}`);
      
      if (!response.data) {
        throw new Error('Product not found');
      }

      await this.processProduct(tenantId, response.data);

      return {
        success: true,
        productId,
        data: response.data
      };

    } catch (error) {
      this.logger.error('Failed to sync single product', {
        tenantId,
        productId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process individual product
   */
  async processProduct(tenantId, productData) {
    try {
      // Store/update product in database
      await this.storeProduct(tenantId, productData);

      // Publish product event
      await this.eventPublisher.publish('bling.product.synced', {
        tenantId,
        productId: productData.id,
        productData,
        timestamp: new Date()
      });

      this.logger.debug('Product processed successfully', {
        tenantId,
        productId: productData.id
      });

    } catch (error) {
      this.logger.error('Failed to process product', {
        tenantId,
        productId: productData.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Store product in database
   */
  async storeProduct(tenantId, productData) {
    const productRecord = {
      tenant_id: tenantId,
      bling_product_id: productData.id,
      name: productData.nome,
      description: productData.descricao,
      price: productData.preco,
      cost: productData.precoCusto,
      stock: productData.estoque,
      sku: productData.codigo,
      category: productData.categoria?.descricao,
      status: productData.situacao,
      raw_data: JSON.stringify(productData),
      last_sync_at: new Date(),
      updated_at: new Date()
    };

    // Upsert product
    const existingProduct = await this.db('bling_products')
      .where({
        tenant_id: tenantId,
        bling_product_id: productData.id
      })
      .first();

    if (existingProduct) {
      await this.db('bling_products')
        .where({
          tenant_id: tenantId,
          bling_product_id: productData.id
        })
        .update(productRecord);
    } else {
      productRecord.created_at = new Date();
      await this.db('bling_products').insert(productRecord);
    }
  }

  /**
   * Order Management (using OrderManager)
   */

  async createOrder(tenantId, orderData, options = {}) {
    return await this.orderManager.createOrder(tenantId, orderData, options);
  }

  async updateOrder(tenantId, orderId, updateData) {
    return await this.orderManager.updateOrder(tenantId, orderId, updateData);
  }

  async cancelOrder(tenantId, orderId, reason) {
    return await this.orderManager.cancelOrder(tenantId, orderId, reason);
  }

  async getOrderTracking(tenantId, orderId) {
    return await this.orderManager.getOrderTracking(tenantId, orderId);
  }

  async syncRecentOrders(tenantId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      return await this.syncOrdersByDateRange(tenantId, {
        startDate,
        endDate
      });

    } catch (error) {
      this.logger.error('Failed to sync recent orders', {
        tenantId,
        days,
        error: error.message
      });

      throw error;
    }
  }

  async syncOrdersByDateRange(tenantId, dateRange) {
    try {
      const results = {
        synced: 0,
        failed: 0,
        total: 0,
        errors: []
      };

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.makeRequest(tenantId, 'GET', '/pedidos/vendas', {
            pagina: page,
            limite: this.config.batchSize,
            dataInicial: dateRange.startDate.toISOString().split('T')[0],
            dataFinal: dateRange.endDate.toISOString().split('T')[0]
          });

          const orders = response.data || [];
          results.total += orders.length;

          if (orders.length === 0) {
            hasMore = false;
            continue;
          }

          // Process orders
          for (const order of orders) {
            try {
              await this.processOrder(tenantId, order);
              results.synced++;

            } catch (error) {
              results.failed++;
              results.errors.push({
                orderId: order.id,
                error: error.message
              });
            }
          }

          page++;

          if (orders.length < this.config.batchSize) {
            hasMore = false;
          }

        } catch (error) {
          this.logger.error('Failed to fetch orders page', {
            tenantId,
            page,
            error: error.message
          });

          break;
        }
      }

      this.stats.totalOrders += results.synced;

      return results;

    } catch (error) {
      this.logger.error('Order sync failed', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  async processOrder(tenantId, orderData) {
    try {
      // Store order data
      await this.storeOrder(tenantId, orderData);

      // Publish event
      await this.eventPublisher.publish('bling.order.synced', {
        tenantId,
        orderId: orderData.id,
        orderData,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to process order', {
        tenantId,
        orderId: orderData.id,
        error: error.message
      });

      throw error;
    }
  }

  async storeOrder(tenantId, orderData) {
    const orderRecord = {
      tenant_id: tenantId,
      bling_order_id: orderData.id,
      number: orderData.numero,
      status: orderData.situacao,
      customer_name: orderData.contato?.nome,
      total_value: orderData.total,
      order_date: new Date(orderData.data),
      raw_data: JSON.stringify(orderData),
      last_sync_at: new Date(),
      updated_at: new Date()
    };

    // Upsert order
    const existingOrder = await this.db('bling_orders')
      .where({
        tenant_id: tenantId,
        bling_order_id: orderData.id
      })
      .first();

    if (existingOrder) {
      await this.db('bling_orders')
        .where({
          tenant_id: tenantId,
          bling_order_id: orderData.id
        })
        .update(orderRecord);
    } else {
      orderRecord.created_at = new Date();
      await this.db('bling_orders').insert(orderRecord);
    }
  }

  /**
   * Stock Management
   */

  async syncStock(tenantId) {
    try {
      this.logger.info('Starting stock sync', { tenantId });

      const results = {
        synced: 0,
        failed: 0,
        total: 0,
        errors: []
      };

      // Get products with stock information
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.makeRequest(tenantId, 'GET', '/estoques', {
            pagina: page,
            limite: this.config.batchSize
          });

          const stockItems = response.data || [];
          results.total += stockItems.length;

          if (stockItems.length === 0) {
            hasMore = false;
            continue;
          }

          // Process stock items
          for (const stockItem of stockItems) {
            try {
              await this.processStockItem(tenantId, stockItem);
              results.synced++;

            } catch (error) {
              results.failed++;
              results.errors.push({
                productId: stockItem.produto?.id,
                error: error.message
              });
            }
          }

          page++;

          if (stockItems.length < this.config.batchSize) {
            hasMore = false;
          }

        } catch (error) {
          this.logger.error('Failed to fetch stock page', {
            tenantId,
            page,
            error: error.message
          });

          break;
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Stock sync failed', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  async processStockItem(tenantId, stockItem) {
    try {
      // Update stock in products table
      await this.db('bling_products')
        .where({
          tenant_id: tenantId,
          bling_product_id: stockItem.produto.id
        })
        .update({
          stock: stockItem.saldoFisicoTotal,
          stock_updated_at: new Date()
        });

      // Publish stock event
      await this.eventPublisher.publish('bling.stock.updated', {
        tenantId,
        productId: stockItem.produto.id,
        newStock: stockItem.saldoFisicoTotal,
        timestamp: new Date()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Webhook Management
   */

  async processWebhook(req) {
    return await this.webhookProcessor.processWebhook(req);
  }

  async retryFailedWebhooks(limit = 10) {
    return await this.webhookProcessor.retryFailedWebhooks(limit);
  }

  async getWebhookStats(tenantId = null, days = 7) {
    return await this.webhookProcessor.getWebhookStats(tenantId, days);
  }

  /**
   * Background Jobs
   */

  async queueFullSync(tenantId, options = {}) {
    return await this.jobManager.queueJob('full_sync', { tenantId }, options);
  }

  async queueProductSync(tenantId, productIds = null) {
    return await this.jobManager.queueJob('product_sync', {
      tenantId,
      productIds
    });
  }

  async queueOrderSync(tenantId, dateRange = null) {
    return await this.jobManager.queueJob('order_sync', {
      tenantId,
      dateRange
    });
  }

  async getJobStatus(jobId) {
    return await this.jobManager.getJobStatus(jobId);
  }

  /**
   * Full Synchronization
   */

  async fullSync(tenantId, options = {}) {
    if (options.background) {
      return await this.queueFullSync(tenantId, options);
    }

    try {
      this.logger.info('Starting full synchronization', { tenantId });

      const results = {
        products: null,
        orders: null,
        stock: null,
        startTime: new Date(),
        endTime: null,
        totalTime: null
      };

      // Sync products
      results.products = await this.syncProducts(tenantId);

      // Sync stock
      results.stock = await this.syncStock(tenantId);

      // Sync recent orders
      results.orders = await this.syncRecentOrders(tenantId);

      results.endTime = new Date();
      results.totalTime = results.endTime.getTime() - results.startTime.getTime();

      this.logger.info('Full synchronization completed', {
        tenantId,
        results: {
          products: results.products.synced,
          orders: results.orders.synced,
          stock: results.stock.synced,
          totalTime: results.totalTime
        }
      });

      // Publish completion event
      await this.eventPublisher.publish('bling.full_sync.completed', {
        tenantId,
        results,
        timestamp: new Date()
      });

      return results;

    } catch (error) {
      this.logger.error('Full synchronization failed', {
        tenantId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Utility Methods
   */

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkRateLimit(tenantId) {
    const resetTime = this.state.rateLimitResets.get(tenantId);
    
    if (resetTime && Date.now() < resetTime) {
      const waitTime = resetTime - Date.now();
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  updateRateLimitInfo(headers) {
    const resetTime = headers['x-ratelimit-reset'];
    if (resetTime) {
      // Store rate limit reset time per tenant if available
      // Implementation depends on Bling API rate limit headers
    }
  }

  async updateSyncStatus(tenantId, syncType, data) {
    try {
      await this.db('bling_sync_status')
        .insert({
          tenant_id: tenantId,
          sync_type: syncType,
          ...data,
          created_at: new Date()
        });
    } catch (error) {
      this.logger.error('Failed to update sync status', {
        tenantId,
        syncType,
        error: error.message
      });
    }
  }

  /**
   * Public API Methods
   */

  getServiceStatistics() {
    return {
      ...this.stats,
      tokenManager: this.tokenManager.getStatistics(),
      orderManager: this.orderManager.getStatistics(),
      jobManager: this.jobManager.getManagerStatistics(),
      eventProcessor: this.eventProcessor.getStatistics()
    };
  }

  async getTenantSyncStatus(tenantId) {
    const syncStatus = await this.db('bling_sync_status')
      .where('tenant_id', tenantId)
      .orderBy('created_at', 'desc')
      .limit(10)
      .select('*');

    return syncStatus;
  }

  async getIntegrationHealth(tenantId) {
    try {
      const health = {
        tenant: tenantId,
        status: 'healthy',
        checks: {
          tokenValid: false,
          apiConnectivity: false,
          lastSync: null,
          webhookStatus: 'unknown'
        },
        timestamp: new Date()
      };

      // Check token validity
      try {
        await this.tokenManager.getValidToken(tenantId);
        health.checks.tokenValid = true;
      } catch (error) {
        health.status = 'degraded';
        health.checks.tokenValid = false;
      }

      // Check API connectivity
      try {
        await this.makeRequest(tenantId, 'GET', '/situacao');
        health.checks.apiConnectivity = true;
      } catch (error) {
        health.status = 'unhealthy';
        health.checks.apiConnectivity = false;
      }

      // Get last sync info
      const lastSync = await this.db('bling_sync_status')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc')
        .first();

      if (lastSync) {
        health.checks.lastSync = lastSync.created_at;
      }

      return health;

    } catch (error) {
      return {
        tenant: tenantId,
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Price Sync Methods
   */

  /**
   * Manually trigger price sync for all tenants
   */
  async syncAllPrices() {
    try {
      this.logger.info('Manual price sync triggered');
      return await this.priceSyncService.syncAllTenantPrices();
    } catch (error) {
      this.logger.error('Manual price sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync prices for specific tenant
   */
  async syncTenantPrices(tenantId) {
    try {
      this.logger.info(`Manual price sync triggered for tenant ${tenantId}`);
      return await this.priceSyncService.syncTenantPrices(tenantId);
    } catch (error) {
      this.logger.error(`Price sync failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get price sync statistics
   */
  getPriceSyncStats() {
    return this.priceSyncService.getStats();
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(tenantId, productId, limit = 50) {
    return await this.priceSyncService.getPriceHistory(tenantId, productId, limit);
  }

  /**
   * Handle webhook price update
   */
  async handlePriceWebhook(webhookData) {
    return await this.priceSyncService.handleWebhookPriceUpdate(webhookData);
  }

  /**
   * Cleanup and maintenance
   */

  async cleanup() {
    try {
      if (this.jobManager) {
        await this.jobManager.stop();
      }

      if (this.eventProcessor) {
        await this.eventProcessor.stopProcessingLoop();
      }

      if (this.priceSyncService) {
        this.priceSyncService.stopPeriodicSync();
      }

      this.logger.info('Bling service cleanup completed');

    } catch (error) {
      this.logger.error('Cleanup failed', {
        error: error.message
      });
    }
  }
}

module.exports = BlingService;