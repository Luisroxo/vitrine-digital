/**
 * @fileoverview System Health API Routes
 * @version 1.0.0  
 * @description Rotas da API para o dashboard de saúde do sistema
 * Fornece endpoints para monitoramento consolidado de todos os microserviços
 */

const express = require('express');
const router = express.Router();
const SystemHealthDashboard = require('../../shared/services/SystemHealthDashboard');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Initialize System Health Dashboard
const healthDashboard = new SystemHealthDashboard({
  checkInterval: process.env.HEALTH_CHECK_INTERVAL || 60000,
  services: {
    'auth-service': {
      name: 'Authentication Service',
      url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      healthEndpoint: '/health',
      category: 'core',
      critical: true,
      checks: ['database', 'redis', 'api']
    },
    'billing-service': {
      name: 'Billing Service', 
      url: process.env.BILLING_SERVICE_URL || 'http://billing-service:3002',
      healthEndpoint: '/health',
      category: 'business',
      critical: true,
      checks: ['database', 'payment_gateway', 'api']
    },
    'bling-service': {
      name: 'Bling Integration Service',
      url: process.env.BLING_SERVICE_URL || 'http://bling-service:3003', 
      healthEndpoint: '/health',
      category: 'integration',
      critical: true,
      checks: ['database', 'bling_api', 'api']
    },
    'product-service': {
      name: 'Product Service',
      url: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3004',
      healthEndpoint: '/health', 
      category: 'business',
      critical: false,
      checks: ['database', 'cdn', 'api']
    },
    'gateway': {
      name: 'API Gateway',
      url: 'http://localhost:3000',
      healthEndpoint: '/health',
      category: 'core',
      critical: true,
      checks: ['redis', 'services', 'api']
    }
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  }
});

// Rate limiting for system health endpoints
const systemHealthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'System health check rate limit exceeded'
});

// Error handler middleware
const handleError = (res, error, message = 'System health operation failed') => {
  console.error(`System Health API Error: ${message}`, error);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

// Start health monitoring when routes are loaded
healthDashboard.start();

/**
 * @route GET /api/shared/system/dashboard
 * @desc Get complete system health dashboard data
 * @access Private (Admin)
 */
router.get('/dashboard', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const dashboardData = await healthDashboard.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch system dashboard data');
  }
});

/**
 * @route GET /api/shared/system/status
 * @desc Get system overall status summary 
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const systemStatus = await healthDashboard.getSystemStatus();
    
    res.json({
      success: true,
      data: systemStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch system status');
  }
});

/**
 * @route GET /api/shared/system/services
 * @desc Get all services health status
 * @access Private (Admin)
 */
router.get('/services', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const servicesData = await healthDashboard.getAllServicesStatus();
    
    res.json({
      success: true,
      data: servicesData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch services status');
  }
});

/**
 * @route GET /api/shared/system/services/:serviceId
 * @desc Get specific service health details
 * @access Private (Admin)
 */
router.get('/services/:serviceId', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const serviceData = await healthDashboard.getServiceStatus(serviceId);
    
    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      data: serviceData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch service details');
  }
});

/**
 * @route POST /api/shared/system/services/:serviceId/check
 * @desc Trigger immediate health check for specific service
 * @access Private (Admin)
 */
router.post('/services/:serviceId/check', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const result = await healthDashboard.checkServiceHealth(serviceId);
    
    res.json({
      success: true,
      data: result,
      message: 'Service health check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to check service health');
  }
});

/**
 * @route POST /api/shared/system/check-all
 * @desc Trigger immediate health check for all services
 * @access Private (Admin)
 */
router.post('/check-all', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const results = await healthDashboard.checkAllServices();
    
    res.json({
      success: true,
      data: results,
      message: 'All services health check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to check all services health');
  }
});

/**
 * @route GET /api/shared/system/performance
 * @desc Get system performance metrics and trends
 * @access Private (Admin)
 */
router.get('/performance', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const performanceData = await healthDashboard.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: performanceData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch performance metrics');
  }
});

/**
 * @route GET /api/shared/system/alerts
 * @desc Get system alerts and notifications
 * @access Private (Admin) 
 */
router.get('/alerts', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const { severity, service, limit = 100 } = req.query;
    
    const filters = {};
    if (severity) filters.severity = severity;
    if (service) filters.service = service;
    
    const alerts = await healthDashboard.getSystemAlerts(filters, parseInt(limit));
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch system alerts');
  }
});

/**
 * @route GET /api/shared/system/history/:serviceId
 * @desc Get service health history
 * @access Private (Admin)
 */
router.get('/history/:serviceId', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { hours = 24 } = req.query;
    
    const history = await healthDashboard.getServiceHistory(serviceId, parseInt(hours));
    
    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch service history');
  }
});

/**
 * @route GET /api/shared/system/categories
 * @desc Get services grouped by category with status
 * @access Private (Admin)
 */
router.get('/categories', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const categorizedServices = await healthDashboard.getServicesByCategory();
    
    res.json({
      success: true,
      data: categorizedServices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch categorized services');
  }
});

/**
 * @route PUT /api/shared/system/config
 * @desc Update system health monitoring configuration
 * @access Private (Admin)
 */
router.put('/config', authenticateToken, async (req, res) => {
  try {
    const { checkInterval, alertThresholds, services } = req.body;
    
    const updatedConfig = await healthDashboard.updateConfiguration({
      checkInterval,
      alertThresholds,
      services
    });
    
    res.json({
      success: true,
      data: updatedConfig,
      message: 'System health configuration updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to update system configuration');
  }
});

/**
 * @route GET /api/shared/system/trends
 * @desc Get system health trends and analytics
 * @access Private (Admin)
 */
router.get('/trends', authenticateToken, systemHealthLimiter, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    const trends = await healthDashboard.getSystemTrends(period);
    
    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch system trends');
  }
});

/**
 * @route GET /api/shared/system/export
 * @desc Export system health data for analysis
 * @access Private (Admin)
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'json', period = '7d' } = req.query;
    
    const exportData = await healthDashboard.exportHealthData(period);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=system-health-${Date.now()}.csv`);
      
      // Convert to CSV format
      const csv = convertToCSV(exportData);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=system-health-${Date.now()}.json`);
      res.json(exportData);
    }
  } catch (error) {
    handleError(res, error, 'Failed to export system health data');
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

// Health check endpoint for the system health service itself
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'system-health-dashboard',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('Shutting down System Health Dashboard...');
  if (healthDashboard && typeof healthDashboard.stop === 'function') {
    healthDashboard.stop();
  }
});

module.exports = router;