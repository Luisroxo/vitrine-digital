/**
 * @fileoverview Advanced Analytics API Routes
 * @version 1.0.0
 * @description Rotas da API para analytics avançado e business intelligence
 * com métricas consolidadas, relatórios customizados e dashboards
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for analytics operations
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Analytics API rate limit exceeded'
});

// Error handler
const handleError = (res, error, message = 'Analytics operation failed') => {
  console.error(`Advanced Analytics API Error: ${message}`, error);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

// Middleware to get analytics service
const getAnalyticsService = (req, res, next) => {
  const analyticsService = req.app.locals.advancedAnalyticsService;
  if (!analyticsService || !analyticsService.state.isInitialized) {
    return res.status(503).json({
      success: false,
      message: 'Advanced Analytics Service not available'
    });
  }
  req.analyticsService = analyticsService;
  next();
};

/**
 * @route GET /api/shared/analytics/status
 * @desc Get analytics service status
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, getAnalyticsService, (req, res) => {
  try {
    const status = req.analyticsService.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get analytics status');
  }
});

/**
 * @route GET /api/shared/analytics/dashboard
 * @desc Get comprehensive dashboard data
 * @access Private (Admin)
 */
router.get('/dashboard', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { tenantId, timeRange = '7d' } = req.query;
    
    // Use tenant from token if not provided
    const targetTenantId = tenantId || req.user?.tenantId;
    
    if (!targetTenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const dashboardData = await req.analyticsService.getDashboardData(targetTenantId, timeRange);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get dashboard data');
  }
});

/**
 * @route GET /api/shared/analytics/business-metrics
 * @desc Get business metrics summary
 * @access Private (Admin)
 */
router.get('/business-metrics', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { 
      tenantId, 
      startDate, 
      endDate, 
      timeRange = '30d',
      metrics = 'all' 
    } = req.query;
    
    const targetTenantId = tenantId || req.user?.tenantId;
    
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = req.analyticsService.calculateTimeRange(timeRange);
    }

    const businessMetrics = await req.analyticsService.getBusinessMetricsSummary(
      targetTenantId, 
      dateRange.startDate, 
      dateRange.endDate,
      metrics
    );
    
    res.json({
      success: true,
      data: {
        metrics: businessMetrics,
        timeRange: dateRange,
        requestedMetrics: metrics
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get business metrics');
  }
});

/**
 * @route GET /api/shared/analytics/performance-metrics
 * @desc Get performance metrics summary
 * @access Private (Admin)
 */
router.get('/performance-metrics', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { 
      service, 
      startDate, 
      endDate, 
      timeRange = '24h',
      aggregation = 'avg'
    } = req.query;
    
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = req.analyticsService.calculateTimeRange(timeRange);
    }

    const performanceMetrics = await req.analyticsService.getPerformanceMetricsSummary(
      dateRange.startDate,
      dateRange.endDate,
      service,
      aggregation
    );
    
    res.json({
      success: true,
      data: {
        metrics: performanceMetrics,
        timeRange: dateRange,
        service: service || 'all',
        aggregation
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get performance metrics');
  }
});

/**
 * @route GET /api/shared/analytics/realtime-metrics
 * @desc Get real-time metrics
 * @access Private (Admin)
 */
router.get('/realtime-metrics', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { tenantId, service, limit = 100 } = req.query;
    
    const targetTenantId = tenantId || req.user?.tenantId;
    
    const realTimeMetrics = await req.analyticsService.getRealTimeMetricsSummary(
      targetTenantId,
      service,
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: realTimeMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get real-time metrics');
  }
});

/**
 * @route GET /api/shared/analytics/trends
 * @desc Get trends data and analysis
 * @access Private (Admin)
 */
