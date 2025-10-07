const { ValidationSchemas } = require('../../../shared');
const Joi = ValidationSchemas.Joi;

class AnalyticsService {
  constructor(db, logger, eventPublisher) {
    this.db = db;
    this.logger = logger;
    this.eventPublisher = eventPublisher;
  }

  // Validation schemas
  static schemas = {
    trackView: Joi.object({
      product_id: Joi.number().integer().min(1).required(),
      user_id: Joi.number().integer().min(1).allow(null),
      session_id: Joi.string().max(100).required(),
      user_agent: Joi.string().max(500).allow(''),
      ip_address: Joi.string().ip().allow(null),
      referrer: Joi.string().max(500).allow(''),
      source: Joi.string().max(50).default('web')
    }),

    searchQuery: Joi.object({
      query: Joi.string().max(200).required(),
      results_count: Joi.number().integer().min(0).required(),
      user_id: Joi.number().integer().min(1).allow(null),
      session_id: Joi.string().max(100).required(),
      filters: Joi.object().allow(null)
    })
  };

  /**
   * Registra visualização de produto
   */
  async trackProductView(tenantId, viewData) {
    const { error, value } = AnalyticsService.schemas.trackView.validate(viewData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid view data',
        details: error.details
      };
    }

    // Verificar se produto existe
    const product = await this.db('products')
      .where({ id: value.product_id, tenant_id: tenantId })
      .first();

    if (!product) {
      throw {
        type: 'not_found',
        message: 'Product not found'
      };
    }

    // Registrar visualização
    await this.db('product_views').insert({
      ...value,
      tenant_id: tenantId,
      viewed_at: new Date()
    });

    // Atualizar contador de visualizações do produto
    await this.db('products')
      .where({ id: value.product_id, tenant_id: tenantId })
      .increment('view_count', 1);

    // Publicar evento
    await this.eventPublisher.publish('product.viewed', {
      tenantId,
      productId: value.product_id,
      userId: value.user_id,
      sessionId: value.session_id
    });

    this.logger.info('Product view tracked', {
      tenantId,
      productId: value.product_id,
      userId: value.user_id
    });

