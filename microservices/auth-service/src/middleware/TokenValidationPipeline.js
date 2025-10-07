const { JWTUtils } = require('../../../shared');

class TokenValidationPipeline {
  constructor(authServiceUrl = 'http://auth-service:3001') {
    this.authServiceUrl = authServiceUrl;
    this.jwtUtils = new JWTUtils();
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Middleware para validação completa de token
   */
  createValidationMiddleware() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
          });
        }

        // Step 1: Verificar formato e assinatura do JWT
        const decodedToken = await this.validateTokenFormat(token);
        
        if (!decodedToken) {
          return res.status(401).json({
            error: 'Unauthorized', 
            message: 'Invalid token format'
          });
        }

        // Step 2: Verificar cache de tokens válidos
        const cachedValidation = this.getCachedValidation(token);
        if (cachedValidation) {
          req.user = cachedValidation.user;
          req.permissions = cachedValidation.permissions;
          return next();
        }

        // Step 3: Validar com Auth Service (se não estiver em cache)
        const validation = await this.validateWithAuthService(token, req.headers['x-tenant-id']);
        
        if (!validation.valid) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: validation.reason || 'Token validation failed'
          });
        }

        // Step 4: Cache do resultado
        this.cacheValidation(token, validation);

        // Step 5: Adicionar dados do usuário ao request
        req.user = validation.user;
        req.permissions = validation.permissions;

        next();
      } catch (error) {
        console.error('Token validation pipeline error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Token validation failed'
        });
      }
    };
  }

  /**
   * Extrair token do header Authorization
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Remove "Bearer "
  }

  /**
   * Validar formato e assinatura do JWT localmente
   */
  async validateTokenFormat(token) {
    try {
      const decoded = await this.jwtUtils.verifyToken(token);
      
      // Verificar campos obrigatórios
      if (!decoded.userId || !decoded.tenantId || !decoded.role) {
        return null;
      }

      // Verificar expiração
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verificar cache de validações
   */
  getCachedValidation(token) {
    const cached = this.cache.get(token);
    
    if (!cached) {
      return null;
    }

    // Verificar se cache expirou
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(token);
      return null;
    }

    return cached.data;
  }

  /**
   * Validar token com Auth Service
   */
  async validateWithAuthService(token, tenantId) {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'Authorization': `Bearer ${token}`
        },
        timeout: 3000 // 3 second timeout
      });

      if (!response.ok) {
        return {
          valid: false,
          reason: `Auth service returned ${response.status}`
        };
      }

      const result = await response.json();
      return {
        valid: true,
        user: result.user,
        permissions: result.permissions || []
      };
    } catch (error) {
      console.error('Auth service validation error:', error);
      return {
        valid: false,
        reason: 'Auth service unreachable'
      };
    }
  }

  /**
   * Cache do resultado da validação
   */
  cacheValidation(token, validation) {
    this.cache.set(token, {
      data: validation,
      expiresAt: Date.now() + this.cacheTimeout
    });

    // Limpar cache periodicamente
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Limpar cache expirado
   */
  cleanupCache() {
    const now = Date.now();
    
    for (const [token, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(token);
      }
    }
  }

  /**
   * Middleware para verificar permissões específicas
   */
  requirePermissions(requiredPermissions) {
    return (req, res, next) => {
      if (!req.user || !req.permissions) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const userPermissions = req.permissions.map(p => p.name || p);
      const hasPermission = requiredPermissions.every(permission => 
        userPermissions.includes(permission) || req.user.role === 'admin'
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          required: requiredPermissions,
          current: userPermissions
        });
      }

      next();
    };
  }

  /**
   * Middleware para verificar roles específicos
   */
  requireRoles(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied for this role',
          required: allowedRoles,
          current: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Middleware para verificar ownership de tenant
   */
  requireTenantAccess() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const requestTenantId = parseInt(req.headers['x-tenant-id']);
      const userTenantId = req.user.tenant_id;

      // Admin pode acessar qualquer tenant
      if (req.user.role === 'admin') {
        return next();
      }

      // Verificar se usuário pertence ao tenant
      if (userTenantId !== requestTenantId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this tenant',
          userTenant: userTenantId,
          requestedTenant: requestTenantId
        });
      }

      next();
    };
  }

  /**
   * Middleware para logging de acesso
   */
  createAccessLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          user: req.user ? req.user.id : 'anonymous',
          tenant: req.headers['x-tenant-id'],
          ip: req.ip,
          userAgent: req.get('User-Agent')
        };

        console.log('API Access:', JSON.stringify(logData));
      });

      next();
    };
  }

  /**
   * Endpoint para validação de token (usado pelo pipeline)
   */
  createValidationEndpoint(authController) {
    return async (req, res) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            error: 'No token provided'
          });
        }

        const decodedToken = await this.validateTokenFormat(token);
        
        if (!decodedToken) {
          return res.status(401).json({
            error: 'Invalid token'
          });
        }

        // Buscar dados atualizados do usuário
        const user = await authController.getUserById(decodedToken.userId, decodedToken.tenantId);
        
        if (!user || !user.is_active) {
          return res.status(401).json({
            error: 'User not found or inactive'
          });
        }

        // Buscar permissões do usuário
        const permissions = await authController.getUserPermissions(user.id, user.tenant_id);

        res.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            is_active: user.is_active
          },
          permissions
        });
      } catch (error) {
        console.error('Token validation endpoint error:', error);
        res.status(500).json({
          error: 'Validation failed'
        });
      }
    };
  }
}

module.exports = TokenValidationPipeline;