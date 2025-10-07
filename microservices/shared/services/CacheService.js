const Redis = require('redis');
const { Logger } = require('../../shared');

/**
 * Enhanced Caching Service with Redis
 * Supports multiple cache strategies and TTL configurations
 */
class CacheService {
  constructor(options = {}) {
    this.logger = new Logger('cache-service');
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour
    this.keyPrefix = options.keyPrefix || 'vitrine:';
    
    // Cache strategy configurations
    this.strategies = {
      products: { ttl: 1800, refresh: true }, // 30 minutes with auto-refresh
      images: { ttl: 7200, refresh: false },  // 2 hours static
      search: { ttl: 600, refresh: true },    // 10 minutes with refresh
      analytics: { ttl: 300, refresh: false }, // 5 minutes static
      sessions: { ttl: 86400, refresh: false }, // 24 hours static
      catalog: { ttl: 3600, refresh: true }   // 1 hour with refresh
    };
    
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      this.client = Redis.createClient({
        url: this.redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            this.logger.error('Redis server refused connection');
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.info('Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      this.logger.info('Redis cache service initialized');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get cache key with prefix
   */
  _getKey(key, category = 'general') {
    return `${this.keyPrefix}${category}:${key}`;
  }

  /**
   * Get TTL for category
   */
  _getTTL(category) {
    return this.strategies[category]?.ttl || this.defaultTTL;
  }

  /**
   * Check if refresh is enabled for category
   */
  _shouldRefresh(category) {
    return this.strategies[category]?.refresh || false;
  }

  /**
   * Set cache value with category-specific TTL
   */
  async set(key, value, category = 'general', customTTL = null) {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this._getKey(key, category);
      const ttl = customTTL || this._getTTL(category);
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        category: category
      });

      await this.client.setEx(cacheKey, ttl, serializedValue);
      
      this.logger.debug('Cache set', {
        key: cacheKey,
        category,
        ttl,
        size: serializedValue.length
      });
      
      return true;
    } catch (error) {
      this.logger.error('Cache set failed', {
        key,
        category,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache value with automatic refresh logic
   */
  async get(key, category = 'general') {
    if (!this.isConnected) return null;

    try {
      const cacheKey = this._getKey(key, category);
      const cached = await this.client.get(cacheKey);
      
      if (!cached) {
        this.logger.debug('Cache miss', { key: cacheKey, category });
        return null;
      }

      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      const ttl = this._getTTL(category) * 1000; // Convert to milliseconds
      
      // Check if cache is stale and needs refresh
      if (this._shouldRefresh(category) && age > (ttl * 0.8)) {
        this.logger.debug('Cache stale, scheduling refresh', {
          key: cacheKey,
          age,
          ttl
        });
        
        // Return stale data but trigger refresh in background
        this._scheduleRefresh(key, category);
        return parsed.data;
      }

      this.logger.debug('Cache hit', {
        key: cacheKey,
        category,
        age
      });
      
      return parsed.data;
    } catch (error) {
      this.logger.error('Cache get failed', {
        key,
        category,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async del(key, category = 'general') {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this._getKey(key, category);
      const result = await this.client.del(cacheKey);
      
      this.logger.debug('Cache deleted', {
        key: cacheKey,
        category,
        existed: result > 0
      });
      
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete failed', {
        key,
        category,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key, category = 'general') {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this._getKey(key, category);
      const exists = await this.client.exists(cacheKey);
      return exists > 0;
    } catch (error) {
      this.logger.error('Cache exists check failed', {
        key,
        category,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache TTL for key
   */
  async ttl(key, category = 'general') {
    if (!this.isConnected) return -1;

    try {
      const cacheKey = this._getKey(key, category);
      return await this.client.ttl(cacheKey);
    } catch (error) {
      this.logger.error('Cache TTL check failed', {
        key,
        category,
        error: error.message
      });
      return -1;
    }
  }

  /**
   * Invalidate all cache entries for a category
   */
  async invalidateCategory(category) {
    if (!this.isConnected) return false;

    try {
      const pattern = this._getKey('*', category);
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.info('Category cache invalidated', {
          category,
          keysDeleted: keys.length
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error('Category cache invalidation failed', {
        category,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.isConnected) return null;

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: this.isConnected,
        memory: this._parseInfo(info),
        keyspace: this._parseInfo(keyspace),
        strategies: this.strategies
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Parse Redis INFO response
   */
  _parseInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Schedule background refresh (placeholder for future implementation)
   */
  _scheduleRefresh(key, category) {
    // In a real implementation, this could trigger a background job
    // to refresh the cache from the original data source
    this.logger.debug('Refresh scheduled', { key, category });
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmupData = {}) {
    if (!this.isConnected) return false;

    try {
      let warmedCount = 0;
      
      for (const [category, items] of Object.entries(warmupData)) {
        for (const [key, value] of Object.entries(items)) {
          await this.set(key, value, category);
          warmedCount++;
        }
      }
      
      this.logger.info('Cache warmed up', { itemsWarmed: warmedCount });
      return true;
    } catch (error) {
      this.logger.error('Cache warmup failed', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      this.logger.info('Disconnected from Redis');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) return false;
      
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        connected: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }
}

module.exports = CacheService;