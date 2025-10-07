const EventEmitter = require('events');
const { Logger } = require('../../../shared');

/**
 * Background Job Manager for Bling Service
 * Handles heavy operations like full sync, bulk imports, and scheduled tasks
 */
class BlingJobManager extends EventEmitter {
  constructor(database, blingService, eventPublisher) {
    super();
    this.logger = new Logger('bling-job-manager');
    this.db = database;
    this.blingService = blingService;
    this.eventPublisher = eventPublisher;

    // Configuration
    this.config = {
      maxConcurrentJobs: 3,
      jobTimeout: 30 * 60 * 1000, // 30 minutes
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds base delay
      heartbeatInterval: 30000, // 30 seconds
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      maxJobHistory: 1000
    };

    // State management
    this.state = {
      isRunning: false,
      activeJobs: new Map(),
      jobQueue: [],
      completedJobs: 0,
      failedJobs: 0,
      totalProcessingTime: 0
    };

    // Job type definitions
    this.jobTypes = new Map([
      ['full_sync', {
        handler: this.handleFullSyncJob.bind(this),
        timeout: 60 * 60 * 1000, // 1 hour
        retries: 2,
        priority: 'high'
      }],
      ['product_sync', {
        handler: this.handleProductSyncJob.bind(this),
        timeout: 20 * 60 * 1000, // 20 minutes
        retries: 3,
        priority: 'normal'
      }],
      ['order_sync', {
        handler: this.handleOrderSyncJob.bind(this),
        timeout: 30 * 60 * 1000, // 30 minutes
        retries: 3,
        priority: 'high'
      }],
      ['bulk_import', {
        handler: this.handleBulkImportJob.bind(this),
        timeout: 45 * 60 * 1000, // 45 minutes
        retries: 2,
        priority: 'normal'
      }],
      ['stock_sync', {
        handler: this.handleStockSyncJob.bind(this),
        timeout: 15 * 60 * 1000, // 15 minutes
        retries: 3,
        priority: 'high'
      }],
      ['cleanup', {
        handler: this.handleCleanupJob.bind(this),
        timeout: 10 * 60 * 1000, // 10 minutes
        retries: 1,
        priority: 'low'
      }],
      ['report_generation', {
        handler: this.handleReportGenerationJob.bind(this),
        timeout: 20 * 60 * 1000, // 20 minutes
        retries: 2,
        priority: 'normal'
      }],
      ['webhook_replay', {
        handler: this.handleWebhookReplayJob.bind(this),
        timeout: 30 * 60 * 1000, // 30 minutes
        retries: 2,
        priority: 'normal'
      }]
    ]);

    this.initialize();
  }

  /**
   * Initialize the job manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing Bling job manager');

      // Set up event listeners
      this.setupEventListeners();

      // Recover pending jobs
      await this.recoverPendingJobs();

      // Start job processing
      this.start();

      // Schedule maintenance tasks
      this.scheduleMaintenanceTasks();

      this.logger.info('Bling job manager initialized successfully', {
        supportedJobTypes: Array.from(this.jobTypes.keys()),
        maxConcurrency: this.config.maxConcurrentJobs
      });

    } catch (error) {
      this.logger.error('Failed to initialize job manager', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.on('job.queued', this.onJobQueued.bind(this));
    this.on('job.started', this.onJobStarted.bind(this));
    this.on('job.progress', this.onJobProgress.bind(this));
    this.on('job.completed', this.onJobCompleted.bind(this));
    this.on('job.failed', this.onJobFailed.bind(this));

    // Error handling
    this.on('error', (error) => {
      this.logger.error('Job manager error', {
        error: error.message
      });
    });
  }

  /**
   * Start the job manager
   */
  start() {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;

    // Start processing loop
    this.processingLoop = setInterval(
      this.processJobs.bind(this),
      1000 // Check every second
    );

    // Start heartbeat for active jobs
    this.heartbeatLoop = setInterval(
      this.updateJobHeartbeats.bind(this),
      this.config.heartbeatInterval
    );

    this.logger.info('Job manager started');
  }

  /**
   * Stop the job manager
   */
  async stop() {
    this.state.isRunning = false;

    // Clear intervals
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
    }

