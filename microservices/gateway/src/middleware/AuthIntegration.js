const express = require('express');
const TokenValidationPipeline = require('../../../auth-service/src/middleware/TokenValidationPipeline');
const ProtectedRoutesConfig = require('../../../auth-service/src/config/ProtectedRoutesConfig');

/**
 * Exemplo de integração do Auth Service no Gateway
 * Para ser usado no gateway/src/middleware/AuthIntegration.js
 */
class AuthIntegration {
  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
    this.routesConfig = new ProtectedRoutesConfig(this.authServiceUrl);
  }

  /**
   * Setup completo da autenticação no Gateway
   */
  setupAuth(app) {
    // 1. Access Logging
    app.use(this.routesConfig.enableAccessLogging());

    // 2. Protected Routes Middleware 
    app.use(this.routesConfig.createGatewayMiddleware());

    // 3. Debug endpoint para configurações
    app.get('/auth/config', this.routesConfig.createConfigEndpoint());

    console.log('✅ Auth integration configured on Gateway');
  }

  /**
   * Middleware específico para rotas que precisam de admin
   */
  requireAdmin() {
    const pipeline = this.routesConfig.pipeline;
    return [
      pipeline.createValidationMiddleware(),
      pipeline.requireRoles(['admin', 'super_admin'])
    ];
  }

  /**
   * Middleware para rotas que precisam de permissões específicas
   */
  requirePermissions(permissions) {
    const pipeline = this.routesConfig.pipeline;
    return [
      pipeline.createValidationMiddleware(),
      pipeline.requireTenantAccess(),
      pipeline.requirePermissions(permissions)
    ];
  }

  /**
   * Exemplo de uso em rotas específicas do Gateway
   */
  setupExampleRoutes(app) {
    // Rota admin para gerenciar usuários
    app.use('/admin/*', this.requireAdmin());

    // Rotas de produtos com permissões
    app.get('/api/products', 
      this.requirePermissions(['products.read'])
    );

    app.post('/api/products', 
      this.requirePermissions(['products.create'])
    );

    app.put('/api/products/:id', 
      this.requirePermissions(['products.update'])
    );

    app.delete('/api/products/:id', 
      this.requirePermissions(['products.delete'])
    );

    // Rotas de analytics
    app.use('/api/analytics/*', 
      this.requirePermissions(['analytics.read'])
    );

    // Rotas de sync Bling
    app.use('/api/sync/*', 
      this.requirePermissions(['bling.write'])
    );
  }
}

module.exports = AuthIntegration;