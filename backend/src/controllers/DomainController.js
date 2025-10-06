const { body, param, validationResult } = require('express-validator');
const DomainService = require('../services/DomainService');

class DomainController {
  constructor() {
    this.domainService = new DomainService();
  }

  /**
   * Setup completo de um novo domínio
   * POST /api/tenants/:tenantId/domains
   */
  async setupDomain(req, res) {
    try {
      // Validação
      await this.validateSetupDomain(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { tenantId } = req.params;
      const { domain } = req.body;

      console.log(`🚀 API: Setup domínio ${domain} para tenant ${tenantId}`);

      const result = await this.domainService.setupDomain(tenantId, domain);
      
      res.status(201).json({
        success: true,
        message: 'Domínio configurado com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro no setup do domínio:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Remove um domínio
   * DELETE /api/tenants/:tenantId/domains/:domain
   */
  async removeDomain(req, res) {
    try {
      const { tenantId, domain } = req.params;

      console.log(`🗑️ API: Removendo domínio ${domain} do tenant ${tenantId}`);

      const result = await this.domainService.removeDomain(tenantId, domain);
      
      res.json({
        success: true,
        message: 'Domínio removido com sucesso',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro ao remover domínio:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Status de um domínio específico
   * GET /api/domains/:domain/status
   */
  async getDomainStatus(req, res) {
    try {
      const { domain } = req.params;

      console.log(`🔍 API: Status do domínio ${domain}`);

      const status = await this.domainService.getDomainStatus(domain);
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Health check de todos os domínios
   * GET /api/domains/health-check
   */
  async healthCheckAllDomains(req, res) {
    try {
      console.log('🏥 API: Health check de todos os domínios');

      const healthCheck = await this.domainService.healthCheckAllDomains();
      
      res.json({
        success: true,
        message: 'Health check concluído',
        data: healthCheck
      });
      
    } catch (error) {
      console.error('❌ Erro no health check:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Renova SSL de todos os domínios
   * POST /api/domains/renew-ssl
   */
  async renewAllSSL(req, res) {
    try {
      console.log('🔒 API: Renovação SSL de todos os domínios');

      const result = await this.domainService.renewAllSSL();
      
      res.json({
        success: true,
        message: 'Renovação SSL iniciada',
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erro na renovação SSL:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Webhook do Cloudflare para notificações
   * POST /api/domains/webhook/cloudflare
   */
  async cloudflareWebhook(req, res) {
    try {
      console.log('🔗 Webhook Cloudflare recebido:', req.body);

      // Implementar lógica do webhook depois
      // Por exemplo: notificação de mudança de DNS, SSL renovado, etc.
      
      res.json({
        success: true,
        message: 'Webhook processado com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro no webhook:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Validações para setup de domínio
   */
  async validateSetupDomain(req) {
    return Promise.all([
      param('tenantId')
        .isInt({ min: 1 })
        .withMessage('ID do tenant deve ser um número válido')
        .run(req),
        
      body('domain')
        .notEmpty()
        .withMessage('Domínio é obrigatório')
        .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/)
        .withMessage('Formato de domínio inválido')
        .isLength({ max: 253 })
        .withMessage('Domínio muito longo (máximo 253 caracteres)')
        .run(req)
    ]);
  }

  /**
   * Middleware para require admin permissions
   */
  requireAdmin(req, res, next) {
    // Implementar verificação de permissão de admin
    // Por enquanto, permitir tudo
    next();
  }

  /**
   * Middleware para rate limiting específico de domínios
   */
  domainRateLimit(req, res, next) {
    // Implementar rate limiting específico
    // Máximo 5 setup/remove por minuto por IP
    next();
  }
}

module.exports = new DomainController();