    return { tracked: true };
  }

  /**
   * Registra busca realizada
   */
  async trackSearch(tenantId, searchData) {
    const { error, value } = AnalyticsService.schemas.searchQuery.validate(searchData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid search data',
        details: error.details
      };
    }

    // Registrar busca
    const [search] = await this.db('search_queries').insert({
      ...value,
      tenant_id: tenantId,
      searched_at: new Date(),
      filters: value.filters ? JSON.stringify(value.filters) : null
    }).returning('*');

    this.logger.info('Search tracked', {
      tenantId,
      query: value.query,
      resultsCount: value.results_count
    });

    return search;
  }

  /**
   * Produtos mais visualizados
   */
  async getTopProducts(tenantId, options = {}) {
    const {
      period = '30days',
      limit = 10,
      category_id = null
    } = options;

    let query = this.db('products as p')
      .select(
        'p.id',
        'p.name',
        'p.sku',
        'p.price',
        'p.images',
        this.db.raw('COUNT(pv.id) as total_views'),
        this.db.raw('COUNT(DISTINCT pv.session_id) as unique_views'),
        this.db.raw('AVG(p.price) as avg_price')
      )
      .leftJoin('product_views as pv', function() {
        this.on('pv.product_id', 'p.id')
          .andOn('pv.tenant_id', 'p.tenant_id');
      })
      .where('p.tenant_id', tenantId)
      .where('p.is_active', true)
      .groupBy('p.id', 'p.name', 'p.sku', 'p.price', 'p.images')
      .orderByRaw('COUNT(pv.id) DESC')
      .limit(limit);

    // Filtro por categoria
    if (category_id) {
      query = query.where('p.category_id', category_id);
    }

    // Filtro por período
    if (period && period !== 'all') {
      const days = this.parsePeriod(period);
      if (days) {
        query = query.where('pv.viewed_at', '>=', 
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        );
      }
    }

    const products = await query;

    return {
      period,
      total_products: products.length,
      products: products.map(product => ({
        ...product,
        images: product.images ? JSON.parse(product.images) : []
      }))
    };
  }

  /**
   * Buscar alertas de estoque baixo
   */
  async getStockAlerts(tenantId, options = {}) {
    const { 
      threshold = null,
      category_id = null 
    } = options;

    let query = this.db('products as p')
      .select(
        'p.id',
        'p.name',
        'p.sku',
        'p.stock_quantity',
        'p.min_stock',
        'c.name as category_name'
      )
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .where('p.tenant_id', tenantId)
      .where('p.is_active', true)
      .where('p.manage_stock', true);

    if (threshold) {
      query = query.where('p.stock_quantity', '<=', threshold);
    } else {
      query = query.whereRaw('p.stock_quantity <= p.min_stock');
    }

    if (category_id) {
      query = query.where('p.category_id', category_id);
    }

    const alerts = await query.orderBy('p.stock_quantity', 'asc');

    return {
      total_alerts: alerts.length,
      critical_count: alerts.filter(p => p.stock_quantity === 0).length,
      low_count: alerts.filter(p => p.stock_quantity > 0).length,
      alerts
    };
  }

  /**
   * Receita por produto
   */
  async getRevenueByProduct(tenantId, options = {}) {
    const {
      period = '30days',
      limit = 20
    } = options;

    // Assumindo que temos integração com order service via events
    let query = this.db('products as p')
      .select(
        'p.id',
        'p.name',
        'p.sku',
        'p.price',
        this.db.raw('COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue'),
        this.db.raw('COALESCE(SUM(oi.quantity), 0) as total_sold'),
        this.db.raw('COUNT(DISTINCT o.id) as total_orders')
      )
      .leftJoin('order_items as oi', function() {
        this.on('oi.product_id', 'p.id')
          .andOn('oi.tenant_id', 'p.tenant_id');
      })
      .leftJoin('orders as o', function() {
        this.on('o.id', 'oi.order_id')
          .andOn('o.tenant_id', 'oi.tenant_id');
      })
      .where('p.tenant_id', tenantId)
      .where('p.is_active', true)
      .groupBy('p.id', 'p.name', 'p.sku', 'p.price')
      .orderByRaw('COALESCE(SUM(oi.quantity * oi.price), 0) DESC')
      .limit(limit);

    // Filtro por período
    if (period && period !== 'all') {
      const days = this.parsePeriod(period);
      if (days) {
        query = query.where('o.created_at', '>=', 
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        );
      }
    }

    const revenue = await query;

    const totalRevenue = revenue.reduce((sum, item) => 
      sum + parseFloat(item.total_revenue), 0
    );

    return {
      period,
      total_revenue: totalRevenue,
      total_products: revenue.length,
      products: revenue
    };
  }

  /**
   * Análises de busca
   */
  async getSearchAnalytics(tenantId, options = {}) {
    const {
      period = '30days',
      limit = 20
    } = options;

    let query = this.db('search_queries')
      .select(
        'query',
        this.db.raw('COUNT(*) as search_count'),
        this.db.raw('AVG(results_count) as avg_results'),
        this.db.raw('SUM(CASE WHEN results_count = 0 THEN 1 ELSE 0 END) as zero_results')
      )
      .where('tenant_id', tenantId)
      .groupBy('query')
      .orderByRaw('COUNT(*) DESC')
      .limit(limit);

    // Filtro por período
    if (period && period !== 'all') {
      const days = this.parsePeriod(period);
      if (days) {
        query = query.where('searched_at', '>=', 
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        );
      }
    }

    const searches = await query;

    const totalSearches = searches.reduce((sum, item) => 
      sum + parseInt(item.search_count), 0
    );

    const totalZeroResults = searches.reduce((sum, item) => 
      sum + parseInt(item.zero_results), 0
    );

    return {
      period,
      total_searches: totalSearches,
      zero_results_rate: totalSearches > 0 ? (totalZeroResults / totalSearches) * 100 : 0,
      top_queries: searches
    };
  }

  /**
   * Performance metrics do serviço
   */
  async getPerformanceMetrics(tenantId, options = {}) {
    const {
      period = '24hours'
    } = options;

    const days = this.parsePeriod(period);
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    // Métricas de produtos
    let productQuery = this.db('products')
      .where('tenant_id', tenantId)
      .where('is_active', true);

    const totalProducts = await productQuery.clone().count('* as count').first();
    const lowStockProducts = await productQuery.clone()
      .whereRaw('stock_quantity <= min_stock')
      .count('* as count').first();
    
    const outOfStockProducts = await productQuery.clone()
      .where('stock_quantity', 0)
      .count('* as count').first();

    // Métricas de visualizações (se período especificado)
    let viewMetrics = { total_views: 0, unique_sessions: 0 };
    if (since) {
      const views = await this.db('product_views')
        .where('tenant_id', tenantId)
        .where('viewed_at', '>=', since)
        .select(
          this.db.raw('COUNT(*) as total_views'),
          this.db.raw('COUNT(DISTINCT session_id) as unique_sessions')
        )
        .first();
      
      viewMetrics = views || viewMetrics;
    }

    return {
      period,
      products: {
        total: parseInt(totalProducts.count),
        low_stock: parseInt(lowStockProducts.count),
        out_of_stock: parseInt(outOfStockProducts.count),
        in_stock_rate: totalProducts.count > 0 ? 
          ((totalProducts.count - outOfStockProducts.count) / totalProducts.count) * 100 : 0
      },
      views: {
        total: parseInt(viewMetrics.total_views || 0),
        unique_sessions: parseInt(viewMetrics.unique_sessions || 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Parse period string para dias
   */
  parsePeriod(period) {
    const periodMap = {
      '24hours': 1,
      '7days': 7,
      '30days': 30,
      '90days': 90,
      '1year': 365
    };

    return periodMap[period] || null;
  }
}

module.exports = AnalyticsService;