    if (this.heartbeatLoop) {
      clearInterval(this.heartbeatLoop);
    }

    // Wait for active jobs to complete or timeout
    const activeJobIds = Array.from(this.state.activeJobs.keys());
    if (activeJobIds.length > 0) {
      this.logger.info('Waiting for active jobs to complete', {
        activeJobs: activeJobIds.length
      });

      // Wait up to 60 seconds for jobs to complete
      const maxWaitTime = 60000;
      const startTime = Date.now();

      while (
        this.state.activeJobs.size > 0 &&
        Date.now() - startTime < maxWaitTime
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Force stop remaining jobs
      if (this.state.activeJobs.size > 0) {
        this.logger.warn('Force stopping remaining jobs', {
          remainingJobs: this.state.activeJobs.size
        });

        for (const [jobId, jobContext] of this.state.activeJobs) {
          await this.markJobAsFailed(jobId, 'Job manager shutdown');
        }
      }
    }

    this.logger.info('Job manager stopped');
  }

  /**
   * Queue a new job
   */
  async queueJob(jobType, jobData, options = {}) {
    const jobId = this.generateJobId();

    try {
      // Validate job type
      if (!this.jobTypes.has(jobType)) {
        throw new Error(`Unsupported job type: ${jobType}`);
      }

      const jobConfig = this.jobTypes.get(jobType);

      // Create job object
      const job = {
        id: jobId,
        type: jobType,
        data: jobData,
        options: {
          ...options,
          timeout: options.timeout || jobConfig.timeout,
          retries: options.retries ?? jobConfig.retries,
          priority: options.priority || jobConfig.priority
        },
        status: 'queued',
        progress: 0,
        createdAt: new Date(),
        tenantId: jobData.tenantId,
        retryCount: 0,
        error: null
      };

      // Store job in database
      await this.storeJob(job);

      // Add to queue (priority-based)
      this.insertJobInQueue(job);

      this.emit('job.queued', job);

      this.logger.info('Job queued successfully', {
        jobId,
        jobType,
        tenantId: jobData.tenantId,
        queuePosition: this.state.jobQueue.length
      });

      return {
        jobId,
        status: 'queued',
        queuePosition: this.state.jobQueue.length
      };

    } catch (error) {
      this.logger.error('Failed to queue job', {
        jobId,
        jobType,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process jobs in queue
   */
  async processJobs() {
    if (!this.state.isRunning) {
      return;
    }

    // Check if we can start new jobs
    if (
      this.state.activeJobs.size >= this.config.maxConcurrentJobs ||
      this.state.jobQueue.length === 0
    ) {
      return;
    }

    // Get next job from queue
    const job = this.state.jobQueue.shift();
    if (!job) {
      return;
    }

    // Start processing the job
    await this.startJob(job);
  }

  /**
   * Start processing a job
   */
  async startJob(job) {
    try {
      // Update job status
      job.status = 'running';
      job.startedAt = new Date();
      job.lastHeartbeat = new Date();

      // Add to active jobs
      this.state.activeJobs.set(job.id, job);

      // Update database
      await this.updateJobStatus(job.id, 'running', {
        started_at: job.startedAt,
        last_heartbeat: job.lastHeartbeat
      });

      this.emit('job.started', job);

      this.logger.info('Job started', {
        jobId: job.id,
        jobType: job.type,
        tenantId: job.tenantId
      });

      // Execute job with timeout
      const jobPromise = this.executeJob(job);
      const timeoutPromise = this.createJobTimeout(job);

      const result = await Promise.race([
        jobPromise,
        timeoutPromise
      ]);

      // Job completed successfully
      await this.completeJob(job, result);

    } catch (error) {
      // Job failed
      await this.failJob(job, error);
    }
  }

  /**
   * Execute job handler
   */
  async executeJob(job) {
    const jobConfig = this.jobTypes.get(job.type);
    
    if (!jobConfig || !jobConfig.handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Create progress callback
    const progressCallback = (progress, message) => {
      this.updateJobProgress(job.id, progress, message);
    };

    // Execute handler
    return await jobConfig.handler(job.data, job.options, progressCallback);
  }

  /**
   * Create job timeout promise
   */
  createJobTimeout(job) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job timeout after ${job.options.timeout}ms`));
      }, job.options.timeout);
    });
  }

  /**
   * Complete a job successfully
   */
  async completeJob(job, result) {
    try {
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      job.progress = 100;

      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();

      // Update statistics
      this.state.completedJobs++;
      this.state.totalProcessingTime += processingTime;

      // Remove from active jobs
      this.state.activeJobs.delete(job.id);

      // Update database
      await this.updateJobStatus(job.id, 'completed', {
        completed_at: job.completedAt,
        result: JSON.stringify(result),
        progress: 100,
        processing_time: processingTime
      });

      this.emit('job.completed', { job, result, processingTime });

      this.logger.info('Job completed successfully', {
        jobId: job.id,
        jobType: job.type,
        tenantId: job.tenantId,
        processingTime
      });

      // Publish completion event
      await this.eventPublisher.publish('bling.job.completed', {
        jobId: job.id,
        jobType: job.type,
        tenantId: job.tenantId,
        result,
        processingTime,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to complete job', {
        jobId: job.id,
        error: error.message
      });
    }
  }

  /**
   * Fail a job
   */
  async failJob(job, error) {
    try {
      job.error = error.message;
      
      const processingTime = Date.now() - job.startedAt.getTime();

      // Check if we should retry
      if (job.retryCount < job.options.retries) {
        job.retryCount++;
        job.status = 'retrying';

        // Schedule retry
        const retryDelay = this.config.retryDelay * Math.pow(2, job.retryCount);
        
        setTimeout(() => {
          if (this.state.isRunning) {
            job.status = 'queued';
            this.insertJobInQueue(job);
          }
        }, retryDelay);

        this.logger.warn('Job scheduled for retry', {
          jobId: job.id,
          retryCount: job.retryCount,
          maxRetries: job.options.retries,
          retryDelay
        });

        // Update database
        await this.updateJobStatus(job.id, 'retrying', {
          retry_count: job.retryCount,
          error_message: error.message,
          processing_time: processingTime
        });

      } else {
        // Job failed permanently
        job.status = 'failed';
        job.failedAt = new Date();

        // Update statistics
        this.state.failedJobs++;

        // Update database
        await this.updateJobStatus(job.id, 'failed', {
          failed_at: job.failedAt,
          error_message: error.message,
          processing_time: processingTime
        });

        this.emit('job.failed', { job, error, processingTime });

        this.logger.error('Job failed permanently', {
          jobId: job.id,
          jobType: job.type,
          tenantId: job.tenantId,
          error: error.message,
          processingTime
        });

        // Publish failure event
        await this.eventPublisher.publish('bling.job.failed', {
          jobId: job.id,
          jobType: job.type,
          tenantId: job.tenantId,
          error: error.message,
          processingTime,
          timestamp: new Date()
        });
      }

      // Remove from active jobs
      this.state.activeJobs.delete(job.id);

    } catch (updateError) {
      this.logger.error('Failed to update job failure', {
        jobId: job.id,
        originalError: error.message,
        updateError: updateError.message
      });
    }
  }

  /**
   * Job Handlers
   */

  async handleFullSyncJob(data, options, progressCallback) {
    const { tenantId } = data;
    
    progressCallback(0, 'Starting full synchronization');

    this.logger.info('Starting full sync job', { tenantId });

    const startTime = Date.now();
    const results = {
      products: { synced: 0, failed: 0 },
      orders: { synced: 0, failed: 0 },
      stock: { synced: 0, failed: 0 }
    };

    try {
      // Step 1: Sync products (40% of progress)
      progressCallback(10, 'Syncing products from Bling');
      const productResult = await this.blingService.syncProducts(tenantId);
      results.products = productResult;
      progressCallback(40, `Synced ${productResult.synced} products`);

      // Step 2: Sync stock (30% of progress)
      progressCallback(50, 'Syncing stock information');
      const stockResult = await this.blingService.syncStock(tenantId);
      results.stock = stockResult;
      progressCallback(70, `Synced stock for ${stockResult.synced} products`);

      // Step 3: Sync recent orders (30% of progress)
      progressCallback(80, 'Syncing recent orders');
      const orderResult = await this.blingService.syncRecentOrders(tenantId);
      results.orders = orderResult;
      progressCallback(90, `Synced ${orderResult.synced} orders`);

      // Complete
      const processingTime = Date.now() - startTime;
      progressCallback(100, 'Full synchronization completed');

      this.logger.info('Full sync job completed', {
        tenantId,
        results,
        processingTime
      });

      return {
        success: true,
        results,
        processingTime,
        completedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Full sync job failed', {
        tenantId,
        error: error.message,
        partialResults: results
      });

      throw error;
    }
  }

  async handleProductSyncJob(data, options, progressCallback) {
    const { tenantId, productIds } = data;

    progressCallback(0, 'Starting product synchronization');

    if (productIds && productIds.length > 0) {
      // Sync specific products
      let completed = 0;
      const results = [];

      for (const productId of productIds) {
        try {
          const result = await this.blingService.syncSingleProduct(tenantId, productId);
          results.push({ productId, success: true, result });
          
          completed++;
          const progress = Math.floor((completed / productIds.length) * 100);
          progressCallback(progress, `Synced product ${completed}/${productIds.length}`);

        } catch (error) {
          results.push({ productId, success: false, error: error.message });
        }
      }

      return { results, totalProducts: productIds.length };

    } else {
      // Sync all products
      return await this.blingService.syncProducts(tenantId);
    }
  }

  async handleOrderSyncJob(data, options, progressCallback) {
    const { tenantId, dateRange, orderIds } = data;

    progressCallback(0, 'Starting order synchronization');

    if (orderIds && orderIds.length > 0) {
      // Sync specific orders
      const results = [];
      let completed = 0;

      for (const orderId of orderIds) {
        try {
          const result = await this.blingService.syncSingleOrder(tenantId, orderId);
          results.push({ orderId, success: true, result });

          completed++;
          const progress = Math.floor((completed / orderIds.length) * 100);
          progressCallback(progress, `Synced order ${completed}/${orderIds.length}`);

        } catch (error) {
          results.push({ orderId, success: false, error: error.message });
        }
      }

      return { results, totalOrders: orderIds.length };

    } else {
      // Sync orders by date range
      return await this.blingService.syncOrdersByDateRange(tenantId, dateRange);
    }
  }

  async handleBulkImportJob(data, options, progressCallback) {
    const { tenantId, importType, items } = data;

    progressCallback(0, `Starting bulk import: ${importType}`);

    const results = {
      total: items.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < items.length; i++) {
      try {
        await this.processBulkImportItem(tenantId, importType, items[i]);
        results.imported++;

        const progress = Math.floor(((i + 1) / items.length) * 100);
        progressCallback(progress, `Imported ${i + 1}/${items.length} items`);

      } catch (error) {
        results.failed++;
        results.errors.push({
          item: items[i],
          error: error.message
        });
      }
    }

    return results;
  }

  async handleStockSyncJob(data, options, progressCallback) {
    const { tenantId } = data;

    progressCallback(0, 'Starting stock synchronization');

    return await this.blingService.syncStock(tenantId);
  }

  async handleCleanupJob(data, options, progressCallback) {
    const { tenantId, cleanupType } = data;

    progressCallback(0, `Starting cleanup: ${cleanupType}`);

    const results = {};

    switch (cleanupType) {
      case 'old_sync_records':
        results.deletedRecords = await this.cleanupOldSyncRecords(tenantId);
        break;

      case 'failed_webhooks':
        results.deletedWebhooks = await this.cleanupFailedWebhooks(tenantId);
        break;

      case 'expired_tokens':
        results.deletedTokens = await this.cleanupExpiredTokens(tenantId);
        break;

      default:
        throw new Error(`Unknown cleanup type: ${cleanupType}`);
    }

    progressCallback(100, 'Cleanup completed');

    return results;
  }

  async handleReportGenerationJob(data, options, progressCallback) {
    const { tenantId, reportType, parameters } = data;

    progressCallback(0, `Generating report: ${reportType}`);

    // This would generate various reports like sync statistics,
    // order summaries, inventory reports, etc.
    
    const result = {
      reportType,
      parameters,
      generatedAt: new Date(),
      // ... report data would be generated here
    };

    progressCallback(100, 'Report generated successfully');

    return result;
  }

  async handleWebhookReplayJob(data, options, progressCallback) {
    const { tenantId, startDate, endDate } = data;

    progressCallback(0, 'Starting webhook replay');

    // Find failed webhooks in date range and replay them
    const failedWebhooks = await this.db('bling_webhooks')
      .where('tenant_id', tenantId)
      .where('status', 'failed')
      .whereBetween('created_at', [startDate, endDate])
      .select('*');

    const results = {
      total: failedWebhooks.length,
      replayed: 0,
      failed: 0
    };

    for (let i = 0; i < failedWebhooks.length; i++) {
      try {
        // Replay webhook logic would go here
        await this.replayWebhook(failedWebhooks[i]);
        results.replayed++;

        const progress = Math.floor(((i + 1) / failedWebhooks.length) * 100);
        progressCallback(progress, `Replayed ${i + 1}/${failedWebhooks.length} webhooks`);

      } catch (error) {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Helper methods
   */

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  insertJobInQueue(job) {
    // Priority-based insertion
    const priorities = { high: 0, normal: 1, low: 2 };
    const jobPriority = priorities[job.options.priority] || 1;

    let insertIndex = this.state.jobQueue.length;
    for (let i = 0; i < this.state.jobQueue.length; i++) {
      const queueItemPriority = priorities[this.state.jobQueue[i].options.priority] || 1;
      if (jobPriority < queueItemPriority) {
        insertIndex = i;
        break;
      }
    }

    this.state.jobQueue.splice(insertIndex, 0, job);
  }

  async storeJob(job) {
    await this.db('bling_jobs').insert({
      job_id: job.id,
      job_type: job.type,
      tenant_id: job.tenantId,
      data: JSON.stringify(job.data),
      options: JSON.stringify(job.options),
      status: job.status,
      progress: job.progress,
      retry_count: job.retryCount,
      created_at: job.createdAt
    });
  }

  async updateJobStatus(jobId, status, additionalData = {}) {
    const updateData = {
      status,
      updated_at: new Date(),
      ...additionalData
    };

    await this.db('bling_jobs')
      .where('job_id', jobId)
      .update(updateData);
  }

  updateJobProgress(jobId, progress, message) {
    const job = this.state.activeJobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.progressMessage = message;
      job.lastHeartbeat = new Date();

      this.emit('job.progress', { job, progress, message });

      // Update database periodically
      if (progress % 10 === 0) { // Every 10%
        this.updateJobStatus(jobId, job.status, {
          progress,
          progress_message: message,
          last_heartbeat: job.lastHeartbeat
        }).catch(error => {
          this.logger.error('Failed to update job progress', {
            jobId,
            error: error.message
          });
        });
      }
    }
  }

  async updateJobHeartbeats() {
    for (const [jobId, job] of this.state.activeJobs) {
      try {
        job.lastHeartbeat = new Date();
        
        await this.updateJobStatus(jobId, job.status, {
          last_heartbeat: job.lastHeartbeat
        });

      } catch (error) {
        this.logger.error('Failed to update job heartbeat', {
          jobId,
          error: error.message
        });
      }
    }
  }

  async recoverPendingJobs() {
    try {
      const pendingJobs = await this.db('bling_jobs')
        .whereIn('status', ['queued', 'running'])
        .select('*');

      for (const jobRecord of pendingJobs) {
        const job = {
          id: jobRecord.job_id,
          type: jobRecord.job_type,
          data: JSON.parse(jobRecord.data),
          options: JSON.parse(jobRecord.options),
          status: 'queued', // Reset running jobs to queued
          progress: 0,
          createdAt: jobRecord.created_at,
          tenantId: jobRecord.tenant_id,
          retryCount: jobRecord.retry_count || 0
        };

        this.insertJobInQueue(job);

        // Update status in database
        await this.updateJobStatus(job.id, 'queued');
      }

      this.logger.info('Recovered pending jobs', {
        count: pendingJobs.length
      });

    } catch (error) {
      this.logger.error('Failed to recover pending jobs', {
        error: error.message
      });
    }
  }

  scheduleMaintenanceTasks() {
    // Cleanup old jobs every hour
    setInterval(async () => {
      try {
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const result = await this.db('bling_jobs')
          .where('created_at', '<', cutoffDate)
          .whereIn('status', ['completed', 'failed'])
          .del();

        if (result > 0) {
          this.logger.info('Cleaned up old jobs', {
            deletedCount: result
          });
        }

      } catch (error) {
        this.logger.error('Job cleanup failed', {
          error: error.message
        });
      }
    }, this.config.cleanupInterval);
  }

  // Event listeners
  onJobQueued(job) {
    this.logger.debug('Job queued', {
      jobId: job.id,
      jobType: job.type,
      tenantId: job.tenantId
    });
  }

  onJobStarted(job) {
    this.logger.info('Job started', {
      jobId: job.id,
      jobType: job.type,
      tenantId: job.tenantId
    });
  }

  onJobProgress({ job, progress, message }) {
    this.logger.debug('Job progress updated', {
      jobId: job.id,
      progress,
      message
    });
  }

  onJobCompleted({ job, result, processingTime }) {
    this.logger.info('Job completed', {
      jobId: job.id,
      jobType: job.type,
      tenantId: job.tenantId,
      processingTime
    });
  }

  onJobFailed({ job, error, processingTime }) {
    this.logger.error('Job failed', {
      jobId: job.id,
      jobType: job.type,
      tenantId: job.tenantId,
      error: error.message,
      processingTime
    });
  }

  /**
   * Public API methods
   */

  async getJobStatus(jobId) {
    const job = this.state.activeJobs.get(jobId);
    
    if (job) {
      return {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progressMessage,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        estimatedCompletion: this.estimateCompletion(job)
      };
    }

    // Check database for completed/failed jobs
    const jobRecord = await this.db('bling_jobs')
      .where('job_id', jobId)
      .first();

    if (jobRecord) {
      return {
        id: jobRecord.job_id,
        type: jobRecord.job_type,
        status: jobRecord.status,
        progress: jobRecord.progress,
        createdAt: jobRecord.created_at,
        completedAt: jobRecord.completed_at,
        failedAt: jobRecord.failed_at,
        error: jobRecord.error_message,
        result: jobRecord.result ? JSON.parse(jobRecord.result) : null
      };
    }

    throw new Error(`Job not found: ${jobId}`);
  }

  getManagerStatistics() {
    return {
      ...this.state,
      queueLength: this.state.jobQueue.length,
      supportedJobTypes: Array.from(this.jobTypes.keys()),
      averageProcessingTime: this.state.completedJobs > 0 
        ? this.state.totalProcessingTime / this.state.completedJobs 
        : 0
    };
  }

  async getJobHistory(tenantId = null, limit = 50) {
    let query = this.db('bling_jobs')
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (tenantId) {
      query = query.where('tenant_id', tenantId);
    }

    return await query.select('*');
  }

  estimateCompletion(job) {
    if (job.progress === 0) {
      return null;
    }

    const elapsed = Date.now() - job.startedAt.getTime();
    const estimatedTotal = (elapsed / job.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    return new Date(Date.now() + remaining);
  }

  async markJobAsFailed(jobId, reason) {
    const job = this.state.activeJobs.get(jobId);
    if (job) {
      await this.failJob(job, new Error(reason));
    }
  }

  // Placeholder methods for specific implementations
  async processBulkImportItem(tenantId, importType, item) {
    // Implementation would depend on import type
    throw new Error('Bulk import not implemented yet');
  }

  async cleanupOldSyncRecords(tenantId) {
    // Implementation for cleaning up old sync records
    return 0;
  }

  async cleanupFailedWebhooks(tenantId) {
    // Implementation for cleaning up failed webhooks
    return 0;
  }

  async cleanupExpiredTokens(tenantId) {
    // Implementation for cleaning up expired tokens
    return 0;
  }

  async replayWebhook(webhook) {
    // Implementation for replaying failed webhooks
    throw new Error('Webhook replay not implemented yet');
  }
}

module.exports = BlingJobManager;