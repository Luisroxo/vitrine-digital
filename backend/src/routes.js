const express = require('express');
const ProductController = require('./controllers/ProductController');
const BlingController = require('./controllers/BlingController');
const TenantController = require('./controllers/TenantController');
const DomainController = require('./controllers/DomainController');
const ThemeController = require('./controllers/ThemeController');
const OrderController = require('./controllers/OrderController');
const PartnershipController = require('./controllers/PartnershipController');
const BillingController = require('./controllers/BillingController');
// const BetaOnboardingController = require('./controllers/BetaOnboardingController');
const SuperAdminController = require('./controllers/SuperAdminController');
const HealthCheckService = require('./services/HealthCheckService');
const { tenantResolver, requireTenant } = require('./middleware/tenant-resolver');
const { validateDomain, checkDomainStatus } = require('./middleware/domain-validator');

// Import enhanced analytics routes
const enhancedAnalyticsRoutes = require('../microservices/shared/routes/enhancedAnalyticsRoutes');

// Import enhanced shopping cart routes
const enhancedShoppingCartRoutes = require('../microservices/shared/routes/enhancedShoppingCartRoutes');

// Import conflict resolution routes
const conflictResolutionRoutes = require('../microservices/shared/routes/conflictResolutionRoutes');

const routes = express.Router();
const blingController = new BlingController();
const themeController = new ThemeController();
const orderController = new OrderController();
// const betaOnboardingController = new BetaOnboardingController();
const superAdminController = new SuperAdminController();
const healthCheckService = new HealthCheckService();

// Setup health check routes (antes do middleware de tenant)
healthCheckService.setupRoutes(routes);

// ========================================
// SUPER ADMIN ROUTES - HUB360PLUS CONTROL (SEM TENANT)
// ========================================

// Dashboard com métricas globais
routes.get('/api/super-admin/metrics', superAdminController.getDashboardMetrics.bind(superAdminController));

// Gerenciamento completo de fornecedores
routes.get('/api/super-admin/suppliers', superAdminController.getAllSuppliers.bind(superAdminController));
routes.post('/api/super-admin/suppliers', superAdminController.createSupplier.bind(superAdminController));
routes.put('/api/super-admin/suppliers/:supplierId/status', superAdminController.toggleSupplierStatus.bind(superAdminController));

// Geração de NFe de serviços via Bling
routes.post('/api/super-admin/nfe/:subscriptionId', superAdminController.generateServiceNFe.bind(superAdminController));

// Middleware global de resolução de tenant (APÓS as rotas Super Admin)
routes.use(tenantResolver);

// Enhanced Analytics Routes (with tenant context)
routes.use('/api/analytics', enhancedAnalyticsRoutes);

// Enhanced Shopping Cart Routes (with tenant context)
routes.use('/api/cart', enhancedShoppingCartRoutes);

// Conflict Resolution Routes (with tenant context)
routes.use('/api/conflicts', conflictResolutionRoutes);

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
// Configuração da integração
routes.post('/api/bling/auth/config', requireTenant, blingController.configureIntegration.bind(blingController));
routes.get('/api/bling/auth/url', requireTenant, blingController.getAuthUrl.bind(blingController));
routes.get('/api/bling/auth/callback', blingController.authCallback.bind(blingController)); // Callback não usa middleware tenant

// Status e informações
routes.get('/api/bling/status', requireTenant, blingController.getStatus.bind(blingController));

// Sincronização
routes.post('/api/bling/sync/products', requireTenant, blingController.syncProducts.bind(blingController));
routes.get('/api/bling/sync/history', requireTenant, blingController.getSyncHistory.bind(blingController));

// Dados do Bling
routes.get('/api/bling/categories', requireTenant, blingController.getCategories.bind(blingController));
routes.post('/api/bling/orders', requireTenant, blingController.createOrder.bind(blingController));

// Webhook multi-tenant (tenant na URL)
routes.post('/api/bling/webhook/:tenantId/:webhookKey', blingController.webhook.bind(blingController));

// Gerenciamento da integração
routes.delete('/api/bling/integration', requireTenant, blingController.removeIntegration.bind(blingController));

