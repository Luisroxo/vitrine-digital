const jwt = require('jsonwebtoken');
const { Logger } = require('../../../shared');

/**
 * Enhanced JWT Validation Pipeline with role-based access control
 */
class JWTValidationPipeline {
  constructor(options = {}) {
    this.logger = new Logger('jwt-validation');
    
    this.config = {
      secret: process.env.JWT_SECRET || 'your-secret-key',
      algorithm: options.algorithm || 'HS256',
      issuer: options.issuer || 'vitrine-digital',
      audience: options.audience || 'vitrine-digital-users',
      clockTolerance: options.clockTolerance || 60, // 60 seconds
      ignoreExpiration: options.ignoreExpiration || false,
      cacheTTL: options.cacheTTL || 300 // 5 minutes cache for validation results
    };

    // Token cache for performance
    this.tokenCache = new Map();
    this.blacklistedTokens = new Set();
    
    this.logger.info('JWT validation pipeline initialized', {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience
    });
  }

  /**
   * Validate JWT token with comprehensive checks
   */
  async validateToken(token, options = {}) {
    const correlationId = options.correlationId || 'unknown';
    
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      // Check cache first
      const cacheKey = `token:${token}`;
      const cached = this.tokenCache.get(cacheKey);
      
      if (cached && cached.expires > Date.now()) {
        this.logger.debug('Token validation from cache', { 
          userId: cached.payload.sub,
          correlationId 
        });
        return cached.payload;
      }

      // Verify token
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: this.config.clockTolerance,
        ignoreExpiration: this.config.ignoreExpiration
      });

      // Additional payload validation
      this.validatePayload(payload);

      // Cache valid token
      this.tokenCache.set(cacheKey, {
        payload,
        expires: Date.now() + (this.config.cacheTTL * 1000)
      });

      this.logger.debug('Token validated successfully', {
        userId: payload.sub,
        role: payload.role,
        tenantId: payload.tenantId,
        correlationId
      });

      return payload;

    } catch (error) {
      this.logger.warn('Token validation failed', {
        error: error.message,
        correlationId
      });
      throw error;
    }
  }

  /**
   * Validate JWT payload structure and required fields
   */
  validatePayload(payload) {
    const requiredFields = ['sub', 'iat', 'exp', 'iss', 'aud'];
    
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate user ID format
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new Error('Invalid user ID format');
    }

    // Validate role if present
    if (payload.role && typeof payload.role !== 'string') {
      throw new Error('Invalid role format');
    }

    // Validate tenant ID if present
    if (payload.tenantId && typeof payload.tenantId !== 'number') {
      throw new Error('Invalid tenant ID format');
    }

    // Check token age (not too old)
    const tokenAge = Date.now() / 1000 - payload.iat;
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    
    if (tokenAge > maxAge) {
      throw new Error('Token is too old');
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(userPayload, requiredRole) {
    if (!userPayload.role) {
      return false;
    }

    // Admin can access everything
    if (userPayload.role === 'admin') {
      return true;
    }

    // Exact role match
    if (userPayload.role === requiredRole) {
      return true;
    }

    // Role hierarchy check
    const roleHierarchy = {
      'super_admin': ['admin', 'manager', 'user', 'lojista'],
      'admin': ['manager', 'user', 'lojista'],
      'manager': ['user', 'lojista'],
      'lojista': ['user'],
      'user': []
    };

    const userRoles = roleHierarchy[userPayload.role] || [];
    return userRoles.includes(requiredRole);
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(userPayload, requiredRoles) {
    if (!Array.isArray(requiredRoles)) {
      return this.hasRole(userPayload, requiredRoles);
    }

    return requiredRoles.some(role => this.hasRole(userPayload, role));
  }

  /**
   * Check if user has required permission
   */
  hasPermission(userPayload, requiredPermission) {
    if (!userPayload.permissions || !Array.isArray(userPayload.permissions)) {
      return false;
    }

    return userPayload.permissions.includes(requiredPermission);
  }

  /**
   * Check tenant isolation - user can only access their tenant data
   */
  checkTenantAccess(userPayload, resourceTenantId) {
    // Super admin can access all tenants
    if (userPayload.role === 'super_admin') {
      return true;
    }

    // User must belong to the same tenant
    if (userPayload.tenantId !== resourceTenantId) {
      this.logger.warn('Tenant access violation', {
        userId: userPayload.sub,
        userTenantId: userPayload.tenantId,
        resourceTenantId
      });
      return false;
    }

    return true;
  }

  /**
   * Create authentication middleware
   */
  createAuthMiddleware(options = {}) {
    const { 
      optional = false,
      requiredRole = null,
      requiredPermissions = [],
      checkTenant = true
    } = options;

    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader && optional) {
          return next();
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Missing or invalid authorization header',
            code: 'UNAUTHORIZED'
          });
        }

        const token = authHeader.substring(7); // Remove "Bearer "
        
        // Validate token
        const payload = await this.validateToken(token, {
          correlationId: req.correlationId || req.get('x-correlation-id')
        });

        // Check required role
        if (requiredRole && !this.hasRole(payload, requiredRole)) {
          this.logger.warn('Insufficient role', {
            userId: payload.sub,
            userRole: payload.role,
            requiredRole
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            required: requiredRole,
            current: payload.role
          });
        }

        // Check required permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = requiredPermissions.every(perm => 
            this.hasPermission(payload, perm)
          );
          
          if (!hasPermission) {
            return res.status(403).json({
              error: 'Missing required permissions',
              code: 'FORBIDDEN',
              required: requiredPermissions
            });
          }
        }

        // Add user info to request
        req.user = payload;
        req.userId = payload.sub;
        req.userRole = payload.role;
        req.tenantId = payload.tenantId;

        // Add tenant check helper
        if (checkTenant) {
          req.checkTenantAccess = (resourceTenantId) => {
            return this.checkTenantAccess(payload, resourceTenantId);
          };
        }

        next();

      } catch (error) {
        this.logger.error('Authentication failed', {
          error: error.message,
          url: req.url,
          method: req.method,
          correlationId: req.correlationId || req.get('x-correlation-id')
        });

        const status = error.name === 'TokenExpiredError' ? 401 : 401;
        const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';

        res.status(status).json({
          error: error.message,
          code,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Revoke token (add to blacklist)
   */
  revokeToken(token) {
    this.blacklistedTokens.add(token);
    this.tokenCache.delete(`token:${token}`);
    
    this.logger.info('Token revoked', {
      tokenHash: this.hashToken(token)
    });
  }

  /**
   * Clear expired tokens from cache
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.tokenCache.entries()) {
      if (value.expires <= now) {
        this.tokenCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cache cleanup completed', {
        cleanedEntries: cleanedCount,
        remainingEntries: this.tokenCache.size
      });
    }
  }

  /**
   * Hash token for logging (security)
   */
  hashToken(token) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      cacheSize: this.tokenCache.size,
      blacklistedTokens: this.blacklistedTokens.size,
      config: {
        algorithm: this.config.algorithm,
        issuer: this.config.issuer,
        audience: this.config.audience,
        cacheTTL: this.config.cacheTTL
      }
    };
  }
}

module.exports = JWTValidationPipeline;