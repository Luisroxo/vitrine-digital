const BlingAPI = require('./BlingAPI');
const ConnectionService = require('./ConnectionService');
const { Logger } = require('../../shared');
const Bull = require('bull');
const Redis = require('redis');

class SyncService {
  constructor() {
    this.blingAPI = new BlingAPI();
    this.connectionService = new ConnectionService();
    this.logger = new Logger('sync-service');
    
    // Initialize Redis and Bull queues
    this.redis = Redis.createClient({
      host: process.env.QUEUE_REDIS_HOST || 'localhost',
      port: process.env.QUEUE_REDIS_PORT || 6379
    });
    
    this.syncQueue = new Bull('bling-sync', {
      redis: {
        host: process.env.QUEUE_REDIS_HOST || 'localhost',
        port: process.env.QUEUE_REDIS_PORT || 6379
      }
    });

    this.setupQueueProcessors();
  }

  // Setup queue processors
  setupQueueProcessors() {
    // Product sync processor
    this.syncQueue.process('sync-products', async (job) => {
      return this.syncProducts(job.data);
    });

    // Order sync processor  
    this.syncQueue.process('sync-orders', async (job) => {
      return this.syncOrders(job.data);
    });

    // Inventory sync processor
    this.syncQueue.process('sync-inventory', async (job) => {
      return this.syncInventory(job.data);
    });

    // Contact sync processor
    this.syncQueue.process('sync-contacts', async (job) => {
      return this.syncContacts(job.data);
    });

    // Error handling
    this.syncQueue.on('failed', (job, err) => {
      this.logger.error('Sync job failed', {
        jobId: job.id,
        type: job.name,
        tenantId: job.data.tenantId,
        error: err.message
      });
    });

    this.syncQueue.on('completed', (job, result) => {
      this.logger.info('Sync job completed', {
        jobId: job.id,
        type: job.name,
        tenantId: job.data.tenantId,
        result: result.summary
      });
    });
  }