// ========================================
// ROTAS DO SISTEMA DE PEDIDOS (Multi-tenant)
// ========================================

// Pedidos - CRUD completo isolado por tenant
routes.post('/api/orders', requireTenant, orderController.createOrder.bind(orderController));
routes.get('/api/orders', requireTenant, orderController.getOrders.bind(orderController));
routes.get('/api/orders/stats', requireTenant, orderController.getOrderStats.bind(orderController));
routes.get('/api/orders/:id', requireTenant, orderController.getOrderById.bind(orderController));
routes.put('/api/orders/:id', requireTenant, orderController.updateOrder.bind(orderController));

// Status management
routes.patch('/api/orders/:id/status', requireTenant, orderController.updateOrderStatus.bind(orderController));
routes.post('/api/orders/:id/cancel', requireTenant, orderController.cancelOrder.bind(orderController));

// Notificações
routes.get('/api/orders/:id/notifications', requireTenant, orderController.getOrderNotifications.bind(orderController));

// Configurações de pedidos por tenant
routes.get('/api/orders/settings', requireTenant, orderController.getOrderSettings.bind(orderController));
routes.put('/api/orders/settings', requireTenant, orderController.updateOrderSettings.bind(orderController));

// ========================================
// ROTAS DO SISTEMA DE PARCERIAS 1:1
// ========================================

// Gerenciamento de convites (fornecedor)
routes.post('/api/partnerships/invite', requireTenant, PartnershipController.createInvitation);
routes.get('/api/partnerships', requireTenant, PartnershipController.getPartnerships);
routes.get('/api/partnerships/stats', requireTenant, PartnershipController.getStats);

// Gerenciamento de parceria específica (fornecedor)
routes.get('/api/partnerships/:id', requireTenant, PartnershipController.getPartnership);
routes.put('/api/partnerships/:id/suspend', requireTenant, PartnershipController.suspendPartnership);
routes.put('/api/partnerships/:id/reactivate', requireTenant, PartnershipController.reactivatePartnership);
routes.post('/api/partnerships/:id/sync', requireTenant, PartnershipController.forceSync);

// Mensagens entre parceiros
routes.post('/api/partnerships/:id/messages', requireTenant, PartnershipController.sendMessage);
routes.get('/api/partnerships/:id/messages', requireTenant, PartnershipController.getMessages);

// Aceitação de convite (público - sem tenant)
routes.post('/api/partnerships/accept/:token', PartnershipController.acceptInvitation);

// ========================================
// ROTAS DO SISTEMA DE BILLING
// ========================================

// Planos disponíveis (público)
routes.get('/api/billing/plans', BillingController.getPlans);

// Gerenciamento de assinaturas (por tenant)
routes.post('/api/billing/subscribe', requireTenant, BillingController.createSubscription);
routes.get('/api/billing/subscription', requireTenant, BillingController.getSubscription);
routes.delete('/api/billing/subscription', requireTenant, BillingController.cancelSubscription);

// Dashboard e métricas
routes.get('/api/billing/dashboard', requireTenant, BillingController.getDashboard);
routes.get('/api/billing/stats', requireTenant, BillingController.getBillingStats);
routes.get('/api/billing/limits/:resource?', requireTenant, BillingController.checkLimits);

// Histórico financeiro
routes.get('/api/billing/payments', requireTenant, BillingController.getPaymentHistory);
routes.get('/api/billing/next-charge', requireTenant, BillingController.getNextCharge);

// Webhook Stripe (público - sem tenant)
routes.post('/api/billing/webhook/stripe', BillingController.stripeWebhook);

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
// DOMAIN MANAGEMENT ROUTES
// ========================================

// Setup novo domínio para tenant
routes.post('/api/tenants/:tenantId/domains', 
  DomainController.requireAdmin,
  DomainController.domainRateLimit,
  DomainController.setupDomain
);

// Remove domínio de tenant
routes.delete('/api/tenants/:tenantId/domains/:domain', 
  DomainController.requireAdmin,
  DomainController.removeDomain
);

// Status específico de domínio
routes.get('/api/domains/:domain/status', DomainController.getDomainStatus);

