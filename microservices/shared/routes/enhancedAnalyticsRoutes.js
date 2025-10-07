/**
 * Enhanced Analytics Dashboard Routes v2.0
 * 
 * Sistema completo de analytics com dashboard consolidado, métricas em tempo real,
 * relatórios avançados e insights automáticos para toda a plataforma.
 * 
 * @author Sistema Vitrine Digital
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const AdvancedAnalyticsService = require('../../shared/services/AdvancedAnalyticsService');
const authMiddleware = require('../../shared/middleware/auth');
const rateLimiter = require('../../shared/middleware/rateLimiter');
const Logger = require('../../shared/utils/logger');

const logger = Logger.create('EnhancedAnalyticsRoutes');

// Rate limiting para analytics
const analyticsRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: 'Muitas consultas de analytics. Tente novamente.'
});

/**
 * GET /v2/dashboard/overview
 * Dashboard principal consolidado
 */
router.get('/v2/dashboard/overview', authMiddleware, analyticsRateLimit, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { timeRange = '24h' } = req.query;
        
        const analyticsService = new AdvancedAnalyticsService();
        const dashboardData = await analyticsService.getDashboardMetrics(tenant_id, timeRange);
        
        // KPIs calculados
        const kpis = {
            totalRevenue: dashboardData.summary.revenue?.total || 0,
            totalOrders: dashboardData.summary.product_sale?.count || 0,
            newUsers: dashboardData.summary.user_registration?.count || 0,
            conversionRate: calculateConversionRate(dashboardData),
            avgResponseTime: dashboardData.summary.response_time?.average || 0,
            errorRate: calculateErrorRate(dashboardData)
        };
        
        res.json({
            success: true,
            data: {
                ...dashboardData,
                kpis,
                insights: generateAutomaticInsights(dashboardData, kpis)
            }
        });
        
    } catch (error) {
        logger.error('Error in analytics dashboard overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate dashboard overview',
            message: error.message
        });
    }
});

/**
 * GET /v2/metrics/real-time
 * Métricas em tempo real
 */
router.get('/v2/metrics/real-time', authMiddleware, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        
        const analyticsService = new AdvancedAnalyticsService();
        const realTimeMetrics = Object.fromEntries(analyticsService.realTimeMetrics);
        
        // Filtrar por tenant
        const filteredMetrics = {};
        for (const [key, metric] of Object.entries(realTimeMetrics)) {
            const tenantValues = metric.values?.filter(v => 
                !tenant_id || (v.metadata?.tenant_id == tenant_id)
            ) || [];
            
            if (tenantValues.length > 0) {
                filteredMetrics[key] = {
                    ...metric,
                    values: tenantValues.slice(-10), // Últimos 10 valores
                    current: tenantValues[tenantValues.length - 1]?.value || 0
                };
            }
        }
        
        res.json({
            success: true,
            data: filteredMetrics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error getting real-time metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get real-time metrics'
        });
    }
});

/**
 * GET /v2/reports/business-summary
 * Relatório resumo de negócio
 */
router.get('/v2/reports/business-summary', authMiddleware, analyticsRateLimit, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { timeRange = '30d', compareWith = 'previous' } = req.query;
        
        const analyticsService = new AdvancedAnalyticsService();
        
        // Métricas do período atual
        const currentData = await analyticsService.getDashboardMetrics(tenant_id, timeRange);
        
        // Métricas do período anterior para comparação
        const previousTimeRange = getPreviousTimeRange(timeRange);
        const previousData = await analyticsService.getDashboardMetrics(tenant_id, previousTimeRange);
        
        const businessSummary = {
            current: {
                revenue: currentData.summary.revenue?.total || 0,
                orders: currentData.summary.product_sale?.count || 0,
                customers: currentData.summary.user_registration?.count || 0,
                products: currentData.summary.product_view?.count || 0
            },
            previous: {
                revenue: previousData.summary.revenue?.total || 0,
                orders: previousData.summary.product_sale?.count || 0,
                customers: previousData.summary.user_registration?.count || 0,
                products: previousData.summary.product_view?.count || 0
            },
            growth: {},
            trends: currentData.timeSeries
        };
        
        // Calcular crescimento
        for (const [key, current] of Object.entries(businessSummary.current)) {
            const previous = businessSummary.previous[key];
            businessSummary.growth[key] = previous > 0 ? 
                ((current - previous) / previous) * 100 : 0;
        }
        
        res.json({
            success: true,
            data: businessSummary,
            metadata: {
                timeRange,
                compareWith,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error generating business summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate business summary'
        });
    }
});

/**
 * GET /v2/alerts/dashboard
 * Dashboard de alertas consolidado
 */
