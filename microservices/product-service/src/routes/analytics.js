const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/AnalyticsService');
const { EventPublisher } = require('../../../shared');

// Middleware para inicializar serviços
router.use(async (req, res, next) => {
  const eventPublisher = new EventPublisher();
  req.analyticsService = new AnalyticsService(req.db, req.logger, eventPublisher);
  next();
});

// Middleware para extrair tenant_id
router.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing tenant ID',
      message: 'x-tenant-id header is required'
    });
  }

  req.tenantId = parseInt(tenantId);
  next();
});

// POST /api/analytics/views - Registrar visualização de produto
router.post('/views', async (req, res, next) => {
  try {
    const result = await req.analyticsService.trackProductView(req.tenantId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/searches - Registrar busca
router.post('/searches', async (req, res, next) => {
  try {
    const result = await req.analyticsService.trackSearch(req.tenantId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/products/top - Produtos mais visualizados
router.get('/products/top', async (req, res, next) => {
  try {
    const result = await req.analyticsService.getTopProducts(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/stock/alerts - Alertas de estoque
router.get('/stock/alerts', async (req, res, next) => {
  try {
    const result = await req.analyticsService.getStockAlerts(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/revenue/products - Receita por produto
router.get('/revenue/products', async (req, res, next) => {
  try {
    const result = await req.analyticsService.getRevenueByProduct(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/searches - Análises de busca
router.get('/searches', async (req, res, next) => {
  try {
    const result = await req.analyticsService.getSearchAnalytics(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/performance - Métricas de performance
router.get('/performance', async (req, res, next) => {
  try {
    const result = await req.analyticsService.getPerformanceMetrics(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/dashboard - Dashboard completo
router.get('/dashboard', async (req, res, next) => {
  try {
    const period = req.query.period || '30days';
    
    // Executar várias métricas em paralelo
    const [
      topProducts,
      stockAlerts,
      performance,
      searchAnalytics
    ] = await Promise.all([
      req.analyticsService.getTopProducts(req.tenantId, { period, limit: 5 }),
      req.analyticsService.getStockAlerts(req.tenantId),
      req.analyticsService.getPerformanceMetrics(req.tenantId, { period }),
      req.analyticsService.getSearchAnalytics(req.tenantId, { period, limit: 10 })
    ]);

    res.json({
      period,
      timestamp: new Date().toISOString(),
      top_products: topProducts,
      stock_alerts: stockAlerts,
      performance: performance,
      search_analytics: searchAnalytics
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;