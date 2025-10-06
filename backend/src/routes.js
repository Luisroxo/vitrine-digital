const express = require('express');
const ProductController = require('./controllers/ProductController');
const BlingController = require('./controllers/BlingController');
const TenantController = require('./controllers/TenantController');
const { tenantResolver, requireTenant } = require('./middleware/tenant-resolver');
const { validateDomain, checkDomainStatus } = require('./middleware/domain-validator');

const routes = express.Router();
const blingController = new BlingController();

// Middleware global de resolução de tenant
routes.use(tenantResolver);

// Rotas públicas (sem necessidade de tenant)
routes.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas de validação de domínio
routes.get('/api/domain/check/:domain?', checkDomainStatus);

// ========================================
// ROTAS ADMINISTRATIVAS (Multi-tenant management)
// ========================================

// Gerenciamento de tenants (rotas admin)
routes.get('/api/admin/tenants', TenantController.index);
routes.post('/api/admin/tenants', TenantController.store);
routes.get('/api/admin/tenants/:id', TenantController.show);
routes.get('/api/admin/tenants/slug/:slug', TenantController.showBySlug);
routes.put('/api/admin/tenants/:id', TenantController.update);
routes.delete('/api/admin/tenants/:id', TenantController.destroy);

// Gerenciamento de domínios por tenant
routes.post('/api/admin/tenants/:id/domains', TenantController.addDomain);
routes.post('/api/admin/tenants/:id/lojistas', TenantController.connectLojista);

// ========================================
// ROTAS DO TENANT ESPECÍFICO
// ========================================

// Informações do tenant atual (contexto por domínio)
routes.get('/api/tenant/current', requireTenant, TenantController.getCurrentTenant);
routes.get('/api/tenant/stats', requireTenant, TenantController.getStats);

// Rotas da API - Produtos (contexto do tenant)
routes.get('/api/products', requireTenant, ProductController.index);
routes.get('/api/products/popular', requireTenant, ProductController.popular);
routes.get('/api/products/offers', requireTenant, ProductController.offers);

// Rotas da API - Integração Bling ERP (contexto do tenant)
routes.get('/api/bling/status', requireTenant, blingController.getStatus.bind(blingController));
routes.get('/api/bling/auth/url', requireTenant, blingController.getAuthUrl.bind(blingController));
routes.get('/api/bling/auth/callback', requireTenant, blingController.authCallback.bind(blingController));
routes.post('/api/bling/sync/products', requireTenant, blingController.syncProducts.bind(blingController));
routes.get('/api/bling/categories', requireTenant, blingController.getCategories.bind(blingController));
routes.post('/api/bling/orders', requireTenant, blingController.createOrder.bind(blingController));
routes.post('/api/bling/webhook', blingController.webhook.bind(blingController)); // Webhook não precisa de tenant específico

// ========================================
// ROTAS WHITE LABEL (Frontend do tenant)
// ========================================

// Rota principal da vitrine (será servida pelo frontend)
routes.get('/', requireTenant, validateDomain, (req, res) => {
  // Esta rota será interceptada pelo frontend React
  // Aqui podemos retornar dados iniciais ou redirecionar
  res.json({
    tenant: req.tenant.branding,
    domain_status: req.domainValidation,
    message: 'Vitrine ativa',
    timestamp: new Date().toISOString()
  });
});

// API para dados da vitrine personalizada
routes.get('/api/vitrine/config', requireTenant, (req, res) => {
  res.json({
    success: true,
    data: {
      branding: req.tenant.branding,
      tenant_info: {
        name: req.tenant.name,
        plan: req.tenant.plan
      },
      domain_status: req.domainValidation
    }
  });
});

// ========================================
// FALLBACK ROUTES
// ========================================

// Rota 404 para APIs
routes.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'O endpoint solicitado não existe.',
    path: req.path,
    method: req.method,
    tenant: req.tenant ? req.tenant.name : 'N/A'
  });
});

module.exports = routes;