  // Schedule sync job
  async scheduleSyncJob(tenantId, jobType, config = {}) {
    try {
      const connection = await this.connectionService.getActiveConnection(tenantId);
      if (!connection) {
        throw new Error('No active Bling connection found');
      }

      const jobData = {
        tenantId,
        connectionId: connection.id,
        config,
        startTime: Date.now()
      };

      const job = await this.syncQueue.add(`sync-${jobType}`, jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 50,
        removeOnFail: 20
      });

      this.logger.info('Sync job scheduled', {
        jobId: job.id,
        type: jobType,
        tenantId
      });

      return { jobId: job.id, status: 'scheduled' };
    } catch (error) {
      this.logger.error('Failed to schedule sync job', {
        tenantId,
        jobType,
        error: error.message
      });
      throw error;
    }
  }

  // Sync products from Bling
  async syncProducts(jobData) {
    const { tenantId, connectionId, config } = jobData;
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionService.getConnection(connectionId);
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      
      let page = 1;
      let totalSynced = 0;
      let totalErrors = 0;
      const errors = [];

      while (true) {
        try {
          const response = await this.blingAPI.getProducts(
            accessToken, 
            page, 
            config.pageSize || 100,
            config.filters || {}
          );

          if (!response.data || response.data.length === 0) {
            break; // No more products
          }

          // Process products
          for (const product of response.data) {
            try {
              await this.processProduct(tenantId, product);
              totalSynced++;
            } catch (error) {
              totalErrors++;
              errors.push({
                productId: product.id,
                error: error.message
              });
              
              this.logger.warn('Product sync error', {
                tenantId,
                productId: product.id,
                error: error.message
              });
            }
          }

          page++;
          
          // Check if we have more pages
          if (response.data.length < (config.pageSize || 100)) {
            break;
          }

        } catch (error) {
          this.logger.error('Error fetching products page', {
            tenantId,
            page,
            error: error.message
          });
          throw error;
        }
      }

      const duration = Date.now() - startTime;
      const summary = {
        type: 'products',
        totalSynced,
        totalErrors,
        duration,
        pages: page - 1
      };

      // Update connection sync status
      await this.connectionService.updateSyncStatus(connectionId, {
        last_sync_at: new Date(),
        sync_errors: errors.length > 0 ? errors.slice(0, 10) : null, // Store last 10 errors
        error_count: totalErrors
      });

      this.logger.info('Product sync completed', {
        tenantId,
        summary
      });

      return { success: true, summary };

    } catch (error) {
      this.logger.error('Product sync failed', {
        tenantId,
        error: error.message
      });
      
      // Update connection error count
      await this.connectionService.incrementErrorCount(connectionId);
      throw error;
    }
  }

  // Sync orders from Bling
  async syncOrders(jobData) {
    const { tenantId, connectionId, config } = jobData;
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionService.getConnection(connectionId);
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      
      let page = 1;
      let totalSynced = 0;
      let totalErrors = 0;
      const errors = [];

      while (true) {
        try {
          const response = await this.blingAPI.getOrders(
            accessToken,
            page,
            config.pageSize || 100,
            config.filters || {}
          );

          if (!response.data || response.data.length === 0) {
            break;
          }

          // Process orders
          for (const order of response.data) {
            try {
              await this.processOrder(tenantId, order);
              totalSynced++;
            } catch (error) {
              totalErrors++;
              errors.push({
                orderId: order.id,
                error: error.message
              });
            }
          }

          page++;
          
          if (response.data.length < (config.pageSize || 100)) {
            break;
          }

        } catch (error) {
          this.logger.error('Error fetching orders page', {
            tenantId,
            page,
            error: error.message
          });
          throw error;
        }
      }

      const duration = Date.now() - startTime;
      const summary = {
        type: 'orders',
        totalSynced,
        totalErrors,
        duration,
        pages: page - 1
      };

      await this.connectionService.updateSyncStatus(connectionId, {
        last_sync_at: new Date(),
        sync_errors: errors.length > 0 ? errors.slice(0, 10) : null,
        error_count: totalErrors
      });

      return { success: true, summary };

    } catch (error) {
      this.logger.error('Order sync failed', {
        tenantId,
        error: error.message
      });
      
      await this.connectionService.incrementErrorCount(connectionId);
      throw error;
    }
  }

  // Sync inventory from Bling
  async syncInventory(jobData) {
    const { tenantId, connectionId, config } = jobData;
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionService.getConnection(connectionId);
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      
      // Get list of products to sync inventory for
      const productIds = config.productIds || [];
      let totalSynced = 0;
      let totalErrors = 0;
      const errors = [];

      if (productIds.length === 0) {
        // If no specific products, get all products first
        const productsResponse = await this.blingAPI.getProducts(accessToken, 1, 1000);
        productIds.push(...(productsResponse.data || []).map(p => p.id));
      }

      // Sync inventory for each product
      for (const productId of productIds) {
        try {
          const inventory = await this.blingAPI.getInventory(accessToken, productId);
          await this.processInventory(tenantId, productId, inventory);
          totalSynced++;
        } catch (error) {
          totalErrors++;
          errors.push({
            productId,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;
      const summary = {
        type: 'inventory',
        totalSynced,
        totalErrors,
        duration,
        productsProcessed: productIds.length
      };

      await this.connectionService.updateSyncStatus(connectionId, {
        last_sync_at: new Date(),
        sync_errors: errors.length > 0 ? errors.slice(0, 10) : null,
        error_count: totalErrors
      });

      return { success: true, summary };

    } catch (error) {
      this.logger.error('Inventory sync failed', {
        tenantId,
        error: error.message
      });
      
      await this.connectionService.incrementErrorCount(connectionId);
      throw error;
    }
  }

  // Sync contacts from Bling
  async syncContacts(jobData) {
    const { tenantId, connectionId, config } = jobData;
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionService.getConnection(connectionId);
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      
      let page = 1;
      let totalSynced = 0;
      let totalErrors = 0;
      const errors = [];

      while (true) {
        try {
          const response = await this.blingAPI.getContacts(
            accessToken,
            page,
            config.pageSize || 100,
            config.filters || {}
          );

          if (!response.data || response.data.length === 0) {
            break;
          }

          // Process contacts
          for (const contact of response.data) {
            try {
              await this.processContact(tenantId, contact);
              totalSynced++;
            } catch (error) {
              totalErrors++;
              errors.push({
                contactId: contact.id,
                error: error.message
              });
            }
          }

          page++;
          
          if (response.data.length < (config.pageSize || 100)) {
            break;
          }

        } catch (error) {
          this.logger.error('Error fetching contacts page', {
            tenantId,
            page,
            error: error.message
          });
          throw error;
        }
      }

      const duration = Date.now() - startTime;
      const summary = {
        type: 'contacts',
        totalSynced,
        totalErrors,
        duration,
        pages: page - 1
      };

      await this.connectionService.updateSyncStatus(connectionId, {
        last_sync_at: new Date(),
        sync_errors: errors.length > 0 ? errors.slice(0, 10) : null,
        error_count: totalErrors
      });

      return { success: true, summary };

    } catch (error) {
      this.logger.error('Contact sync failed', {
        tenantId,
        error: error.message
      });
      
      await this.connectionService.incrementErrorCount(connectionId);
      throw error;
    }
  }

  // Process individual product (to be implemented based on business logic)
  async processProduct(tenantId, product) {
    // TODO: Implement product processing logic
    // This would typically involve:
    // 1. Transforming Bling product data to internal format
    // 2. Calling Product Service API to create/update product
    // 3. Handling errors and conflicts
    
    this.logger.debug('Processing product', {
      tenantId,
      productId: product.id,
      name: product.name
    });
  }

  // Process individual order
  async processOrder(tenantId, order) {
    // TODO: Implement order processing logic
    this.logger.debug('Processing order', {
      tenantId,
      orderId: order.id,
      status: order.status
    });
  }

  // Process inventory data
  async processInventory(tenantId, productId, inventory) {
    // TODO: Implement inventory processing logic
    this.logger.debug('Processing inventory', {
      tenantId,
      productId,
      quantity: inventory.quantity
    });
  }

  // Process contact data
  async processContact(tenantId, contact) {
    // TODO: Implement contact processing logic
    this.logger.debug('Processing contact', {
      tenantId,
      contactId: contact.id,
      name: contact.name
    });
  }

  // Get sync job status
  async getSyncJobStatus(jobId) {
    try {
      const job = await this.syncQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress(),
        state: await job.getState(),
        result: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      this.logger.error('Error getting sync job status', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  // Cancel sync job
  async cancelSyncJob(jobId) {
    try {
      const job = await this.syncQueue.getJob(jobId);
      if (job) {
        await job.remove();
        return { success: true };
      }
      return { success: false, reason: 'Job not found' };
    } catch (error) {
      this.logger.error('Error canceling sync job', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  // Get sync statistics
  async getSyncStats(tenantId) {
    try {
      const waiting = await this.syncQueue.getWaiting();
      const active = await this.syncQueue.getActive();
      const completed = await this.syncQueue.getCompleted(0, 100);
      const failed = await this.syncQueue.getFailed(0, 100);

      // Filter by tenant
      const filterByTenant = (jobs) => 
        jobs.filter(job => job.data && job.data.tenantId === tenantId);

      return {
        waiting: filterByTenant(waiting).length,
        active: filterByTenant(active).length,
        completed: filterByTenant(completed).length,
        failed: filterByTenant(failed).length,
        recentJobs: filterByTenant([...completed, ...failed])
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10)
          .map(job => ({
            id: job.id,
            name: job.name,
            state: job.opts.jobId ? 'completed' : 'failed',
            processedOn: job.processedOn,
            finishedOn: job.finishedOn
          }))
      };
    } catch (error) {
      this.logger.error('Error getting sync stats', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = SyncService;