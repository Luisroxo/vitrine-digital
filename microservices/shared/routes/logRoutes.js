/**
 * @fileoverview Log Dashboard Routes - RESTful API for log management and visualization
 * @version 1.0.0
 * @description API endpoints para dashboard de logs, métricas em tempo real,
 * análise de padrões e exportação de relatórios
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize log dashboard routes
 */
function createLogRoutes(logService, requestLogger) {
  
  /**
   * GET /logs/dashboard
   * Get comprehensive dashboard data
   */
  router.get('/dashboard', async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h';
      
      const [dashboardData, requestMetrics] = await Promise.all([
        logService.getDashboardData(),
        requestLogger ? requestLogger.getRequestMetrics(timeframe) : null
      ]);

      const response = {
        service: dashboardData.service,
        timestamp: new Date().toISOString(),
        timeframe,
        overview: {
          totalLogs: dashboardData.metrics.totalLogs,
          errorCount: dashboardData.metrics.errorCount,
          warningCount: dashboardData.metrics.warningCount,
          lastActivity: dashboardData.metrics.lastActivity,
          health: dashboardData.health
        },
        metrics: dashboardData.metrics,
        recentLogs: dashboardData.recentLogs,
        statistics: {
          hourly: dashboardData.hourlyStats,
          daily: dashboardData.dailyStats
        },
        requests: requestMetrics,
        health: dashboardData.health
      };

      res.json(response);
      
      // Log dashboard access
      await logService.logBusinessEvent('dashboard_accessed', {
        timeframe,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

    } catch (error) {
      await logService.error('Dashboard data fetch failed', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/recent
   * Get recent logs with filtering
   */
  router.get('/recent', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 500);
      const level = req.query.level;
      const service = req.query.service;

      let logs = await logService.getRecentLogs(limit * 2); // Get more to allow filtering

      // Apply filters
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      
      if (service) {
        logs = logs.filter(log => log.service === service);
      }

      // Limit results
      logs = logs.slice(0, limit);

      res.json({
        logs,
        count: logs.length,
        filters: { level, service, limit },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await logService.error('Recent logs fetch failed', error);
      res.status(500).json({
        error: 'Failed to fetch recent logs',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/search
   * Search logs with advanced filters
   */
  router.get('/search', async (req, res) => {
    try {
      const {
        query,
        level,
        service,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      // Get recent logs (in a real implementation, this would query a log database)
      let logs = await logService.getRecentLogs(1000);

      // Apply search filters
      if (query) {
        const searchRegex = new RegExp(query, 'i');
        logs = logs.filter(log => 
          searchRegex.test(log.message) || 
          searchRegex.test(JSON.stringify(log.meta || {}))
        );
      }

      if (level) {
        logs = logs.filter(log => log.level === level);
      }

      if (service) {
        logs = logs.filter(log => log.service === service);
      }

      if (startDate) {
        const start = new Date(startDate);
        logs = logs.filter(log => new Date(log.timestamp) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        logs = logs.filter(log => new Date(log.timestamp) <= end);
      }

      // Apply pagination
      const total = logs.length;
      const paginatedLogs = logs.slice(offset, offset + parseInt(limit));

      res.json({
        logs: paginatedLogs,
        pagination: {
          total,
          offset: parseInt(offset),
          limit: parseInt(limit),
          hasMore: offset + parseInt(limit) < total
        },
        filters: { query, level, service, startDate, endDate },
        timestamp: new Date().toISOString()
      });

      // Log search activity
      await logService.logBusinessEvent('log_search', {
        query, level, service, results: total
      });

    } catch (error) {
      await logService.error('Log search failed', error);
      res.status(500).json({
        error: 'Log search failed',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/stats
   * Get detailed statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const period = req.query.period || '24h';
      
      const [hourlyStats, dailyStats, errorPatterns] = await Promise.all([
        logService.getHourlyStats(),
        logService.getDailyStats(7),
        logService.analyzeErrorPatterns()
      ]);

      res.json({
        period,
        timestamp: new Date().toISOString(),
        statistics: {
          hourly: hourlyStats,
          daily: dailyStats
        },
        analysis: {
          errorPatterns,
          totalErrors: errorPatterns.reduce((sum, pattern) => sum + pattern.count, 0)
        }
      });

    } catch (error) {
      await logService.error('Stats fetch failed', error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/health
   * Get logging system health
   */
  router.get('/health', async (req, res) => {
    try {
      const health = await logService.getHealthStatus();
      
      res.status(health.status === 'healthy' ? 200 : 503).json({
        status: health.status,
        checks: health.checks,
        details: health.details,
        timestamp: new Date().toISOString(),
        service: logService.serviceName
      });

    } catch (error) {
      await logService.error('Health check failed', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /logs/test
   * Create test log entries (for development)
   */
  router.post('/test', async (req, res) => {
    try {
      const { level = 'info', message = 'Test log entry', count = 1 } = req.body;

      if (!['debug', 'info', 'warn', 'error'].includes(level)) {
        return res.status(400).json({
          error: 'Invalid log level',
          validLevels: ['debug', 'info', 'warn', 'error']
        });
      }

      const logs = [];
      for (let i = 0; i < Math.min(count, 10); i++) {
        const testMessage = count > 1 ? `${message} #${i + 1}` : message;
        const logEntry = await logService[level](testMessage, {
          type: 'test_log',
          requestId: req.id,
          index: i + 1,
          total: count
        });
        logs.push(logEntry);
      }

      res.json({
        message: 'Test logs created successfully',
        logs,
        count: logs.length
      });

    } catch (error) {
      await logService.error('Test log creation failed', error);
      res.status(500).json({
        error: 'Failed to create test logs',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/export
   * Export logs in various formats
   */
  router.get('/export', async (req, res) => {
    try {
      const {
        format = 'json',
        level,
        service,
        startDate,
        endDate,
        limit = 1000
      } = req.query;

      // Get logs (same filtering as search)
      let logs = await logService.getRecentLogs(limit);

      // Apply filters
      if (level) logs = logs.filter(log => log.level === level);
      if (service) logs = logs.filter(log => log.service === service);
      if (startDate) {
        const start = new Date(startDate);
        logs = logs.filter(log => new Date(log.timestamp) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        logs = logs.filter(log => new Date(log.timestamp) <= end);
      }

      // Format response based on requested format
      switch (format.toLowerCase()) {
        case 'csv':
          const csvData = this.convertToCSV(logs);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
          res.send(csvData);
          break;

        case 'txt':
          const txtData = logs.map(log => 
            `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`
          ).join('\n');
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Content-Disposition', 'attachment; filename=logs.txt');
          res.send(txtData);
          break;

        default: // json
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename=logs.json');
          res.json({
            exportedAt: new Date().toISOString(),
            filters: { level, service, startDate, endDate },
            count: logs.length,
            logs
          });
      }

      // Log export activity
      await logService.logBusinessEvent('logs_exported', {
        format, count: logs.length, filters: { level, service }
      });

    } catch (error) {
      await logService.error('Log export failed', error);
      res.status(500).json({
        error: 'Log export failed',
        message: error.message
      });
    }
  });

  /**
   * GET /logs/report
   * Generate comprehensive log report
   */
  router.get('/report', async (req, res) => {
    try {
      const period = req.query.period || '24h';
      const report = await logService.generateLogReport(period);

      res.json(report);

      // Log report generation
      await logService.logBusinessEvent('report_generated', { period });

    } catch (error) {
      await logService.error('Report generation failed', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: error.message
      });
    }
  });

  /**
   * DELETE /logs/cleanup
   * Clean up old log files
   */
  router.delete('/cleanup', async (req, res) => {
    try {
      const daysToKeep = parseInt(req.query.daysToKeep) || 30;
      
      if (daysToKeep < 1) {
        return res.status(400).json({
          error: 'daysToKeep must be at least 1'
        });
      }

      const deletedCount = await logService.cleanup(daysToKeep);

      res.json({
        message: 'Log cleanup completed successfully',
        deletedFiles: deletedCount,
        daysToKeep
      });

    } catch (error) {
      await logService.error('Log cleanup failed', error);
      res.status(500).json({
        error: 'Log cleanup failed',
        message: error.message
      });
    }
  });

  /**
   * Helper method to convert logs to CSV
   */
  router.convertToCSV = (logs) => {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'level', 'service', 'message'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.timestamp,
        log.level,
        log.service || '',
        `"${(log.message || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  return router;
}

module.exports = createLogRoutes;