const { Logger } = require('../../shared');

/**
 * Database Query Optimization Service
 * Provides query analysis, optimization suggestions, and performance monitoring
 */
class QueryOptimizationService {
  constructor(db, options = {}) {
    this.db = db;
    this.logger = new Logger('query-optimization');
    this.slowQueryThreshold = options.slowQueryThreshold || 1000; // ms
    this.enableLogging = options.enableLogging !== false;
    this.enableAnalysis = options.enableAnalysis !== false;
    
    // Query performance cache
    this.queryStats = new Map();
    this.slowQueries = [];
    
    if (this.enableLogging) {
      this.setupQueryLogging();
    }
  }

  /**
   * Setup automatic query logging and analysis
   */
  setupQueryLogging() {
    // Hook into Knex query events
    this.db.on('query', (queryData) => {
      if (this.enableAnalysis) {
        queryData._startTime = Date.now();
      }
    });

    this.db.on('query-response', (response, queryData) => {
      if (this.enableAnalysis && queryData._startTime) {
        const duration = Date.now() - queryData._startTime;
        this.analyzeQuery(queryData, duration);
      }
    });

    this.db.on('query-error', (error, queryData) => {
      this.logger.error('Query failed', {
        sql: queryData.sql,
        bindings: queryData.bindings,
        error: error.message
      });
    });
  }

  /**
   * Analyze query performance and log slow queries
   */
  analyzeQuery(queryData, duration) {
    const { sql, bindings } = queryData;
    const normalizedQuery = this.normalizeQuery(sql);
    
    // Update query statistics
    if (!this.queryStats.has(normalizedQuery)) {
      this.queryStats.set(normalizedQuery, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastExecuted: null
      });
    }
    
    const stats = this.queryStats.get(normalizedQuery);
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.lastExecuted = new Date();

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      const slowQuery = {
        sql,
        bindings,
        duration,
        timestamp: new Date(),
        normalized: normalizedQuery
      };
      
