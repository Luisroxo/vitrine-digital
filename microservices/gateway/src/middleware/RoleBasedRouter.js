const { Logger } = require('../../../shared');

/**
 * Role-based Routing Middleware for fine-grained access control
 */
class RoleBasedRouter {
  constructor() {
    this.logger = new Logger('role-based-router');
    
    // Route configurations with role requirements
    this.routeConfig = new Map();
    
    // Default role hierarchy
    this.roleHierarchy = {
      'super_admin': ['admin', 'manager', 'lojista', 'user'],
      'admin': ['manager', 'lojista', 'user'],
      'manager': ['lojista', 'user'],
      'lojista': ['user'],
      'user': []
    };

    this.initializeDefaultRoutes();
    
    this.logger.info('Role-based router initialized');
  }

  /**
   * Initialize default route configurations
   */
  initializeDefaultRoutes() {
    // Auth service routes
    this.addRouteRule('/auth/register', ['public']);
    this.addRouteRule('/auth/login', ['public']);
    this.addRouteRule('/auth/forgot-password', ['public']);
    this.addRouteRule('/auth/reset-password', ['public']);
    this.addRouteRule('/auth/refresh', ['user']);
    this.addRouteRule('/auth/logout', ['user']);
    this.addRouteRule('/auth/me', ['user']);
    this.addRouteRule('/auth/validate', ['admin', 'manager']);

    // Product service routes
    this.addRouteRule('/products', { GET: ['public'], POST: ['admin', 'manager'], PUT: ['admin', 'manager'], DELETE: ['admin'] });
    this.addRouteRule('/products/*/analytics', ['admin', 'manager']);
    this.addRouteRule('/products/search', ['public']);
    this.addRouteRule('/products/categories', ['public']);

    // Bling service routes
    this.addRouteRule('/bling/auth', ['lojista', 'admin']);
    this.addRouteRule('/bling/callback', ['lojista', 'admin']);
    this.addRouteRule('/bling/products/sync', ['lojista', 'admin']);
    this.addRouteRule('/bling/orders', ['lojista', 'admin']);
    this.addRouteRule('/bling/webhooks/*', ['public']); // Webhooks need special handling

    // Billing service routes
    this.addRouteRule('/billing/credits', ['lojista']);
    this.addRouteRule('/billing/purchases', ['lojista']);
    this.addRouteRule('/billing/plans', ['public']);
    this.addRouteRule('/billing/subscriptions', ['lojista']);
    this.addRouteRule('/billing/admin/*', ['admin']);

    // Gateway management routes
    this.addRouteRule('/health', ['public']);
    this.addRouteRule('/status', ['admin']);
    this.addRouteRule('/metrics', ['admin']);
    this.addRouteRule('/circuit-breaker', ['admin']);

    this.logger.info('Default route rules initialized', {
      totalRoutes: this.routeConfig.size
    });
  }

  /**
   * Add route access rule
   */
  addRouteRule(pattern, config) {
    // Convert string pattern to regex
    const regexPattern = this.patternToRegex(pattern);
    
    // Normalize config
    let normalizedConfig;
    
    if (Array.isArray(config)) {
      // Simple array of roles applies to all methods
      normalizedConfig = {
        '*': config
      };
    } else if (typeof config === 'object') {
      // Method-specific configuration
      normalizedConfig = config;
    } else {
      throw new Error('Invalid route configuration');
    }

    this.routeConfig.set(pattern, {
      pattern: regexPattern,
      config: normalizedConfig,
      originalPattern: pattern
    });

    this.logger.info('Route rule added', {
      pattern,
      config: normalizedConfig
    });
  }

  /**
   * Convert route pattern to regex
   */
  patternToRegex(pattern) {
    // Convert Express-style patterns to regex
    let regexStr = pattern
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\//g, '\\/') // Escape forward slashes
      .replace(/:\w+/g, '[^/]+'); // :param matches path segments

    // Ensure exact match
    regexStr = `^${regexStr}$`;
    
    return new RegExp(regexStr, 'i');
  }

  /**
   * Find matching route configuration
   */
  findRouteConfig(path, method = 'GET') {
    for (const [pattern, config] of this.routeConfig.entries()) {
      if (config.pattern.test(path)) {
        const methodConfig = config.config[method] || config.config['*'];
        
        if (methodConfig) {
          return {
            pattern: config.originalPattern,
            roles: methodConfig,
            method
          };
        }
      }
    }

    // Default: require authentication for unmatched routes
    return {
      pattern: 'default',
      roles: ['user'],
      method
    };
  }

  /**
   * Check if user role has access to required roles
   */
  hasRoleAccess(userRole, requiredRoles) {
    // Public access
    if (requiredRoles.includes('public')) {
      return true;
    }

    // No user role but authentication required
    if (!userRole) {
      return false;
    }

    // Direct role match
    if (requiredRoles.includes(userRole)) {
      return true;
    }

    // Check role hierarchy
    const userPermissions = this.roleHierarchy[userRole] || [];
    return requiredRoles.some(role => userPermissions.includes(role));
  }

  /**
   * Check tenant-specific access
   */
  checkTenantAccess(userPayload, resourceTenantId) {
    // Super admin can access all tenants
    if (userPayload?.role === 'super_admin') {
      return true;
    }

    // Admin can access multiple tenants (based on permissions)
    if (userPayload?.role === 'admin' && userPayload?.allowedTenants) {
      return userPayload.allowedTenants.includes(resourceTenantId);
    }

    // Regular users can only access their own tenant
    return userPayload?.tenantId === resourceTenantId;
  }

