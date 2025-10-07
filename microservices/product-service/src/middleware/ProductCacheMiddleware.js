const CacheService = require('../../shared/services/CacheService');

/**
 * Product Cache Middleware
 * Handles caching for product-related endpoints with smart invalidation
 */
class ProductCacheMiddleware {
  constructor(cacheService) {
    this.cache = cacheService || new CacheService();
    this.initialized = false;
  }

  /**
   * Initialize cache service if not already done
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.cache.connect();
      this.initialized = true;
    }
  }

  /**
   * Generate cache key for request
   */
  _generateCacheKey(req) {
    const { method, path, query } = req;
    const tenantId = req.headers['x-tenant-id'] || 'default';
    
    // Create a normalized key from path and query parameters
    const queryString = Object.keys(query)
      .sort()
      .map(key => `${key}=${query[key]}`)
      .join('&');
    
    const baseKey = `${method}:${path}`;
    const fullKey = queryString ? `${baseKey}?${queryString}` : baseKey;
    
    return `${tenantId}:${fullKey}`;
  }

  /**
   * Determine cache category based on request
   */
  _getCacheCategory(req) {
    const { path } = req;
    
    if (path.includes('/images')) return 'images';
    if (path.includes('/search')) return 'search';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/categories')) return 'catalog';
    
    return 'products';
  }

  /**
   * Check if request should be cached
   */
  _shouldCache(req, res) {
    // Only cache GET requests
    if (req.method !== 'GET') return false;
    
    // Don't cache if response has errors
    if (res.statusCode >= 400) return false;
    
    // Don't cache admin or internal endpoints
    if (req.path.includes('/admin') || req.path.includes('/internal')) return false;
    
    // Don't cache real-time data endpoints
    if (req.path.includes('/live') || req.path.includes('/realtime')) return false;
    
    return true;
  }

  /**
   * Extract cache control headers
   */
  _getCacheControl(req) {
    const cacheControl = req.headers['cache-control'];
    if (!cacheControl) return {};
    
    const directives = {};
    cacheControl.split(',').forEach(directive => {
      const [key, value] = directive.trim().split('=');
      directives[key] = value ? parseInt(value) : true;
    });
    
    return directives;
  }