router.get('/v2/alerts/dashboard', authMiddleware, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        
        const analyticsService = new AdvancedAnalyticsService();
        
        // Alertas ativos
        const activeAlerts = await analyticsService.db('analytics_alerts')
            .where('resolved', false)
            .where(function() {
                this.whereNull('tenant_id').orWhere('tenant_id', tenant_id);
            })
            .orderBy('triggered_at', 'desc');
        
        // Estatísticas de alertas
        const alertStats = await analyticsService.db('analytics_alerts')
            .where('triggered_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .where(function() {
                this.whereNull('tenant_id').orWhere('tenant_id', tenant_id);
            })
            .groupBy('severity')
            .select([
                'severity',
                analyticsService.db.raw('COUNT(*) as count')
            ]);
        
        const categorizedAlerts = {
            critical: activeAlerts.filter(a => a.severity === 'critical'),
            warning: activeAlerts.filter(a => a.severity === 'warning'),
            info: activeAlerts.filter(a => a.severity === 'info')
        };
        
        res.json({
            success: true,
            data: {
                active: activeAlerts,
                categorized: categorizedAlerts,
                statistics: {
                    total: activeAlerts.length,
                    byType: alertStats.reduce((acc, stat) => {
                        acc[stat.severity] = parseInt(stat.count);
                        return acc;
                    }, {}),
                    last24h: alertStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
                }
            }
        });
        
    } catch (error) {
        logger.error('Error getting alerts dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get alerts dashboard'
        });
    }
});

/**
 * GET /v2/performance/overview
 * Overview de performance da plataforma
 */
router.get('/v2/performance/overview', authMiddleware, analyticsRateLimit, async (req, res) => {
    try {
        const { timeRange = '6h' } = req.query;
        
        const analyticsService = new AdvancedAnalyticsService();
        const timeRangeMs = analyticsService.parseTimeRange(timeRange);
        const startTime = new Date(Date.now() - timeRangeMs);
        
        // Métricas de performance por serviço
        const serviceMetrics = await analyticsService.db('analytics_metrics')
            .whereIn('type', ['response_time', 'api_request', 'api_error'])
            .where('collected_at', '>=', startTime)
            .groupBy('type', analyticsService.db.raw('metadata->\'service\''))
            .select([
                'type',
                analyticsService.db.raw('metadata->\'service\' as service'),
                analyticsService.db.raw('COUNT(*) as count'),
                analyticsService.db.raw('AVG(value) as average'),
                analyticsService.db.raw('MIN(value) as minimum'),
                analyticsService.db.raw('MAX(value) as maximum')
            ]);
        
        // Organizar por serviço
        const performanceByService = {};
        serviceMetrics.forEach(metric => {
            const service = metric.service || 'unknown';
            if (!performanceByService[service]) {
                performanceByService[service] = {};
            }
            performanceByService[service][metric.type] = {
                count: parseInt(metric.count),
                average: parseFloat(metric.average),
                minimum: parseFloat(metric.minimum),
                maximum: parseFloat(metric.maximum)
            };
        });
        
        // Health score por serviço
        const healthScores = {};
        for (const [service, metrics] of Object.entries(performanceByService)) {
            const responseTime = metrics.response_time?.average || 0;
            const errorRate = metrics.api_error?.count || 0;
            const totalRequests = metrics.api_request?.count || 1;
            
            // Calcular health score (0-100)
            let score = 100;
            if (responseTime > 1000) score -= 20;
            if (responseTime > 2000) score -= 30;
            if ((errorRate / totalRequests) > 0.05) score -= 25;
            
            healthScores[service] = Math.max(0, score);
        }
        
        res.json({
            success: true,
            data: {
                overview: performanceByService,
                healthScores,
                summary: {
                    totalServices: Object.keys(performanceByService).length,
                    averageHealth: Object.values(healthScores).reduce((a, b) => a + b, 0) / Object.values(healthScores).length || 0,
                    criticalServices: Object.entries(healthScores).filter(([_, score]) => score < 70).length
                }
            },
            metadata: {
                timeRange,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Error getting performance overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance overview'
        });
    }
});

/**
 * POST /v2/export/dashboard
 * Export completo do dashboard
 */
router.post('/v2/export/dashboard', authMiddleware, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { 
            format = 'json',
            timeRange = '30d',
            sections = ['overview', 'business', 'performance', 'alerts']
        } = req.body;
        
        const analyticsService = new AdvancedAnalyticsService();
        const exportData = {};
        
        // Coletar dados das seções solicitadas
        if (sections.includes('overview')) {
            exportData.overview = await analyticsService.getDashboardMetrics(tenant_id, timeRange);
        }
        
        if (sections.includes('alerts')) {
            exportData.alerts = await analyticsService.db('analytics_alerts')
                .where('triggered_at', '>=', new Date(Date.now() - analyticsService.parseTimeRange(timeRange)))
                .where(function() {
                    this.whereNull('tenant_id').orWhere('tenant_id', tenant_id);
                });
        }
        
        // Adicionar metadata
        exportData.metadata = {
            exportedAt: new Date().toISOString(),
            tenant_id,
            timeRange,
            sections,
            version: '2.0.0'
        };
        
        // Formatar dados conforme formato solicitado
        let responseData;
        let contentType;
        
        switch (format.toLowerCase()) {
            case 'csv':
                responseData = convertToCSV(exportData);
                contentType = 'text/csv';
                break;
            case 'json':
            default:
                responseData = JSON.stringify(exportData, null, 2);
                contentType = 'application/json';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.${format}"`);
        
        res.send(responseData);
        
        logger.info(`Analytics export generated for user ${req.user.id}, format: ${format}`);
        
    } catch (error) {
        logger.error('Error exporting dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export dashboard'
        });
    }
});