router.get('/trends', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { 
      tenantId, 
      metric, 
      timeRange = '30d',
      granularity = 'daily'
    } = req.query;
    
    const targetTenantId = tenantId || req.user?.tenantId;
    const dateRange = req.analyticsService.calculateTimeRange(timeRange);
    
    const trendsData = await req.analyticsService.getTrendsData(
      targetTenantId,
      dateRange.startDate,
      dateRange.endDate,
      metric,
      granularity
    );
    
    res.json({
      success: true,
      data: {
        trends: trendsData,
        metric: metric || 'all',
        timeRange: dateRange,
        granularity
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get trends data');
  }
});

/**
 * @route GET /api/shared/analytics/top-metrics
 * @desc Get top performing metrics
 * @access Private (Admin)
 */
router.get('/top-metrics', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { 
      tenantId, 
      category, 
      timeRange = '30d',
      limit = 10
    } = req.query;
    
    const targetTenantId = tenantId || req.user?.tenantId;
    const dateRange = req.analyticsService.calculateTimeRange(timeRange);
    
    const topMetrics = await req.analyticsService.getTopMetrics(
      targetTenantId,
      dateRange.startDate,
      dateRange.endDate,
      category,
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: topMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get top metrics');
  }
});

/**
 * @route GET /api/shared/analytics/reports
 * @desc Get list of custom reports
 * @access Private (Admin)
 */
router.get('/reports', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const { tenantId, reportType } = req.query;
    const targetTenantId = tenantId || req.user?.tenantId;
    
    let query = req.analyticsService.db('analytics_custom_reports')
      .where('is_active', true)
      .orderBy('created_at', 'desc');
    
    if (targetTenantId) {
      query = query.where('tenant_id', targetTenantId);
    }
    
    if (reportType) {
      query = query.where('report_type', reportType);
    }
    
    const reports = await query.select(
      'id', 'report_name', 'report_type', 'schedule_config', 
      'output_format', 'created_at', 'updated_at'
    );
    
    res.json({
      success: true,
      data: reports,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get reports list');
  }
});

/**
 * @route POST /api/shared/analytics/reports/:reportId/generate
 * @desc Generate a custom report
 * @access Private (Admin)
 */
router.post('/reports/:reportId/generate', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { parameters = {} } = req.body;
    
    const reportData = await req.analyticsService.generateCustomReport(reportId, parameters);
    
    res.json({
      success: true,
      data: reportData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to generate custom report');
  }
});

/**
 * @route POST /api/shared/analytics/reports
 * @desc Create a new custom report
 * @access Private (Admin)
 */
router.post('/reports', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const {
      reportName,
      reportType,
      queryDefinition,
      scheduleConfig,
      outputFormat = 'json'
    } = req.body;
    
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!reportName || !reportType || !queryDefinition) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: reportName, reportType, queryDefinition'
      });
    }
    
    const [reportId] = await req.analyticsService.db('analytics_custom_reports').insert({
      tenant_id: tenantId,
      report_name: reportName,
      report_type: reportType,
      query_definition: JSON.stringify(queryDefinition),
      schedule_config: scheduleConfig ? JSON.stringify(scheduleConfig) : null,
      output_format: outputFormat,
      created_by: userId
    }).returning('id');
    
    res.status(201).json({
      success: true,
      data: { id: reportId },
      message: 'Custom report created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to create custom report');
  }
});

/**
 * @route GET /api/shared/analytics/dashboards
 * @desc Get list of analytics dashboards
 * @access Private (Admin)
 */
router.get('/dashboards', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const targetTenantId = tenantId || req.user?.tenantId;
    
    let query = req.analyticsService.db('analytics_dashboards')
      .orderBy('created_at', 'desc');
    
    if (targetTenantId) {
      query = query.where('tenant_id', targetTenantId);
    }
    
    const dashboards = await query.select(
      'id', 'dashboard_name', 'is_public', 'created_at', 'updated_at'
    );
    
    res.json({
      success: true,
      data: dashboards,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get dashboards list');
  }
});

/**
 * @route GET /api/shared/analytics/dashboards/:dashboardId
 * @desc Get specific dashboard configuration
 * @access Private (Admin)
 */
router.get('/dashboards/:dashboardId', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const { dashboardId } = req.params;
    
    const dashboard = await req.analyticsService.db('analytics_dashboards')
      .where('id', dashboardId)
      .first();
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get dashboard configuration');
  }
});

/**
 * @route POST /api/shared/analytics/dashboards
 * @desc Create a new analytics dashboard
 * @access Private (Admin)
 */