  /**
   * Check API rate limits based on role
   */
  getRoleRateLimit(userRole) {
    const rateLimits = {
      'super_admin': { windowMs: 60000, max: 10000 }, // 10k/min
      'admin': { windowMs: 60000, max: 5000 },        // 5k/min
      'manager': { windowMs: 60000, max: 2000 },      // 2k/min
      'lojista': { windowMs: 60000, max: 1000 },      // 1k/min
      'user': { windowMs: 60000, max: 500 },          // 500/min
      'public': { windowMs: 60000, max: 100 }         // 100/min
    };

    return rateLimits[userRole] || rateLimits['public'];
  }

  /**
   * Create role-based routing middleware
   */
  middleware() {
    return (req, res, next) => {
      try {
        const path = req.path;
        const method = req.method;
        
        // Find route configuration
        const routeConfig = this.findRouteConfig(path, method);
        
        // Extract user info from request (set by auth middleware)
        const userRole = req.userRole || null;
        const userPayload = req.user || null;
        
        this.logger.debug('Route access check', {
          path,
          method,
          userRole,
          requiredRoles: routeConfig.roles,
          pattern: routeConfig.pattern,
          correlationId: req.correlationId
        });

        // Check role access
        if (!this.hasRoleAccess(userRole, routeConfig.roles)) {
          this.logger.warn('Access denied - insufficient role', {
            path,
            method,
            userRole,
            requiredRoles: routeConfig.roles,
            userId: userPayload?.sub,
            correlationId: req.correlationId
          });

          return res.status(403).json({
            error: 'Access denied',
            code: 'INSUFFICIENT_ROLE',
            required: routeConfig.roles,
            current: userRole || 'anonymous',
            path,
            method
          });
        }

        // Check tenant access for tenant-specific routes
        if (req.query.tenantId || req.body?.tenantId || req.params?.tenantId) {
          const resourceTenantId = parseInt(
            req.query.tenantId || req.body?.tenantId || req.params?.tenantId
          );

          if (resourceTenantId && !this.checkTenantAccess(userPayload, resourceTenantId)) {
            this.logger.warn('Access denied - tenant isolation violation', {
              path,
              method,
              userRole,
              userId: userPayload?.sub,
              userTenantId: userPayload?.tenantId,
              resourceTenantId,
              correlationId: req.correlationId
            });

            return res.status(403).json({
              error: 'Access denied',
              code: 'TENANT_ACCESS_VIOLATION',
              message: 'You can only access resources from your own tenant'
            });
          }
        }

        // Add route info to request for downstream services
        req.routeConfig = routeConfig;
        req.requiredRoles = routeConfig.roles;

        next();

      } catch (error) {
        this.logger.error('Role-based routing error', {
          error: error.message,
          path: req.path,
          method: req.method,
          correlationId: req.correlationId
        });

        res.status(500).json({
          error: 'Internal routing error',
          code: 'ROUTING_ERROR'
        });
      }
    };
  }

  /**
   * Create role-specific rate limiter
   */
  createRoleRateLimiter(rateLimit) {
    return (req, res, next) => {
      const userRole = req.userRole || 'public';
      const limits = this.getRoleRateLimit(userRole);
      
      // Create dynamic rate limiter
      const limiter = rateLimit({
        windowMs: limits.windowMs,
        max: limits.max,
        keyGenerator: (req) => {
          // Create key based on user ID or IP
          return req.user?.sub || req.ip;
        },
        message: {
          error: 'Rate limit exceeded for your role',
          code: 'ROLE_RATE_LIMIT_EXCEEDED',
          role: userRole,
          limit: limits.max,
          windowMs: limits.windowMs
        },
        handler: (req, res) => {
          this.logger.warn('Role-based rate limit exceeded', {
            userRole,
            userId: req.user?.sub,
            ip: req.ip,
            path: req.path,
            limit: limits.max
          });

          res.status(429).json({
            error: 'Rate limit exceeded for your role',
            code: 'ROLE_RATE_LIMIT_EXCEEDED',
            role: userRole,
            limit: limits.max,
            windowMs: limits.windowMs,
            retryAfter: Math.ceil(limits.windowMs / 1000)
          });
        }
      });

      limiter(req, res, next);
    };
  }

  /**
   * Get route statistics
   */
  getStats() {
    const stats = {
      totalRoutes: this.routeConfig.size,
      roleHierarchy: this.roleHierarchy,
      routes: {}
    };

    this.routeConfig.forEach((config, pattern) => {
      stats.routes[pattern] = {
        pattern: config.originalPattern,
        config: config.config
      };
    });

    return stats;
  }

  /**
   * Update role hierarchy
   */
  updateRoleHierarchy(newHierarchy) {
    this.roleHierarchy = { ...this.roleHierarchy, ...newHierarchy };
    
    this.logger.info('Role hierarchy updated', {
      roles: Object.keys(this.roleHierarchy)
    });
  }

  /**
   * Remove route rule
   */
  removeRouteRule(pattern) {
    const removed = this.routeConfig.delete(pattern);
    
    if (removed) {
      this.logger.info('Route rule removed', { pattern });
    }
    
    return removed;
  }
}

module.exports = RoleBasedRouter;