      this.slowQueries.push(slowQuery);
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-100);
      }

      this.logger.warn('Slow query detected', {
        duration: `${duration}ms`,
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        suggestion: this.getOptimizationSuggestion(sql)
      });
    }
  }

  /**
   * Normalize SQL query for statistics grouping
   */
  normalizeQuery(sql) {
    return sql
      .replace(/\$\d+/g, '?')           // Replace numbered parameters
      .replace(/\d+/g, 'N')            // Replace numbers
      .replace(/'[^']*'/g, "'X'")      // Replace string literals
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Get optimization suggestions for a query
   */
  getOptimizationSuggestion(sql) {
    const suggestions = [];
    const lowerSql = sql.toLowerCase();

    // Check for missing WHERE clauses on large tables
    if (lowerSql.includes('from products') && !lowerSql.includes('where')) {
      suggestions.push('Add WHERE clause to filter products by tenant_id');
    }

    // Check for missing indexes
    if (lowerSql.includes('order by') && !lowerSql.includes('limit')) {
      suggestions.push('Consider adding LIMIT clause for large result sets');
    }

    // Check for N+1 queries
    if (lowerSql.includes('select') && lowerSql.includes('where id =')) {
      suggestions.push('Potential N+1 query - consider using JOIN or IN clause');
    }

    // Check for missing indexes on JOIN conditions
    if (lowerSql.includes('join') && lowerSql.includes('on')) {
      suggestions.push('Ensure indexes exist on JOIN columns');
    }

    // Check for SELECT *
    if (lowerSql.includes('select *')) {
      suggestions.push('Avoid SELECT * - specify only needed columns');
    }

    return suggestions.length > 0 ? suggestions.join('; ') : 'Consider adding appropriate indexes';
  }

  /**
   * Get optimized query builders for common operations
   */
  getOptimizedProductQuery(tenantId, options = {}) {
    let query = this.db('products')
      .where('tenant_id', tenantId)
      .where('is_active', true);

    // Apply common optimizations
    if (options.category) {
      query = query.where('category_id', options.category);
    }

    if (options.priceRange) {
      query = query.whereBetween('price', [options.priceRange.min, options.priceRange.max]);
    }

    if (options.inStock) {
      query = query.where('stock_quantity', '>', 0);
    }

    if (options.search) {
      // Use full-text search if available (PostgreSQL)
      if (this.db.client.config.client === 'postgresql') {
        query = query.whereRaw(
          "to_tsvector('portuguese', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('portuguese', ?)",
          [options.search]
        );
      } else {
        // Fallback to LIKE for other databases
        query = query.where(function() {
          this.where('name', 'ilike', `%${options.search}%`)
              .orWhere('description', 'ilike', `%${options.search}%`);
        });
      }
    }

    // Sorting with index optimization
    if (options.sortBy) {
      const allowedSorts = ['name', 'price', 'created_at', 'views_count'];
      if (allowedSorts.includes(options.sortBy)) {
        query = query.orderBy(options.sortBy, options.sortOrder || 'asc');
      }
    }

    // Pagination
    if (options.limit) {
      query = query.limit(options.limit);
      if (options.offset) {
        query = query.offset(options.offset);
      }
    }

    return query;
  }

  /**
   * Execute query with performance analysis
   */
  async executeWithAnalysis(queryBuilder, label = 'query') {
    const startTime = Date.now();
    
    try {
      const result = await queryBuilder;
      const duration = Date.now() - startTime;
      
      if (duration > this.slowQueryThreshold) {
        this.logger.warn(`Slow ${label}`, {
          duration: `${duration}ms`,
          sql: queryBuilder.toString()
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${label} failed`, {
        duration: `${duration}ms`,
        error: error.message,
        sql: queryBuilder.toString()
      });
      throw error;
    }
  }

  /**
   * Get query performance statistics
   */
  getPerformanceStats() {
    const stats = Array.from(this.queryStats.entries()).map(([query, data]) => ({
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      ...data
    }));

    // Sort by average time descending
    stats.sort((a, b) => b.avgTime - a.avgTime);

    return {
      totalQueries: stats.reduce((sum, stat) => sum + stat.count, 0),
      uniqueQueries: stats.length,
      slowQueries: this.slowQueries.length,
      topSlowQueries: stats.slice(0, 10),
      recentSlowQueries: this.slowQueries.slice(-10).reverse()
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    const stats = this.getPerformanceStats();
    
    // Get database size information
    let dbStats = {};
    try {
      if (this.db.client.config.client === 'postgresql') {
        const sizeQuery = await this.db.raw(`
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE schemaname = 'public'
          ORDER BY n_distinct DESC NULLS LAST
          LIMIT 20
        `);
        dbStats.tableStats = sizeQuery.rows;
      }
    } catch (error) {
      this.logger.warn('Could not get database statistics', { error: error.message });
    }

    const report = {
      timestamp: new Date(),
      performance: stats,
      database: dbStats,
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    // Check for frequently executed slow queries
    const frequentSlowQueries = stats.topSlowQueries.filter(q => q.count > 10 && q.avgTime > 500);
    if (frequentSlowQueries.length > 0) {
      recommendations.push({
        type: 'critical',
        message: `${frequentSlowQueries.length} frequently executed slow queries detected`,
        action: 'Review and optimize these queries with proper indexes'
      });
    }

    // Check for N+1 query patterns
    const potentialN1Queries = stats.topSlowQueries.filter(q => 
      q.query.includes('where id =') && q.count > 20
    );
    if (potentialN1Queries.length > 0) {
      recommendations.push({
        type: 'warning',
        message: 'Potential N+1 query patterns detected',
        action: 'Consider using eager loading or batch queries'
      });
    }

    // Check overall performance
    if (stats.slowQueries > stats.totalQueries * 0.1) {
      recommendations.push({
        type: 'warning',
        message: `${((stats.slowQueries / stats.totalQueries) * 100).toFixed(1)}% of queries are slow`,
        action: 'Review database indexing strategy'
      });
    }

    return recommendations;
  }

  /**
   * Clear performance statistics
   */
  clearStats() {
    this.queryStats.clear();
    this.slowQueries = [];
    this.logger.info('Query performance statistics cleared');
  }

  /**
   * Get index usage analysis (PostgreSQL only)
   */
  async analyzeIndexUsage() {
    if (this.db.client.config.client !== 'postgresql') {
      return { error: 'Index analysis only available for PostgreSQL' };
    }

    try {
      const indexUsage = await this.db.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan DESC
      `);

      const unusedIndexes = await this.db.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0
        AND schemaname = 'public'
      `);

      return {
        mostUsed: indexUsage.rows.slice(0, 10),
        unused: unusedIndexes.rows,
        recommendations: this.generateIndexRecommendations(unusedIndexes.rows)
      };
    } catch (error) {
      this.logger.error('Failed to analyze index usage', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Generate index recommendations
   */
  generateIndexRecommendations(unusedIndexes) {
    const recommendations = [];

    if (unusedIndexes.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${unusedIndexes.length} unused indexes found`,
        action: 'Consider dropping unused indexes to improve write performance',
        details: unusedIndexes.slice(0, 5)
      });
    }

    return recommendations;
  }
}

module.exports = QueryOptimizationService;