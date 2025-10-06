/**
 * Tenant Service
 * 
 * Serviço responsável por gerenciar operações de tenants,
 * incluindo criação, configuração e gerenciamento de domínios.
 */

const db = require('../database/connection');
const crypto = require('crypto');

class TenantService {
  /**
   * Criar um novo tenant
   */
  async create(tenantData) {
    const trx = await db.transaction();
    
    try {
      // Gerar slug único baseado no nome da empresa
      const slug = this.generateSlug(tenantData.company_name);
      
      // Verificar se slug já existe
      const existingSlug = await trx('tenants')
        .where('slug', slug)
        .first();
      
      if (existingSlug) {
        throw new Error(`Slug "${slug}" já existe. Use um nome diferente.`);
      }

      // Dados básicos do tenant
      const tenant = {
        slug,
        name: tenantData.name,
        email: tenantData.email,
        phone: tenantData.phone || null,
        company_name: tenantData.company_name,
        document: tenantData.document || null,
        address: tenantData.address || null,
        status: tenantData.status || 'pending',
        plan: tenantData.plan || 'starter',
        monthly_fee: this.getPlanPrice(tenantData.plan || 'starter'),
        setup_fee: this.getPlanSetupFee(tenantData.plan || 'starter'),
        next_billing_date: this.getNextBillingDate(),
        max_domains: this.getPlanLimits(tenantData.plan || 'starter').domains,
        max_lojistas: this.getPlanLimits(tenantData.plan || 'starter').lojistas,
        max_products: this.getPlanLimits(tenantData.plan || 'starter').products,
        settings: tenantData.settings || {},
        integrations: tenantData.integrations || {}
      };

      // Inserir tenant
      const [tenantId] = await trx('tenants').insert(tenant);

      // Criar configuração padrão
      const defaultConfig = {
        tenant_id: tenantId,
        brand_name: tenantData.company_name,
        brand_description: `Loja oficial de ${tenantData.company_name}`,
        primary_color: '#3B82F6',
        secondary_color: '#10B981',
        accent_color: '#F59E0B',
        background_color: '#FFFFFF',
        font_family: 'Inter',
        meta_title: `${tenantData.company_name} - Produtos e Ofertas`,
        meta_description: `Encontre os melhores produtos de ${tenantData.company_name} com preços especiais para revenda.`,
        contact_email: tenantData.email,
        is_published: false
      };

      await trx('tenant_configs').insert(defaultConfig);

      // Se foi fornecido um domínio, criar entrada
      if (tenantData.domain) {
        await this.addDomain(tenantId, tenantData.domain, true, trx);
      }

      await trx.commit();

      // Retornar tenant completo
      return await this.findById(tenantId);

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Buscar tenant por ID
   */
  async findById(id) {
    const tenant = await db('tenants as t')
      .leftJoin('tenant_configs as tc', 'tc.tenant_id', 't.id')
      .where('t.id', id)
      .select(
        't.*',
        'tc.brand_name',
        'tc.logo_url',
        'tc.primary_color',
        'tc.secondary_color',
        'tc.meta_title',
        'tc.meta_description',
        'tc.is_published'
      )
      .first();

    if (!tenant) {
      return null;
    }

    // Buscar domínios
    const domains = await db('domains')
      .where('tenant_id', id)
      .select('*');

    // Buscar lojistas conectados
    const lojistas = await db('tenant_lojistas')
      .where('tenant_id', id)
      .whereNull('deleted_at')
      .select('*');

    return {
      ...tenant,
      domains,
      lojistas,
      stats: {
        total_lojistas: lojistas.length,
        active_lojistas: lojistas.filter(l => l.status === 'active').length,
        total_domains: domains.length,
        active_domains: domains.filter(d => d.status === 'active').length
      }
    };
  }

  /**
   * Buscar tenant por slug
   */
  async findBySlug(slug) {
    const tenant = await db('tenants')
      .where('slug', slug)
      .first();

    if (!tenant) {
      return null;
    }

    return await this.findById(tenant.id);
  }

  /**
   * Buscar tenant por domínio
   */
  async findByDomain(domain) {
    const result = await db('domains as d')
      .join('tenants as t', 't.id', 'd.tenant_id')
      .where('d.domain', domain)
      .where('d.status', 'active')
      .select('t.*')
      .first();

    if (!result) {
      return null;
    }

    return await this.findById(result.id);
  }

  /**
   * Atualizar tenant
   */
  async update(id, updateData) {
    const trx = await db.transaction();
    
    try {
      // Atualizar dados básicos
      const allowedFields = [
        'name', 'email', 'phone', 'company_name', 'document',
        'address', 'status', 'plan', 'settings', 'integrations'
      ];

      const tenantUpdate = {};
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          tenantUpdate[field] = updateData[field];
        }
      });

      // Se mudou o plano, atualizar limites e preços
      if (updateData.plan) {
        tenantUpdate.monthly_fee = this.getPlanPrice(updateData.plan);
        tenantUpdate.max_domains = this.getPlanLimits(updateData.plan).domains;
        tenantUpdate.max_lojistas = this.getPlanLimits(updateData.plan).lojistas;
        tenantUpdate.max_products = this.getPlanLimits(updateData.plan).products;
      }

      if (Object.keys(tenantUpdate).length > 0) {
        tenantUpdate.updated_at = db.fn.now();
        await trx('tenants')
          .where('id', id)
          .update(tenantUpdate);
      }

      // Atualizar configurações se fornecidas
      if (updateData.config) {
        await trx('tenant_configs')
          .where('tenant_id', id)
          .update({
            ...updateData.config,
            updated_at: db.fn.now()
          });
      }

      await trx.commit();

      return await this.findById(id);

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Adicionar domínio ao tenant
   */
  async addDomain(tenantId, domain, isPrimary = false, trx = null) {
    const transaction = trx || db;

    // Verificar se domínio já existe
    const existingDomain = await transaction('domains')
      .where('domain', domain)
      .first();

    if (existingDomain) {
      throw new Error(`Domínio "${domain}" já está em uso.`);
    }

    // Verificar limites do plano
    const tenant = await transaction('tenants')
      .where('id', tenantId)
      .first();

    if (!tenant) {
      throw new Error('Tenant não encontrado.');
    }

    const currentDomains = await transaction('domains')
      .where('tenant_id', tenantId)
      .count('id as count')
      .first();

    if (currentDomains.count >= tenant.max_domains) {
      throw new Error(`Limite de domínios atingido para o plano ${tenant.plan}.`);
    }

    // Se é domínio primário, remover flag de outros
    if (isPrimary) {
      await transaction('domains')
        .where('tenant_id', tenantId)
        .update({ is_primary: false });
    }

    const domainData = {
      tenant_id: tenantId,
      domain: domain.toLowerCase(),
      dns_status: 'pending',
      ssl_status: 'pending',
      cname_target: 'engine.vitrine360.com.br',
      verification_token: this.generateVerificationToken(),
      is_primary: isPrimary,
      status: 'setup'
    };

    const [domainId] = await transaction('domains').insert(domainData);

    return domainId;
  }

  /**
   * Conectar lojista ao tenant
   */
  async connectLojista(tenantId, lojistaData) {
    // Verificar limites do plano
    const tenant = await db('tenants')
      .where('id', tenantId)
      .first();

    if (!tenant) {
      throw new Error('Tenant não encontrado.');
    }

    const currentLojistas = await db('tenant_lojistas')
      .where('tenant_id', tenantId)
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    if (currentLojistas.count >= tenant.max_lojistas) {
      throw new Error(`Limite de lojistas atingido para o plano ${tenant.plan}.`);
    }

    // Verificar se lojista já está conectado
    const existing = await db('tenant_lojistas')
      .where('tenant_id', tenantId)
      .where('lojista_email', lojistaData.email)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      throw new Error('Lojista já está conectado a este fornecedor.');
    }

    const lojista = {
      tenant_id: tenantId,
      lojista_name: lojistaData.name,
      lojista_email: lojistaData.email,
      lojista_phone: lojistaData.phone || null,
      lojista_document: lojistaData.document || null,
      status: 'pending',
      connected_at: db.fn.now()
    };

    const [lojistaId] = await db('tenant_lojistas').insert(lojista);

    return lojistaId;
  }

