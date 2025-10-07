/**
 * @fileoverview SLA Routes - RESTful API for SLA monitoring and management
 * @version 1.0.0
 * @description API endpoints para monitoramento SLA, alertas, métricas
 * e configuração de thresholds em tempo real
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize SLA routes
 */
function createSLARoutes(slaMonitor, notificationService) {
  
  /**
   * GET /sla/dashboard
   * Get comprehensive SLA dashboard data
   */
  router.get('/dashboard', async (req, res) => {
    try {
      const dashboardData = slaMonitor.getDashboardData();
      
      res.json({
        ...dashboardData,
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('SLA Dashboard fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch SLA dashboard data',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/metrics
   * Get current SLA metrics
   */
  router.get('/metrics', async (req, res) => {
    try {
      const metrics = slaMonitor.calculateSLA();
      
      res.json({
        service: slaMonitor.serviceName,
        metrics,
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('SLA Metrics fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch SLA metrics',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/alerts
   * Get active alerts
   */
  router.get('/alerts', async (req, res) => {
    try {
      const { status = 'active', limit = 50 } = req.query;
      
      const dashboardData = slaMonitor.getDashboardData();
      let alerts = [];
      
      if (status === 'active') {
        alerts = dashboardData.alerts.active;
      } else if (status === 'all') {
        alerts = dashboardData.alerts.recent;
      }
      
      // Apply limit
      alerts = alerts.slice(0, parseInt(limit));
      
      res.json({
        alerts,
        count: alerts.length,
        status,
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('Alerts fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
        message: error.message
      });
    }
  });

  /**
   * POST /sla/alerts/:alertId/resolve
   * Resolve an active alert
   */
  router.post('/alerts/:alertId/resolve', async (req, res) => {
    try {
      const { alertId } = req.params;
      const { resolution = 'manual_resolve' } = req.body;
      
      slaMonitor.resolveAlert(alertId, resolution);
      
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId,
        resolution,
        resolvedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Alert resolution failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert',
        message: error.message
      });
    }
  });

  /**
   * POST /sla/test-alert
   * Create a test alert for validation
   */
  router.post('/test-alert', async (req, res) => {
    try {
      const { level = 'warning', type = 'test' } = req.body;
      
      if (!['warning', 'critical', 'severe'].includes(level)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert level',
          validLevels: ['warning', 'critical', 'severe']
        });
      }

      const testData = {
        level,
        service: slaMonitor.serviceName,
        responseTime: level === 'critical' ? 5500 : level === 'severe' ? 8000 : 1500,
        threshold: level === 'critical' ? 5000 : level === 'severe' ? 3000 : 1000,
        message: `Test ${level} alert generated from dashboard`
      };

      await slaMonitor.triggerAlert(type, testData);
      
      res.json({
        success: true,
        message: 'Test alert created successfully',
        level,
        type,
        data: testData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Test alert creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create test alert',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/health
   * Get SLA monitor health status
   */
  router.get('/health', async (req, res) => {
    try {
      const healthResult = await slaMonitor.performHealthCheck();
      
      res.status(healthResult.status === 'healthy' ? 200 : 503).json({
        service: slaMonitor.serviceName,
        status: healthResult.status,
        details: healthResult.details,
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /sla/record-request
   * Manually record a request for SLA tracking
   */
  router.post('/record-request', async (req, res) => {
    try {
      const { responseTime, statusCode, error } = req.body;
      
      if (typeof responseTime !== 'number' || typeof statusCode !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'responseTime and statusCode are required numbers'
        });
      }

      slaMonitor.recordRequest(responseTime, statusCode, error);
      
      res.json({
        success: true,
        message: 'Request recorded successfully',
        data: { responseTime, statusCode, error },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Request recording failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record request',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/report
   * Generate SLA report
   */
  router.get('/report', async (req, res) => {
    try {
      const report = await slaMonitor.generatePeriodicReport();
      
      res.json({
        ...report,
        success: true
      });
      
    } catch (error) {
      console.error('Report generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate SLA report',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/config
   * Get current SLA configuration
   */
  router.get('/config', async (req, res) => {
    try {
      res.json({
        service: slaMonitor.serviceName,
        config: slaMonitor.config,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Config fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch configuration',
        message: error.message
      });
    }
  });

  /**
   * PUT /sla/config
   * Update SLA configuration (thresholds)
   */
  router.put('/config', async (req, res) => {
    try {
      const { responseTime, errorRate, uptime, intervals, alerts } = req.body;
      
      // Validate and update configuration
      if (responseTime) {
        Object.assign(slaMonitor.config.responseTime, responseTime);
      }
      
      if (errorRate) {
        Object.assign(slaMonitor.config.errorRate, errorRate);
      }
      
      if (uptime) {
        Object.assign(slaMonitor.config.uptime, uptime);
      }
      
      if (intervals) {
        Object.assign(slaMonitor.config.intervals, intervals);
      }
      
      if (alerts) {
        Object.assign(slaMonitor.config.alerts, alerts);
      }
      
      res.json({
        success: true,
        message: 'Configuration updated successfully',
        config: slaMonitor.config,
        updatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Config update failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/statistics
   * Get detailed SLA statistics
   */
  router.get('/statistics', async (req, res) => {
    try {
      const { period = '24h' } = req.query;
      
      const dashboardData = slaMonitor.getDashboardData();
      const stats = {
        period,
        service: slaMonitor.serviceName,
        current: dashboardData.sla,
        requests: dashboardData.requests,
        uptime: dashboardData.uptime,
        alerts: {
          active: dashboardData.alerts.active.length,
          total: dashboardData.alerts.recent.length,
          byLevel: {}
        },
        availability: {
          percentage: dashboardData.sla.uptime,
          target: slaMonitor.config.uptime.target,
          difference: dashboardData.sla.uptime - slaMonitor.config.uptime.target
        }
      };

      // Calculate alert distribution
      dashboardData.alerts.recent.forEach(alert => {
        stats.alerts.byLevel[alert.level] = (stats.alerts.byLevel[alert.level] || 0) + 1;
      });
      
      res.json({
        ...stats,
        generatedAt: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('Statistics generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate statistics',
        message: error.message
      });
    }
  });

  /**
   * POST /sla/test-notification
   * Test notification channels
   */
  router.post('/test-notification', async (req, res) => {
    try {
      if (!notificationService) {
        return res.status(503).json({
          success: false,
          error: 'Notification service not available'
        });
      }

      const testResults = await notificationService.testNotifications();
      
      res.json({
        success: true,
        message: 'Test notifications sent',
        results: testResults,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Test notification failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send test notifications',
        message: error.message
      });
    }
  });

  /**
   * GET /sla/uptime/:period
   * Get uptime data for specific period
   */
  router.get('/uptime/:period', async (req, res) => {
    try {
      const { period } = req.params; // 1h, 24h, 7d, 30d
      
      const dashboardData = slaMonitor.getDashboardData();
      
      // In a real implementation, this would query historical data
      const uptimeData = {
        period,
        current: dashboardData.sla.uptime,
        target: slaMonitor.config.uptime.target,
        downtimeEvents: dashboardData.uptime.downtimeEvents,
        totalDowntime: dashboardData.uptime.totalDowntime,
        status: dashboardData.status
      };
      
      res.json({
        ...uptimeData,
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('Uptime data fetch failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch uptime data',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createSLARoutes;