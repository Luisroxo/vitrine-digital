/**
 * @fileoverview Enhanced Bling Price Sync API Routes
 * @version 2.0.0
 * @description Rotas da API para sincronização avançada de preços do Bling ERP
 * com suporte a bulk operations, pricing rules e analytics
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for price sync operations
const priceSyncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  message: 'Price sync rate limit exceeded'
});

// Error handler
const handleError = (res, error, message = 'Price sync operation failed') => {
  console.error(`Enhanced Price Sync API Error: ${message}`, error);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

// Middleware to get price sync service
const getPriceSyncService = (req, res, next) => {
  const priceSyncService = req.app.locals.enhancedPriceSyncService;
  if (!priceSyncService || !priceSyncService.state.isInitialized) {
    return res.status(503).json({
      success: false,
      message: 'Enhanced Price Sync Service not available'
    });
  }
  req.priceSyncService = priceSyncService;
  next();
};

/**
 * @route GET /api/bling/price-sync/status
 * @desc Get enhanced price sync service status
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, getPriceSyncService, (req, res) => {
  try {
    const status = req.priceSyncService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price sync status');
  }
});

/**
 * @route POST /api/bling/price-sync/trigger/realtime
 * @desc Trigger immediate real-time price sync
 * @access Private (Admin)
 */
router.post('/trigger/realtime', authenticateToken, priceSyncLimiter, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (tenantId) {
      // Sync specific tenant
      await req.priceSyncService.syncTenantPricesRealTime(tenantId);
      
      res.json({
        success: true,
        message: `Real-time price sync triggered for tenant ${tenantId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Trigger full real-time sync
      await req.priceSyncService.performRealTimeSync();
      
      res.json({
        success: true,
        message: 'Real-time price sync triggered for all tenants',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    handleError(res, error, 'Failed to trigger real-time price sync');
  }
});

/**
 * @route POST /api/bling/price-sync/trigger/bulk
 * @desc Trigger bulk price sync
 * @access Private (Admin)
 */
router.post('/trigger/bulk', authenticateToken, priceSyncLimiter, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (tenantId) {
      // Create job for specific tenant
      const jobId = await req.priceSyncService.createSyncJob(tenantId, 'bulk');
      await req.priceSyncService.syncTenantPricesBulk(tenantId, jobId);
      
      res.json({
        success: true,
        message: `Bulk price sync triggered for tenant ${tenantId}`,
        jobId,
        timestamp: new Date().toISOString()
      });
    } else {
      // Trigger full bulk sync
      await req.priceSyncService.performBulkSync();
      
      res.json({
        success: true,
        message: 'Bulk price sync triggered for all tenants',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    handleError(res, error, 'Failed to trigger bulk price sync');
  }
});

/**
 * @route POST /api/bling/price-sync/trigger/incremental
 * @desc Trigger incremental price sync
 * @access Private (Admin)
 */
router.post('/trigger/incremental', authenticateToken, priceSyncLimiter, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (tenantId) {
      // Sync specific tenant incrementally
      await req.priceSyncService.syncTenantPricesIncremental(tenantId);
      
      res.json({
        success: true,
        message: `Incremental price sync triggered for tenant ${tenantId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Trigger full incremental sync
      await req.priceSyncService.performIncrementalSync();
      
      res.json({
        success: true,
        message: 'Incremental price sync triggered for all tenants',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    handleError(res, error, 'Failed to trigger incremental price sync');
  }
});

/**
 * @route GET /api/bling/price-sync/jobs
 * @desc Get price sync jobs history
 * @access Private (Admin)
 */
router.get('/jobs', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId, status, limit = 50, offset = 0 } = req.query;
    
    let query = req.priceSyncService.db('bling_price_sync_jobs')
      .orderBy('start_time', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    
    if (tenantId) {
      query = query.where('tenant_id', tenantId);
    }
    
    if (status) {
      query = query.where('job_status', status);
    }
    
    const jobs = await query;
    
    res.json({
      success: true,
      data: jobs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: jobs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price sync jobs');
  }
});

/**
 * @route GET /api/bling/price-sync/jobs/:jobId
 * @desc Get specific price sync job details
 * @access Private (Admin)
 */
router.get('/jobs/:jobId', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await req.priceSyncService.db('bling_price_sync_jobs')
      .where('id', jobId)
      .first();
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Price sync job not found'
      });
    }
    
    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price sync job details');
  }
});

/**
 * @route GET /api/bling/price-sync/history
 * @desc Get price change history
 * @access Private (Admin)
 */
router.get('/history', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { 
      tenantId, 
      productId, 
      syncType, 
      startDate, 
      endDate, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    let query = req.priceSyncService.db('bling_price_history')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));
    
    if (tenantId) query = query.where('tenant_id', tenantId);
    if (productId) query = query.where('product_id', productId);
    if (syncType) query = query.where('sync_type', syncType);
    if (startDate) query = query.where('created_at', '>=', startDate);
    if (endDate) query = query.where('created_at', '<=', endDate);
    
    const history = await query;
    
    res.json({
      success: true,
      data: history,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price history');
  }
});

/**
 * @route GET /api/bling/price-sync/analytics
 * @desc Get price sync analytics
 * @access Private (Admin)
 */