  /**
   * Cache GET middleware
   */
  cacheGet() {
    return async (req, res, next) => {
      // Skip caching if not GET request
      if (req.method !== 'GET') return next();
      
      try {
        await this._ensureInitialized();
        
        const cacheKey = this._generateCacheKey(req);
        const category = this._getCacheCategory(req);
        const cacheControl = this._getCacheControl(req);
        
        // Check for no-cache directive
        if (cacheControl['no-cache']) return next();
        
        // Try to get from cache
        const cachedResponse = await this.cache.get(cacheKey, category);
        
        if (cachedResponse) {
          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-Category': category
          });
          
          // Set appropriate cache control headers
          const ttl = await this.cache.ttl(cacheKey, category);
          if (ttl > 0) {
            res.set('Cache-Control', `public, max-age=${ttl}`);
          }
          
          return res.json(cachedResponse);
        }
        
        // Cache miss - continue to actual handler
        res.set('X-Cache', 'MISS');
        
        // Store original res.json to intercept response
        const originalJson = res.json;
        res.json = function(data) {
          // Cache the response if appropriate
          if (this.statusCode < 400) {
            const shouldCache = req.app.locals.cacheMiddleware._shouldCache(req, res);
            if (shouldCache) {
              req.app.locals.cacheMiddleware.cache.set(cacheKey, data, category);
            }
          }
          
          // Add cache headers
          res.set({
            'X-Cache-Key': cacheKey,
            'X-Cache-Category': category
          });
          
          // Call original json method
          return originalJson.call(this, data);
        };
        
        next();
      } catch (error) {
        req.logger?.error('Cache middleware error', {
          error: error.message,
          path: req.path
        });
        next();
      }
    };
  }

  /**
   * Cache invalidation middleware for write operations
   */
  invalidateCache() {
    return async (req, res, next) => {
      // Store original response methods
      const originalJson = res.json;
      const originalSend = res.send;
      
      // Intercept successful responses to invalidate cache
      const invalidateOnSuccess = async () => {
        if (res.statusCode < 400) {
          try {
            await this._ensureInitialized();
            await this._invalidateRelatedCache(req);
          } catch (error) {
            req.logger?.error('Cache invalidation error', {
              error: error.message,
              path: req.path
            });
          }
        }
      };
      
      res.json = function(data) {
        invalidateOnSuccess();
        return originalJson.call(this, data);
      };
      
      res.send = function(data) {
        invalidateOnSuccess();
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Invalidate related cache entries based on request
   */
  async _invalidateRelatedCache(req) {
    const { path, method } = req;
    const tenantId = req.headers['x-tenant-id'] || 'default';
    
    // Product-related invalidations
    if (path.includes('/products')) {
      const productId = this._extractProductId(req);
      
      if (productId) {
        // Invalidate specific product cache
        await this.cache.del(`${tenantId}:GET:/api/products/${productId}`, 'products');
        
        // Invalidate product images cache
        await this.cache.del(`${tenantId}:GET:/api/products/${productId}/images`, 'images');
      }
      
      // Invalidate product lists and search results
      await this.cache.invalidateCategory('products');
      await this.cache.invalidateCategory('search');
    }
    
    // Category-related invalidations
    if (path.includes('/categories')) {
      await this.cache.invalidateCategory('catalog');
      await this.cache.invalidateCategory('products');
    }
    
    // Stock-related invalidations
    if (path.includes('/stock')) {
      await this.cache.invalidateCategory('products');
      await this.cache.invalidateCategory('analytics');
    }
    
    // Analytics invalidations
    if (path.includes('/analytics') && method !== 'GET') {
      await this.cache.invalidateCategory('analytics');
    }
  }

  /**
   * Extract product ID from request
   */
  _extractProductId(req) {
    const matches = req.path.match(/\/products\/(\d+)/);
    return matches ? matches[1] : null;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(db) {
    try {
      await this._ensureInitialized();
      
      // Warm up with popular products
      const popularProducts = await db('products')
        .where('is_active', true)
        .orderBy('views_count', 'desc')
        .limit(50);
      
      const warmupData = {
        products: {}
      };
      
      for (const product of popularProducts) {
        const key = `GET:/api/products/${product.id}`;
        warmupData.products[key] = product;
      }
      
      // Warm up with categories
      const categories = await db('categories')
        .where('is_active', true)
        .orderBy('sort_order');
      
      warmupData.catalog = {
        'GET:/api/categories': categories
      };
      
      await this.cache.warmUp(warmupData);
      
      return true;
    } catch (error) {
      console.error('Cache warmup failed:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      await this._ensureInitialized();
      return await this.cache.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Manual cache invalidation endpoint
   */
  adminInvalidate() {
    return async (req, res) => {
      try {
        await this._ensureInitialized();
        
        const { category, key } = req.body;
        
        if (key) {
          // Invalidate specific key
          const deleted = await this.cache.del(key, category || 'general');
          res.json({
            success: true,
            message: `Cache key ${deleted ? 'deleted' : 'not found'}`,
            key,
            category
          });
        } else if (category) {
          // Invalidate entire category
          await this.cache.invalidateCategory(category);
          res.json({
            success: true,
            message: `Category '${category}' cache invalidated`,
            category
          });
        } else {
          // Invalid request
          res.status(400).json({
            success: false,
            error: 'Either key or category must be provided'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    };
  }

  /**
   * Cache health check endpoint
   */
  healthCheck() {
    return async (req, res) => {
      try {
        await this._ensureInitialized();
        const health = await this.cache.healthCheck();
        
        res.json({
          service: 'cache',
          ...health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          service: 'cache',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}

module.exports = ProductCacheMiddleware;