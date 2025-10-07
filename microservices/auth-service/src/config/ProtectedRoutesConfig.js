const TokenValidationPipeline = require('../middleware/TokenValidationPipeline');

class ProtectedRoutesConfig {
  constructor(authServiceUrl) {
    this.pipeline = new TokenValidationPipeline(authServiceUrl);
    this.routeConfigs = new Map();
    this.setupDefaultRoutes();
  }

  /**
   * Configurar rotas protegidas padrão
   */
  setupDefaultRoutes() {
    // Rotas públicas (sem autenticação)
    this.addPublicRoutes([
      'GET:/health',
      'POST:/auth/register',
      'POST:/auth/login',
      'POST:/auth/refresh',
      'POST:/auth/reset-password'
    ]);

    // Rotas que precisam apenas de autenticação
    this.addAuthenticatedRoutes([
      'GET:/auth/me',
      'POST:/auth/logout',
      'GET:/auth/sessions',
      'DELETE:/auth/sessions/:id'
    ]);

    // Rotas que precisam de permissões específicas
    this.addPermissionRoutes([
      { pattern: 'GET:/products', permissions: ['products.read'] },
      { pattern: 'POST:/products', permissions: ['products.create'] },
      { pattern: 'PUT:/products/:id', permissions: ['products.update'] },
      { pattern: 'DELETE:/products/:id', permissions: ['products.delete'] },
      
      { pattern: 'GET:/categories', permissions: ['categories.read'] },
      { pattern: 'POST:/categories', permissions: ['categories.create'] },
      { pattern: 'PUT:/categories/:id', permissions: ['categories.update'] },
      { pattern: 'DELETE:/categories/:id', permissions: ['categories.delete'] },
      
      { pattern: 'GET:/analytics/*', permissions: ['analytics.read'] },
      { pattern: 'POST:/analytics/*', permissions: ['analytics.write'] },
      
      { pattern: 'GET:/sync/*', permissions: ['bling.read'] },
      { pattern: 'POST:/sync/*', permissions: ['bling.write'] }
    ]);

    // Rotas que precisam de roles específicos
    this.addRoleRoutes([
      { pattern: 'POST:/tenants', roles: ['admin'] },
      { pattern: 'DELETE:/tenants/:id', roles: ['admin'] },
      { pattern: 'GET:/admin/*', roles: ['admin', 'super_admin'] },
      { pattern: 'POST:/admin/*', roles: ['admin', 'super_admin'] }
    ]);

    // Rotas que precisam verificar tenant ownership
    this.addTenantRoutes([
      'GET:/products',
      'POST:/products', 
      'PUT:/products/:id',
      'DELETE:/products/:id',
      'GET:/categories',
      'POST:/categories',
      'GET:/orders',
      'POST:/orders',
      'GET:/analytics/*',
      'POST:/sync/*'
    ]);
  }

  /**
   * Adicionar rotas públicas
   */
  addPublicRoutes(routes) {
    routes.forEach(route => {
      this.routeConfigs.set(route, {
        type: 'public',
        middleware: []
      });
    });
  }

  /**
   * Adicionar rotas que precisam apenas de autenticação
   */
  addAuthenticatedRoutes(routes) {
    routes.forEach(route => {
      this.routeConfigs.set(route, {
        type: 'authenticated',
        middleware: [
          this.pipeline.createValidationMiddleware()
        ]
      });
    });
  }

  /**
   * Adicionar rotas com permissões específicas
   */
  addPermissionRoutes(routes) {
    routes.forEach(({ pattern, permissions }) => {
      this.routeConfigs.set(pattern, {
        type: 'permission',
        permissions,
        middleware: [
          this.pipeline.createValidationMiddleware(),
          this.pipeline.requireTenantAccess(),
          this.pipeline.requirePermissions(permissions)
        ]
      });
    });
  }

  /**
   * Adicionar rotas com roles específicos
   */
  addRoleRoutes(routes) {
    routes.forEach(({ pattern, roles }) => {
      this.routeConfigs.set(pattern, {
        type: 'role',
        roles,
        middleware: [
          this.pipeline.createValidationMiddleware(),
          this.pipeline.requireRoles(roles)
        ]
      });
    });
  }