  /**
   * Listar todos os tenants com paginação
   */
  async list({ page = 1, limit = 20, status = null, plan = null, search = null }) {
    let query = db('tenants as t')
      .leftJoin('tenant_configs as tc', 'tc.tenant_id', 't.id')
      .select(
        't.*',
        'tc.brand_name',
        'tc.logo_url',
        'tc.is_published'
      );

    // Filtros
    if (status) {
      query = query.where('t.status', status);
    }

    if (plan) {
      query = query.where('t.plan', plan);
    }

    if (search) {
      query = query.where(builder => {
        builder
          .where('t.name', 'ilike', `%${search}%`)
          .orWhere('t.company_name', 'ilike', `%${search}%`)
          .orWhere('t.email', 'ilike', `%${search}%`);
      });
    }

    // Paginação
    const offset = (page - 1) * limit;
    const totalQuery = query.clone().count('t.id as count').first();
    const itemsQuery = query.offset(offset).limit(limit);

    const [total, items] = await Promise.all([totalQuery, itemsQuery]);

    return {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Soft delete de tenant
   */
  async delete(id) {
    const trx = await db.transaction();
    
    try {
      // Soft delete do tenant
      await trx('tenants')
        .where('id', id)
        .update({
          status: 'inactive',
          deleted_at: db.fn.now()
        });

      // Desativar domínios
      await trx('domains')
        .where('tenant_id', id)
        .update({
          status: 'inactive',
          deleted_at: db.fn.now()
        });

      // Desconectar lojistas
      await trx('tenant_lojistas')
        .where('tenant_id', id)
        .update({
          status: 'disconnected',
          deleted_at: db.fn.now()
        });

      await trx.commit();
      
      return true;

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Métodos auxiliares

  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  getPlanPrice(plan) {
    const prices = {
      starter: 499.00,
      pro: 799.00,
      enterprise: 1299.00
    };
    return prices[plan] || prices.starter;
  }

  getPlanSetupFee(plan) {
    const fees = {
      starter: 999.00,
      pro: 1499.00,
      enterprise: 2499.00
    };
    return fees[plan] || fees.starter;
  }

  getPlanLimits(plan) {
    const limits = {
      starter: { domains: 1, lojistas: 5, products: 500 },
      pro: { domains: 3, lojistas: -1, products: -1 }, // -1 = ilimitado
      enterprise: { domains: -1, lojistas: -1, products: -1 }
    };
    return limits[plan] || limits.starter;
  }

  getNextBillingDate() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }
}

module.exports = new TenantService();