router.post('/dashboards', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const {
      dashboardName,
      dashboardConfig,
      widgets,
      filters,
      permissions,
      isPublic = false
    } = req.body;
    
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!dashboardName || !dashboardConfig || !widgets) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: dashboardName, dashboardConfig, widgets'
      });
    }
    
    const [dashboardId] = await req.analyticsService.db('analytics_dashboards').insert({
      tenant_id: tenantId,
      dashboard_name: dashboardName,
      dashboard_config: JSON.stringify(dashboardConfig),
      widgets: JSON.stringify(widgets),
      filters: filters ? JSON.stringify(filters) : null,
      permissions: permissions ? JSON.stringify(permissions) : null,
      is_public: isPublic,
      created_by: userId
    }).returning('id');
    
    res.status(201).json({
      success: true,
      data: { id: dashboardId },
      message: 'Analytics dashboard created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to create analytics dashboard');
  }
});

/**
 * @route POST /api/shared/analytics/collect-metrics
 * @desc Manually trigger metrics collection
 * @access Private (Admin)
 */
router.post('/collect-metrics', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const { type = 'realtime' } = req.body;
    
    if (type === 'realtime') {
      await req.analyticsService.collectRealTimeMetrics();
    } else if (type === 'business') {
      await req.analyticsService.collectBusinessMetrics();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid metrics type. Use "realtime" or "business"'
      });
    }
    
    res.json({
      success: true,
      message: `${type} metrics collection triggered successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to trigger metrics collection');
  }
});

/**
 * @route GET /api/shared/analytics/export
 * @desc Export analytics data
 * @access Private (Admin)
 */
router.get('/export', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const {
      tenantId,
      dataType,
      format = 'json',
      startDate,
      endDate,
      timeRange = '30d'
    } = req.query;
    
    const targetTenantId = tenantId || req.user?.tenantId;
    
    let dateRange;
    if (startDate && endDate) {
      dateRange = { startDate, endDate };
    } else {
      dateRange = req.analyticsService.calculateTimeRange(timeRange);
    }

    const exportData = await req.analyticsService.exportAnalyticsData(
      targetTenantId,
      dataType,
      dateRange.startDate,
      dateRange.endDate
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${dataType}-${Date.now()}.csv`);
      
      const csv = convertToCSV(exportData);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${dataType}-${Date.now()}.json`);
      res.json(exportData);
    }
  } catch (error) {
    handleError(res, error, 'Failed to export analytics data');
  }
});

/**
 * @route PUT /api/shared/analytics/config
 * @desc Update analytics configuration
 * @access Private (Admin)
 */
router.put('/config', authenticateToken, getAnalyticsService, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration data is required'
      });
    }
    
    // Update service configuration
    Object.assign(req.analyticsService.config, config);
    
    res.json({
      success: true,
      data: req.analyticsService.config,
      message: 'Analytics configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to update analytics configuration');
  }
});

// Utility function to convert JSON to CSV
function convertToCSV(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value}"` : value;
    }).join(','))
  ];
  
  return csvRows.join('\n');
}

/**
 * @route POST /api/shared/analytics/predictive/forecast
 * @desc Generate predictive forecast for a metric
 * @access Private (Admin)
 */
router.post('/predictive/forecast', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { metricName, horizon, modelType, lookbackDays } = req.body;
    
    if (!metricName) {
      return res.status(400).json({
        success: false,
        message: 'metricName is required'
      });
    }

    const forecast = await req.analyticsService.generatePredictiveForecast(metricName, horizon, {
      modelType,
      lookbackDays
    });

    res.json({
      success: true,
      data: forecast,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to generate predictive forecast');
  }
});

/**
 * @route POST /api/shared/analytics/predictive/anomalies
 * @desc Detect anomalies in metric data
 * @access Private (Admin)
 */