// Health check de todos os domínios
routes.get('/api/domains/health-check', 
  DomainController.requireAdmin,
  DomainController.healthCheckAllDomains
);

// Renovar SSL de todos os domínios
routes.post('/api/domains/renew-ssl', 
  DomainController.requireAdmin,
  DomainController.renewAllSSL
);

// Webhook do Cloudflare
routes.post('/api/domains/webhook/cloudflare', DomainController.cloudflareWebhook);

// ========================================
// WHITE LABEL CUSTOMIZATION ROUTES
// ========================================

// Tema e personalização visual
routes.put('/api/tenants/:tenantId/theme', 
  DomainController.requireAdmin,
  themeController.updateTheme.bind(themeController)
);

routes.get('/api/tenants/:tenantId/theme', 
  DomainController.requireAdmin,
  themeController.getTheme.bind(themeController)
);

routes.get('/api/tenants/:tenantId/theme/compiled',
  themeController.getCompiledTheme.bind(themeController)
);

routes.get('/api/tenants/:tenantId/theme/preview',
  themeController.getThemePreview.bind(themeController)
);

routes.post('/api/tenants/:tenantId/theme/reset',
  DomainController.requireAdmin,
  themeController.resetTheme.bind(themeController)
);

// Gestão de assets (logos, imagens, etc)
routes.post('/api/tenants/:tenantId/assets',
  DomainController.requireAdmin,
  themeController.getUploadMiddleware(),
  themeController.uploadAsset.bind(themeController)
);

routes.get('/api/tenants/:tenantId/assets',
  DomainController.requireAdmin,
  themeController.getAssets.bind(themeController)
);

routes.delete('/api/tenants/:tenantId/assets/:fileName',
  DomainController.requireAdmin,
  themeController.deleteAsset.bind(themeController)
);

routes.get('/api/tenants/:tenantId/assets/:fileName/preview',
  themeController.getAssetPreview.bind(themeController)
);

// Templates disponíveis
routes.get('/api/theme/templates',
  themeController.getTemplates.bind(themeController)
);

// Tema atual do tenant (público - usado pela vitrine)
routes.get('/api/theme/current', requireTenant,
  themeController.getTheme.bind(themeController)
);

routes.get('/api/theme/current/compiled', requireTenant,
  themeController.getCompiledTheme.bind(themeController)
);

// ========================================
// ROTAS BETA ONBOARDING
// ========================================

// Beta onboarding management (TEMPORARILY COMMENTED - UUID ISSUE)
// routes.post('/api/beta/onboarding/start', requireTenant, betaOnboardingController.startOnboarding.bind(betaOnboardingController));
// routes.get('/api/beta/onboarding/status', requireTenant, betaOnboardingController.getOnboardingStatus.bind(betaOnboardingController));
// routes.get('/api/beta/onboarding/steps/:user_type', betaOnboardingController.getOnboardingSteps.bind(betaOnboardingController));
// routes.put('/api/beta/onboarding/:onboarding_id/step/:step_id', requireTenant, betaOnboardingController.completeStep.bind(betaOnboardingController));

// Beta feedback and support (TEMPORARILY COMMENTED)
// routes.post('/api/beta/feedback', requireTenant, betaOnboardingController.submitFeedback.bind(betaOnboardingController));
// routes.post('/api/beta/support/ticket', requireTenant, betaOnboardingController.createSupportTicket.bind(betaOnboardingController));

// Beta metrics (TEMPORARILY COMMENTED)
// routes.get('/api/beta/metrics', requireTenant, betaOnboardingController.getBetaMetrics.bind(betaOnboardingController));
// routes.post('/api/beta/metrics', requireTenant, betaOnboardingController.recordMetric.bind(betaOnboardingController));

// Admin beta overview (TEMPORARILY COMMENTED)
// routes.get('/api/admin/beta/overview', betaOnboardingController.getBetaOverview.bind(betaOnboardingController));

// ========================================
// ROTAS MOVIDAS PARA O INÍCIO DO ARQUIVO (SEM MIDDLEWARE TENANT)
// ========================================

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