router.get('/analytics', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId, startDate, endDate, period = '7d' } = req.query;
    
    let query = req.priceSyncService.db('bling_price_analytics')
      .orderBy('analysis_date', 'desc');
    
    if (tenantId) {
      query = query.where('tenant_id', tenantId);
    }
    
    // Apply date filters
    if (startDate && endDate) {
      query = query.whereBetween('analysis_date', [startDate, endDate]);
    } else {
      // Default period filtering
      const days = parseInt(period.replace('d', ''));
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      query = query.where('analysis_date', '>=', fromDate.toISOString().split('T')[0]);
    }
    
    const analytics = await query;
    
    // Calculate aggregated metrics
    const aggregated = {
      totalProducts: analytics.reduce((sum, a) => sum + (a.total_products || 0), 0),
      totalPriceChanges: analytics.reduce((sum, a) => sum + (a.products_with_price_changes || 0), 0),
      averagePriceChangePercent: analytics.length > 0 
        ? analytics.reduce((sum, a) => sum + (a.average_price_change_percent || 0), 0) / analytics.length 
        : 0,
      totalPriceIncreases: analytics.reduce((sum, a) => sum + (a.total_price_increase_amount || 0), 0),
      totalPriceDecreases: analytics.reduce((sum, a) => sum + Math.abs(a.total_price_decrease_amount || 0), 0)
    };
    
    res.json({
      success: true,
      data: {
        analytics,
        aggregated,
        period,
        recordCount: analytics.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price analytics');
  }
});

/**
 * @route GET /api/bling/price-sync/rules
 * @desc Get pricing rules
 * @access Private (Admin)
 */
router.get('/rules', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { tenantId, ruleType, isActive } = req.query;
    
    let query = req.priceSyncService.db('bling_pricing_rules')
      .orderBy('priority', 'desc');
    
    if (tenantId) query = query.where('tenant_id', tenantId);
    if (ruleType) query = query.where('rule_type', ruleType);
    if (isActive !== undefined) query = query.where('is_active', isActive === 'true');
    
    const rules = await query;
    
    res.json({
      success: true,
      data: rules,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get pricing rules');
  }
});

/**
 * @route POST /api/bling/price-sync/rules
 * @desc Create new pricing rule
 * @access Private (Admin)
 */
router.post('/rules', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { 
      tenantId, 
      ruleName, 
      ruleType, 
      conditions, 
      actions, 
      priority = 0,
      isActive = true 
    } = req.body;
    
    // Validate required fields
    if (!tenantId || !ruleName || !ruleType || !conditions || !actions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, ruleName, ruleType, conditions, actions'
      });
    }
    
    const [ruleId] = await req.priceSyncService.db('bling_pricing_rules').insert({
      tenant_id: tenantId,
      rule_name: ruleName,
      rule_type: ruleType,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      priority,
      is_active: isActive
    }).returning('id');
    
    // Reload pricing rules
    await req.priceSyncService.loadPricingRules();
    
    res.status(201).json({
      success: true,
      data: { id: ruleId },
      message: 'Pricing rule created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to create pricing rule');
  }
});

/**
 * @route PUT /api/bling/price-sync/rules/:ruleId
 * @desc Update pricing rule
 * @access Private (Admin)
 */
router.put('/rules/:ruleId', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updateData = { ...req.body };
    
    // Convert JSON fields
    if (updateData.conditions) {
      updateData.conditions = JSON.stringify(updateData.conditions);
    }
    if (updateData.actions) {
      updateData.actions = JSON.stringify(updateData.actions);
    }
    
    updateData.updated_at = new Date();
    
    const updated = await req.priceSyncService.db('bling_pricing_rules')
      .where('id', ruleId)
      .update(updateData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found'
      });
    }
    
    // Reload pricing rules
    await req.priceSyncService.loadPricingRules();
    
    res.json({
      success: true,
      message: 'Pricing rule updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to update pricing rule');
  }
});

/**
 * @route DELETE /api/bling/price-sync/rules/:ruleId
 * @desc Delete pricing rule
 * @access Private (Admin)
 */
router.delete('/rules/:ruleId', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const deleted = await req.priceSyncService.db('bling_pricing_rules')
      .where('id', ruleId)
      .del();
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found'
      });
    }
    
    // Reload pricing rules
    await req.priceSyncService.loadPricingRules();
    
    res.json({
      success: true,
      message: 'Pricing rule deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete pricing rule');
  }
});

/**
 * @route PUT /api/bling/price-sync/config
 * @desc Update price sync configuration
 * @access Private (Admin)
 */
router.put('/config', authenticateToken, getPriceSyncService, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration data is required'
      });
    }
    
    // Update service configuration
    Object.assign(req.priceSyncService.config, config);
    
    res.json({
      success: true,
      data: req.priceSyncService.config,
      message: 'Price sync configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to update price sync configuration');
  }
});

/**
 * @route GET /api/bling/price-sync/metrics
 * @desc Get price sync performance metrics
 * @access Private (Admin)
 */
router.get('/metrics', authenticateToken, getPriceSyncService, (req, res) => {
  try {
    const metrics = req.priceSyncService.metrics;
    const status = req.priceSyncService.getStatus();
    
    res.json({
      success: true,
      data: {
        performance: metrics,
        currentState: {
          realTimeSyncRunning: status.realTimeSyncRunning,
          bulkSyncRunning: status.bulkSyncRunning,
          incrementalSyncRunning: status.incrementalSyncRunning,
          lastSyncs: {
            realTime: status.lastRealTimeSync,
            bulk: status.lastBulkSync,
            incremental: status.lastIncrementalSync
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get price sync metrics');
  }
});

module.exports = router;