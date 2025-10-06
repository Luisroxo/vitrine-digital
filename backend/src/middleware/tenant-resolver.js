/**
 * Tenant Resolver Middleware
 * 
 * Este middleware é responsável por identificar o tenant atual baseado
 * no hostname da requisição e disponibilizar os dados do tenant
 * para toda a aplicação.
 */

const db = require('../database/connection');

/**
 * Cache para armazenar mapping de domínios para tenants
 * Evita consultas desnecessárias ao banco
 */
const domainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Limpar cache expirado
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [domain, data] of domainCache) {
    if (now - data.timestamp > CACHE_TTL) {
      domainCache.delete(domain);
    }
  }
}

/**
 * Buscar tenant pelo domínio
 */
async function findTenantByDomain(domain) {
  // Verificar cache primeiro
  const cached = domainCache.get(domain);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.tenant;
  }

  try {
    // Buscar no banco de dados
    const result = await db('domains as d')
      .join('tenants as t', 't.id', 'd.tenant_id')
      .join('tenant_configs as tc', 'tc.tenant_id', 't.id')
      .where('d.domain', domain)
      .where('d.status', 'active')
      .where('t.status', 'active')
      .select(
        't.*',
        'd.domain',
        'd.ssl_status',
        'd.dns_status',
        'tc.brand_name',
        'tc.logo_url',
        'tc.primary_color',
        'tc.secondary_color',
        'tc.meta_title',
        'tc.meta_description'
      )
      .first();

    // Armazenar no cache
    domainCache.set(domain, {
      tenant: result || null,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Erro ao buscar tenant por domínio:', error);
    return null;
  }
}

/**
 * Extrair domínio da requisição
 */
function extractDomain(req) {
  // Pegar hostname da requisição
  let hostname = req.get('host') || req.hostname;
  
  // Remover porta se presente
  hostname = hostname.split(':')[0];
  
  // Para desenvolvimento local, usar domínio fake
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Verificar se há um header customizado para teste
    return req.get('x-tenant-domain') || 'localhost';
  }
  
  return hostname.toLowerCase();
}

/**
 * Middleware principal de resolução de tenant
 */
async function tenantResolver(req, res, next) {
  try {
    // Limpar cache expirado periodicamente
    if (Math.random() < 0.01) { // 1% chance
      clearExpiredCache();
    }

    // Extrair domínio da requisição
    const domain = extractDomain(req);
    
    // Para rotas de admin ou API sem tenant específico
    if (domain.includes('admin.') || req.path.startsWith('/api/admin')) {
      req.tenant = null;
      return next();
    }

    // Buscar tenant pelo domínio
    const tenant = await findTenantByDomain(domain);

    if (!tenant) {
      // Domínio não encontrado ou inativo
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Este domínio não está configurado ou está inativo.',
        domain: domain,
        timestamp: new Date().toISOString()
      });
    }

    // Verificar se o tenant está ativo
    if (tenant.status !== 'active') {
      return res.status(403).json({
        error: 'Tenant inactive',
        message: 'Esta loja está temporariamente indisponível.',
        status: tenant.status
      });
    }

    // Adicionar dados do tenant à requisição
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      company_name: tenant.company_name,
      plan: tenant.plan,
      domain: tenant.domain,
      
      // Configurações de branding
      branding: {
        brand_name: tenant.brand_name || tenant.name,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
        meta_title: tenant.meta_title,
        meta_description: tenant.meta_description
      },
      
      // Status técnico
      status: {
        tenant: tenant.status,
        ssl: tenant.ssl_status,
        dns: tenant.dns_status
      },
      
      // Limites do plano
      limits: {
        max_domains: tenant.max_domains,
        max_lojistas: tenant.max_lojistas,
        max_products: tenant.max_products
      }
    };

    // Log para debug (remover em produção)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Tenant] ${domain} → ${tenant.name} (${tenant.plan})`);
    }

    next();

  } catch (error) {
    console.error('Erro no middleware tenant resolver:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Erro interno do servidor ao resolver tenant.'
    });
  }
}

/**
 * Middleware para verificar se há um tenant na requisição
 */
function requireTenant(req, res, next) {
  if (!req.tenant) {
    return res.status(400).json({
      error: 'Tenant required',
      message: 'Esta operação requer um tenant válido.'
    });
  }
  next();
}

/**
 * Middleware para verificar planos específicos
 */
function requirePlan(...allowedPlans) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(400).json({
        error: 'Tenant required',
        message: 'Tenant é obrigatório para esta operação.'
      });
    }

    if (!allowedPlans.includes(req.tenant.plan)) {
      return res.status(403).json({
        error: 'Plan not allowed',
        message: `Esta funcionalidade requer um dos seguintes planos: ${allowedPlans.join(', ')}`,
        current_plan: req.tenant.plan,
        required_plans: allowedPlans
      });
    }

    next();
  };
}

/**
 * Função para invalidar cache de um domínio específico
 */
function invalidateDomainCache(domain) {
  domainCache.delete(domain);
}

/**
 * Função para limpar todo o cache
 */
function clearAllCache() {
  domainCache.clear();
}

module.exports = {
  tenantResolver,
  requireTenant,
  requirePlan,
  invalidateDomainCache,
  clearAllCache,
  findTenantByDomain,
  extractDomain
};