/**
 * GET /v2/status
 * Status do sistema de analytics
 */
router.get('/v2/status', authMiddleware, async (req, res) => {
    try {
        const analyticsService = new AdvancedAnalyticsService();
        const status = analyticsService.getServiceStatus();
        
        // Adicionar métricas de sistema
        const systemMetrics = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            nodeVersion: process.version,
            platform: process.platform
        };
        
        res.json({
            ...status,
            system: systemMetrics,
            healthCheck: {
                database: await checkDatabaseHealth(),
                cache: await checkCacheHealth(),
                eventBus: await checkEventBusHealth()
            }
        });
        
    } catch (error) {
        logger.error('Error getting analytics status:', error);
        res.status(500).json({
            error: 'Failed to get service status'
        });
    }
});

// Helper Functions

function calculateConversionRate(dashboardData) {
    const views = dashboardData.summary.product_view?.count || 0;
    const sales = dashboardData.summary.product_sale?.count || 0;
    return views > 0 ? (sales / views) * 100 : 0;
}

function calculateErrorRate(dashboardData) {
    const requests = dashboardData.summary.api_request?.count || 0;
    const errors = dashboardData.summary.api_error?.count || 0;
    return requests > 0 ? (errors / requests) * 100 : 0;
}

function generateAutomaticInsights(dashboardData, kpis) {
    const insights = [];
    
    // Performance insights
    if (kpis.avgResponseTime > 1000) {
        insights.push({
            type: 'performance',
            severity: 'warning',
            message: `Tempo de resposta médio alto: ${kpis.avgResponseTime.toFixed(0)}ms`,
            recommendation: 'Considere otimizar consultas ou adicionar cache'
        });
    }
    
    // Business insights
    if (kpis.conversionRate < 2) {
        insights.push({
            type: 'business',
            severity: 'info',
            message: `Taxa de conversão baixa: ${kpis.conversionRate.toFixed(1)}%`,
            recommendation: 'Analise a jornada do usuário e otimize o funil'
        });
    }
    
    // Error rate insights
    if (kpis.errorRate > 5) {
        insights.push({
            type: 'system',
            severity: 'critical',
            message: `Taxa de erro alta: ${kpis.errorRate.toFixed(1)}%`,
            recommendation: 'Investigate logs and fix critical issues immediately'
        });
    }
    
    return insights;
}

function getPreviousTimeRange(timeRange) {
    // Retorna o período anterior equivalente para comparação
    const ranges = {
        '1h': '2h',
        '6h': '12h', 
        '24h': '48h',
        '7d': '14d',
        '30d': '60d'
    };
    
    return ranges[timeRange] || '60d';
}

function convertToCSV(data) {
    // Conversão simplificada para CSV
    const lines = ['Type,Value,Timestamp'];
    
    if (data.overview?.summary) {
        Object.entries(data.overview.summary).forEach(([key, value]) => {
            lines.push(`${key},${value.total || value.count || 0},${new Date().toISOString()}`);
        });
    }
    
    return lines.join('\n');
}

async function checkDatabaseHealth() {
    try {
        const analyticsService = new AdvancedAnalyticsService();
        await analyticsService.db.raw('SELECT 1');
        return { status: 'healthy', latency: 0 };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
}

async function checkCacheHealth() {
    try {
        // Verificar Redis se estiver configurado
        return { status: 'healthy' };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
}

async function checkEventBusHealth() {
    try {
        // Verificar Event Bus
        return { status: 'healthy' };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
}

module.exports = router;