/**
 * Tenant Controller
 * 
 * Controller para gerenciar operações de tenants via API REST.
 * Inclui endpoints para CRUD, configuração de domínios e estatísticas.
 */

const TenantService = require('../services/TenantService');
const { validationResult } = require('express-validator');

class TenantController {
  /**
   * GET /api/tenants
   * Listar tenants com paginação e filtros
   */
  async index(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        plan,
        search
      } = req.query;

      const result = await TenantService.list({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        plan,
        search
      });

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao listar tenants:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /api/tenants/:id
   * Buscar tenant específico por ID
   */
  async show(req, res) {
    try {
      const { id } = req.params;
      
      const tenant = await TenantService.findById(id);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          message: 'Tenant não encontrado.'
        });
      }

      res.json({
        success: true,
        data: tenant,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao buscar tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /api/tenants/slug/:slug
   * Buscar tenant por slug
   */
  async showBySlug(req, res) {
    try {
      const { slug } = req.params;
      
      const tenant = await TenantService.findBySlug(slug);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          message: 'Tenant não encontrado.'
        });
      }

      res.json({
        success: true,
        data: tenant,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao buscar tenant por slug:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * POST /api/tenants
   * Criar novo tenant
   */
  async store(req, res) {
    try {
      // Validar dados de entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array()
        });
      }

      const tenantData = req.body;
      
      const tenant = await TenantService.create(tenantData);

      res.status(201).json({
        success: true,
        data: tenant,
        message: 'Tenant criado com sucesso.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao criar tenant:', error);
      
      // Erros específicos
      if (error.message.includes('já existe')) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/tenants/:id
   * Atualizar tenant existente
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // Validar dados de entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          errors: errors.array()
        });
      }

      const updateData = req.body;
      
      const tenant = await TenantService.update(id, updateData);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          message: 'Tenant não encontrado.'
        });
      }

      res.json({
        success: true,
        data: tenant,
        message: 'Tenant atualizado com sucesso.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao atualizar tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/tenants/:id
   * Excluir tenant (soft delete)
   */
  async destroy(req, res) {
    try {
      const { id } = req.params;
      
      const success = await TenantService.delete(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          message: 'Tenant não encontrado.'
        });
      }

      res.json({
        success: true,
        message: 'Tenant excluído com sucesso.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao excluir tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * POST /api/tenants/:id/domains
   * Adicionar domínio ao tenant
   */
  async addDomain(req, res) {
    try {
      const { id } = req.params;
      const { domain, is_primary = false } = req.body;

      if (!domain) {
        return res.status(400).json({
          success: false,
          error: 'Domain required',
          message: 'Domínio é obrigatório.'
        });
      }

      const domainId = await TenantService.addDomain(id, domain, is_primary);

      res.status(201).json({
        success: true,
        data: { domain_id: domainId, domain, is_primary },
        message: 'Domínio adicionado com sucesso.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao adicionar domínio:', error);
      
      if (error.message.includes('já está em uso')) {
        return res.status(409).json({
          success: false,
          error: 'Domain conflict',
          message: error.message
        });
      }

      if (error.message.includes('Limite de domínios')) {
        return res.status(403).json({
          success: false,
          error: 'Plan limit exceeded',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * POST /api/tenants/:id/lojistas
   * Conectar lojista ao tenant
   */
  async connectLojista(req, res) {
    try {
      const { id } = req.params;
      const lojistaData = req.body;

      if (!lojistaData.name || !lojistaData.email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Nome e email do lojista são obrigatórios.'
        });
      }

      const lojistaId = await TenantService.connectLojista(id, lojistaData);

      res.status(201).json({
        success: true,
        data: { lojista_id: lojistaId, ...lojistaData },
        message: 'Lojista conectado com sucesso.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao conectar lojista:', error);
      
      if (error.message.includes('já está conectado')) {
        return res.status(409).json({
          success: false,
          error: 'Lojista already connected',
          message: error.message
        });
      }

      if (error.message.includes('Limite de lojistas')) {
        return res.status(403).json({
          success: false,
          error: 'Plan limit exceeded',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /api/tenant/current
   * Obter dados do tenant atual (baseado no domínio)
   */
  async getCurrentTenant(req, res) {
    try {
      if (!req.tenant) {
        return res.status(400).json({
          success: false,
          error: 'No tenant context',
          message: 'Nenhum tenant identificado na requisição.'
        });
      }

      // Buscar dados completos do tenant atual
      const tenant = await TenantService.findById(req.tenant.id);

      res.json({
        success: true,
        data: tenant,
        domain_info: {
          current_domain: req.get('host'),
          tenant_context: req.tenant
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao buscar tenant atual:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /api/tenant/stats
   * Estatísticas do tenant atual
   */
  async getStats(req, res) {
    try {
      if (!req.tenant) {
        return res.status(400).json({
          success: false,
          error: 'No tenant context',
          message: 'Nenhum tenant identificado na requisição.'
        });
      }

      const tenant = await TenantService.findById(req.tenant.id);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
          message: 'Tenant não encontrado.'
        });
      }

      const stats = {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          plan: tenant.plan,
          status: tenant.status
        },
        usage: {
          domains: {
            current: tenant.stats.total_domains,
            limit: tenant.max_domains,
            percentage: tenant.max_domains > 0 ? 
              Math.round((tenant.stats.total_domains / tenant.max_domains) * 100) : 0
          },
          lojistas: {
            current: tenant.stats.total_lojistas,
            active: tenant.stats.active_lojistas,
            limit: tenant.max_lojistas,
            percentage: tenant.max_lojistas > 0 ? 
              Math.round((tenant.stats.total_lojistas / tenant.max_lojistas) * 100) : 0
          }
        },
        billing: {
          plan: tenant.plan,
          monthly_fee: tenant.monthly_fee,
          next_billing: tenant.next_billing_date
        }
      };

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = new TenantController();