  /**
   * Adicionar rotas que precisam verificar tenant
   */
  addTenantRoutes(routes) {
    routes.forEach(route => {
      const existing = this.routeConfigs.get(route);
      if (existing) {
        // Adicionar tenant validation ao middleware existente
        existing.middleware.push(this.pipeline.requireTenantAccess());
      } else {
        this.routeConfigs.set(route, {
          type: 'tenant',
          middleware: [
            this.pipeline.createValidationMiddleware(),
            this.pipeline.requireTenantAccess()
          ]
        });
      }
    });
  }

  /**
   * Obter middleware para uma rota específica
   */
  getMiddleware(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    
    // Buscar configuração exata
    let config = this.routeConfigs.get(routeKey);
    
    if (!config) {
      // Buscar padrão com wildcards
      config = this.findWildcardMatch(routeKey);
    }

    if (!config) {
      // Padrão: rotas não configuradas precisam de autenticação
      return [
        this.pipeline.createValidationMiddleware(),
        this.pipeline.requireTenantAccess()
      ];
    }

    return config.middleware || [];
  }

  /**
   * Buscar padrão com wildcards
   */
  findWildcardMatch(routeKey) {
    for (const [pattern, config] of this.routeConfigs.entries()) {
      if (this.matchesPattern(routeKey, pattern)) {
        return config;
      }
    }
    return null;
  }

  /**
   * Verificar se rota corresponde ao padrão
   */
  matchesPattern(routeKey, pattern) {
    // Converter padrão em regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')  // * vira .*
      .replace(/:\w+/g, '[^/]+'); // :id vira [^/]+
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(routeKey);
  }

  /**
   * Middleware de configuração de rotas para Express Gateway
   */
  createGatewayMiddleware() {
    return (req, res, next) => {
      const middleware = this.getMiddleware(req.method, req.path);
      
      if (middleware.length === 0) {
        return next(); // Rota pública
      }

      // Executar middlewares sequencialmente
      let index = 0;
      
      const runNext = (error) => {
        if (error) {
          return next(error);
        }
        
        if (index >= middleware.length) {
          return next(); // Todos os middlewares executados
        }
        
        const currentMiddleware = middleware[index++];
        currentMiddleware(req, res, runNext);
      };

      runNext();
    };
  }

  /**
   * Configurar logging de acesso
   */
  enableAccessLogging() {
    return this.pipeline.createAccessLogger();
  }

  /**
   * Obter configurações de rota para debug
   */
  getRouteConfigurations() {
    const configs = {};
    
    for (const [route, config] of this.routeConfigs.entries()) {
      configs[route] = {
        type: config.type,
        permissions: config.permissions || [],
        roles: config.roles || [],
        middlewareCount: config.middleware ? config.middleware.length : 0
      };
    }

    return configs;
  }

  /**
   * Validar configuração de rota
   */
  validateRoute(method, path) {
    const middleware = this.getMiddleware(method, path);
    
    return {
      route: `${method.toUpperCase()}:${path}`,
      protected: middleware.length > 0,
      middlewareCount: middleware.length,
      type: this.getRouteType(method, path)
    };
  }

  /**
   * Obter tipo de rota
   */
  getRouteType(method, path) {
    const routeKey = `${method.toUpperCase()}:${path}`;
    const config = this.routeConfigs.get(routeKey) || this.findWildcardMatch(routeKey);
    
    return config ? config.type : 'default';
  }

  /**
   * Endpoint para listar configurações (debug)
   */
  createConfigEndpoint() {
    return (req, res) => {
      const configs = this.getRouteConfigurations();
      const totalRoutes = Object.keys(configs).length;
      const publicRoutes = Object.values(configs).filter(c => c.type === 'public').length;
      const protectedRoutes = totalRoutes - publicRoutes;

      res.json({
        summary: {
          total_routes: totalRoutes,
          public_routes: publicRoutes,
          protected_routes: protectedRoutes
        },
        configurations: configs,
        examples: {
          public: 'POST:/auth/login',
          authenticated: 'GET:/auth/me',
          permission: 'POST:/products',
          role: 'GET:/admin/users',
          tenant: 'GET:/products'
        }
      });
    };
  }
}

module.exports = ProtectedRoutesConfig;