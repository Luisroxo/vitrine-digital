const { Logger } = require('../../../shared');
const BlingAPI = require('./BlingAPI');

/**
 * Multi-tenant Token Management Service for Bling ERP integration
 */
class BlingTokenManager {
  constructor(database) {
    this.logger = new Logger('bling-token-manager');
    this.db = database;
    this.tokens = new Map(); // In-memory cache
    this.refreshQueue = new Set(); // Prevent concurrent refreshes
    
    // Configuration
    this.config = {
      tokenExpiryBuffer: 5 * 60 * 1000, // 5 minutes buffer before expiry
      maxRetries: 3,
      retryDelay: 1000,
      cacheTimeout: 30 * 60 * 1000, // 30 minutes cache
      cleanupInterval: 10 * 60 * 1000 // 10 minutes cleanup
    };

    this.startCleanupTimer();
    this.logger.info('Bling token manager initialized', this.config);
  }

  /**
   * Get valid token for tenant
   */
  async getValidToken(tenantId) {
    try {
      // Check cache first
      const cachedToken = this.tokens.get(tenantId);
      if (cachedToken && this.isTokenValid(cachedToken)) {
        this.logger.debug('Token retrieved from cache', { tenantId });
        return cachedToken.access_token;
      }

      // Get from database
      const tokenRecord = await this.getTokenFromDatabase(tenantId);
      
      if (!tokenRecord) {
        throw new Error(`No Bling token found for tenant ${tenantId}`);
      }

      // Check if token needs refresh
      if (this.isTokenExpired(tokenRecord)) {
        this.logger.info('Token expired, refreshing', { 
          tenantId,
          expiresAt: tokenRecord.expires_at 
        });
        
        return await this.refreshToken(tenantId, tokenRecord);
      }

      // Cache valid token
      this.cacheToken(tenantId, tokenRecord);
      return tokenRecord.access_token;

    } catch (error) {
      this.logger.error('Failed to get valid token', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Store new token for tenant
   */
  async storeToken(tenantId, tokenData) {
    try {
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
      
      const tokenRecord = {
        tenant_id: tenantId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in,
        expires_at: expiresAt,
        scope: tokenData.scope,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Store in database
      await this.db('bling_tokens')
        .insert(tokenRecord)
        .onConflict('tenant_id')
        .merge(['access_token', 'refresh_token', 'expires_at', 'updated_at']);

      // Cache token
      this.cacheToken(tenantId, tokenRecord);

      this.logger.info('Token stored successfully', {
        tenantId,
        expiresAt: expiresAt.toISOString()
      });

      return tokenRecord;

    } catch (error) {
      this.logger.error('Failed to store token', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Refresh expired token
   */
  async refreshToken(tenantId, tokenRecord = null) {
    // Prevent concurrent refresh attempts
    const refreshKey = `refresh:${tenantId}`;
    if (this.refreshQueue.has(refreshKey)) {
      this.logger.debug('Token refresh already in progress', { tenantId });
      
      // Wait for refresh to complete
      await this.waitForRefresh(refreshKey);
      return await this.getValidToken(tenantId);
    }

    this.refreshQueue.add(refreshKey);

    try {
      // Get token record if not provided
      if (!tokenRecord) {
        tokenRecord = await this.getTokenFromDatabase(tenantId);
      }

      if (!tokenRecord || !tokenRecord.refresh_token) {
        throw new Error('No refresh token available for tenant');
      }

      this.logger.info('Refreshing Bling token', { tenantId });

      // Call Bling API to refresh token
      const blingAPI = new BlingAPI();
      const newTokenData = await blingAPI.refreshToken(tokenRecord.refresh_token);

      // Store new token
      const newTokenRecord = await this.storeToken(tenantId, newTokenData);

      this.logger.info('Token refreshed successfully', {
        tenantId,
        newExpiresAt: newTokenRecord.expires_at
      });

      return newTokenRecord.access_token;

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error.message,
        tenantId
      });

      // If refresh fails, invalidate cached token
      this.tokens.delete(tenantId);

      throw new Error(`Failed to refresh token for tenant ${tenantId}: ${error.message}`);
    } finally {
      this.refreshQueue.delete(refreshKey);
    }
  }

  /**
   * Revoke token for tenant (logout)
   */
  async revokeToken(tenantId) {
    try {
      // Remove from cache
      this.tokens.delete(tenantId);

      // Remove from database
      await this.db('bling_tokens')
        .where('tenant_id', tenantId)
        .del();

      this.logger.info('Token revoked', { tenantId });

    } catch (error) {
      this.logger.error('Failed to revoke token', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get token from database
   */
  async getTokenFromDatabase(tenantId) {
    try {
      const tokenRecord = await this.db('bling_tokens')
        .where('tenant_id', tenantId)
        .first();

      return tokenRecord || null;
    } catch (error) {
      this.logger.error('Failed to get token from database', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Check if token is valid (not expired and has buffer)
   */
  isTokenValid(tokenRecord) {
    if (!tokenRecord || !tokenRecord.expires_at) {
      return false;
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    const bufferTime = new Date(Date.now() + this.config.tokenExpiryBuffer);

    return expiresAt > bufferTime;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokenRecord) {
    if (!tokenRecord || !tokenRecord.expires_at) {
      return true;
    }

    return new Date(tokenRecord.expires_at) <= new Date();
  }

  /**
   * Cache token in memory
   */
  cacheToken(tenantId, tokenRecord) {
    this.tokens.set(tenantId, {
      ...tokenRecord,
      cachedAt: Date.now()
    });
  }

  /**
   * Wait for concurrent refresh to complete
   */
  async waitForRefresh(refreshKey, maxWait = 10000) {
    const startTime = Date.now();
    
    while (this.refreshQueue.has(refreshKey)) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Timeout waiting for token refresh');
      }
      
      await this.sleep(100);
    }
  }

  /**
   * Get all tokens status for monitoring
   */
  async getTokensStatus() {
    try {
      const tokens = await this.db('bling_tokens')
        .select('tenant_id', 'expires_at', 'created_at', 'updated_at')
        .orderBy('tenant_id');

      const status = tokens.map(token => ({
        tenantId: token.tenant_id,
        expiresAt: token.expires_at,
        isExpired: this.isTokenExpired(token),
        needsRefresh: !this.isTokenValid(token),
        lastUpdated: token.updated_at,
        cached: this.tokens.has(token.tenant_id)
      }));

      return {
        total: tokens.length,
        expired: status.filter(t => t.isExpired).length,
        needsRefresh: status.filter(t => t.needsRefresh).length,
        cached: status.filter(t => t.cached).length,
        tokens: status
      };

    } catch (error) {
      this.logger.error('Failed to get tokens status', error);
      throw error;
    }
  }

  /**
   * Cleanup expired tokens and cache
   */
  async cleanup() {
    try {
      this.logger.debug('Starting token cleanup');

      // Clean cache
      let cleanedCache = 0;
      const now = Date.now();
      
      for (const [tenantId, tokenRecord] of this.tokens.entries()) {
        const cacheAge = now - (tokenRecord.cachedAt || 0);
        
        if (cacheAge > this.config.cacheTimeout || this.isTokenExpired(tokenRecord)) {
          this.tokens.delete(tenantId);
          cleanedCache++;
        }
      }

      // Clean database (optional - keep for audit)
      const expiredCount = await this.db('bling_tokens')
        .where('expires_at', '<', new Date(now - 7 * 24 * 60 * 60 * 1000)) // 7 days old
        .count('* as count')
        .first();

      this.logger.debug('Token cleanup completed', {
        cleanedCache,
        expiredInDb: expiredCount?.count || 0,
        currentCacheSize: this.tokens.size
      });

    } catch (error) {
      this.logger.error('Token cleanup failed', error);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    this.logger.debug('Cleanup timer started', {
      interval: this.config.cleanupInterval
    });
  }

  /**
   * Proactively refresh tokens that will expire soon
   */
  async proactiveRefresh() {
    try {
      const soonToExpire = await this.db('bling_tokens')
        .where('expires_at', '>', new Date())
        .where('expires_at', '<', new Date(Date.now() + this.config.tokenExpiryBuffer * 2))
        .select('tenant_id', 'refresh_token');

      this.logger.info('Starting proactive token refresh', {
        count: soonToExpire.length
      });

      for (const token of soonToExpire) {
        try {
          await this.refreshToken(token.tenant_id);
          this.logger.debug('Proactively refreshed token', {
            tenantId: token.tenant_id
          });
        } catch (error) {
          this.logger.warn('Proactive refresh failed', {
            tenantId: token.tenant_id,
            error: error.message
          });
        }
      }

    } catch (error) {
      this.logger.error('Proactive refresh process failed', error);
    }
  }

  /**
   * Validate all tokens and return report
   */
  async validateAllTokens() {
    try {
      const tokens = await this.db('bling_tokens').select('*');
      const report = {
        total: tokens.length,
        valid: 0,
        expired: 0,
        needsRefresh: 0,
        errors: []
      };

      for (const token of tokens) {
        try {
          if (this.isTokenValid(token)) {
            report.valid++;
          } else if (this.isTokenExpired(token)) {
            report.expired++;
          } else {
            report.needsRefresh++;
          }
        } catch (error) {
          report.errors.push({
            tenantId: token.tenant_id,
            error: error.message
          });
        }
      }

      this.logger.info('Token validation report', report);
      return report;

    } catch (error) {
      this.logger.error('Token validation failed', error);
      throw error;
    }
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      cacheSize: this.tokens.size,
      refreshQueueSize: this.refreshQueue.size,
      config: this.config
    };
  }
}

module.exports = BlingTokenManager;