router.post('/predictive/anomalies', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { metricName, recentHours, baselineDays } = req.body;
    
    if (!metricName) {
      return res.status(400).json({
        success: false,
        message: 'metricName is required'
      });
    }

    const anomalies = await req.analyticsService.detectAnomalies(metricName, {
      recentHours,
      baselineDays
    });

    res.json({
      success: true,
      data: {
        metricName,
        anomalies,
        detectedCount: anomalies.length,
        detectedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to detect anomalies');
  }
});

/**
 * @route POST /api/shared/analytics/predictive/trends
 * @desc Analyze trends for a metric
 * @access Private (Admin)
 */
router.post('/predictive/trends', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { metricName, analysisDays, timeWindow } = req.body;
    
    if (!metricName) {
      return res.status(400).json({
        success: false,
        message: 'metricName is required'
      });
    }

    const trendAnalysis = await req.analyticsService.analyzeTrends(metricName, {
      analysisDays,
      timeWindow
    });

    res.json({
      success: true,
      data: trendAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to analyze trends');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/revenue-forecast
 * @desc Generate revenue forecast with multiple scenarios
 * @access Private (Admin)
 */
router.get('/predictive/revenue-forecast', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { marketFactors } = req.query;
    
    const marketFactorsObj = marketFactors ? JSON.parse(marketFactors) : {};
    
    const forecast = await req.analyticsService.generateRevenueForecast({
      marketFactors: marketFactorsObj
    });

    res.json({
      success: true,
      data: forecast,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to generate revenue forecast');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/churn-prediction
 * @desc Predict customer churn
 * @access Private (Admin)
 */
router.get('/predictive/churn-prediction', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { customerId } = req.query;
    
    const churnAnalysis = await req.analyticsService.predictCustomerChurn({
      customerId
    });

    res.json({
      success: true,
      data: churnAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to predict customer churn');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/pricing-optimization
 * @desc Optimize pricing using ML
 * @access Private (Admin)
 */
router.get('/predictive/pricing-optimization', authenticateToken, analyticsLimiter, getAnalyticsService, async (req, res) => {
  try {
    const { productIds } = req.query;
    
    const productIdsArray = productIds ? productIds.split(',') : undefined;
    
    const pricingOptimization = await req.analyticsService.optimizePricing({
      productIds: productIdsArray
    });

    res.json({
      success: true,
      data: pricingOptimization,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to optimize pricing');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/models
 * @desc Get information about trained ML models
 * @access Private (Admin)
 */
router.get('/predictive/models', authenticateToken, getAnalyticsService, (req, res) => {
  try {
    const modelsInfo = [];
    
    for (const [metricName, modelInfo] of req.analyticsService.engines.predictive.models.entries()) {
      modelsInfo.push({
        metricName,
        modelType: modelInfo.type,
        accuracy: modelInfo.accuracy,
        trainedAt: modelInfo.trainedAt,
        dataPoints: modelInfo.dataPoints
      });
    }

    res.json({
      success: true,
      data: {
        totalModels: modelsInfo.length,
        models: modelsInfo
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get ML models information');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/predictions/:metricName
 * @desc Get stored predictions for a metric
 * @access Private (Admin)
 */
router.get('/predictive/predictions/:metricName', authenticateToken, getAnalyticsService, (req, res) => {
  try {
    const { metricName } = req.params;
    const predictions = req.analyticsService.engines.predictive.predictions.get(metricName);
    
    if (!predictions) {
      return res.status(404).json({
        success: false,
        message: `No predictions found for metric: ${metricName}`
      });
    }

    res.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get predictions');
  }
});

/**
 * @route GET /api/shared/analytics/predictive/anomalies
 * @desc Get recent anomalies detected
 * @access Private (Admin)
 */
router.get('/predictive/anomalies', authenticateToken, getAnalyticsService, (req, res) => {
  try {
    const { limit = 50, severity } = req.query;
    
    let anomalies = req.analyticsService.engines.predictive.anomalies;
    
    // Filter by severity if specified
    if (severity) {
      anomalies = anomalies.filter(a => a.severity === severity);
    }
    
    // Limit results
    anomalies = anomalies.slice(-parseInt(limit));

    res.json({
      success: true,
      data: {
        anomalies,
        totalCount: anomalies.length,
        filters: { severity, limit }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to get anomalies');
  }
});

// Health check endpoint for analytics service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'advanced-analytics',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;