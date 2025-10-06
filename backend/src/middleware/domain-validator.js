/**
 * Domain Validator Middleware
 * 
 * Middleware para validar configurações de domínio e SSL
 * antes de permitir acesso às funcionalidades.
 */

const dns = require('dns').promises;
const https = require('https');
const { URL } = require('url');

/**
 * Cache para resultados de validação
 */
const validationCache = new Map();
const VALIDATION_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

/**
 * Validar configuração DNS do domínio
 */
async function validateDNS(domain, expectedTarget = 'engine.vitrine360.com.br') {
  try {
    const records = await dns.resolveCname(domain);
    return records.includes(expectedTarget);
  } catch (error) {
    // Se não há CNAME, verificar A record apontando para nosso IP
    try {
      const aRecords = await dns.resolve4(domain);
      // TODO: Verificar se o IP corresponde ao nosso servidor
      return aRecords.length > 0;
    } catch (aError) {
      return false;
    }
  }
}

/**
 * Validar certificado SSL do domínio
 */
async function validateSSL(domain) {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      method: 'HEAD',
      timeout: 5000,
      rejectUnauthorized: true
    };

    const req = https.request(options, (res) => {
      const cert = res.connection.getPeerCertificate();
      const now = new Date();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      
      resolve({
        valid: now >= validFrom && now <= validTo,
        issuer: cert.issuer,
        validTo: validTo,
        daysUntilExpiry: Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
      });
    });

    req.on('error', () => {
      resolve({ valid: false, error: 'SSL connection failed' });
    });

    req.on('timeout', () => {
      resolve({ valid: false, error: 'SSL validation timeout' });
    });

    req.setTimeout(5000);
    req.end();
  });
}

/**
 * Middleware para validar domínio em tempo real
 */
async function validateDomain(req, res, next) {
  // Apenas validar se temos um tenant
  if (!req.tenant) {
    return next();
  }

  const domain = req.tenant.domain;
  const cacheKey = `validation_${domain}`;
  
  // Verificar cache
  const cached = validationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < VALIDATION_CACHE_TTL)) {
    req.domainValidation = cached.result;
    return next();
  }

  try {
    // Executar validações em paralelo
    const [dnsValid, sslResult] = await Promise.all([
      validateDNS(domain),
      validateSSL(domain)
    ]);

    const validation = {
      domain: domain,
      dns: {
        valid: dnsValid,
        checkedAt: new Date().toISOString()
      },
      ssl: {
        valid: sslResult.valid,
        expiresAt: sslResult.validTo,
        daysUntilExpiry: sslResult.daysUntilExpiry,
        issuer: sslResult.issuer,
        error: sslResult.error,
        checkedAt: new Date().toISOString()
      },
      overallValid: dnsValid && sslResult.valid
    };

    // Armazenar no cache
    validationCache.set(cacheKey, {
      result: validation,
      timestamp: Date.now()
    });

    req.domainValidation = validation;

    // Log warnings para SSL próximo do vencimento
    if (sslResult.valid && sslResult.daysUntilExpiry < 30) {
      console.warn(`[SSL Warning] Certificado de ${domain} expira em ${sslResult.daysUntilExpiry} dias`);
    }

    next();

  } catch (error) {
    console.error('Erro na validação do domínio:', error);
    
    // Em caso de erro, continuar sem validação
    req.domainValidation = {
      domain: domain,
      dns: { valid: false, error: 'Validation failed' },
      ssl: { valid: false, error: 'Validation failed' },
      overallValid: false,
      error: error.message
    };
    
    next();
  }
}

/**
 * Middleware para exigir domínio válido
 */
function requireValidDomain(req, res, next) {
  if (!req.domainValidation || !req.domainValidation.overallValid) {
    return res.status(503).json({
      error: 'Domain configuration invalid',
      message: 'A configuração do domínio está inválida ou incompleta.',
      validation: req.domainValidation,
      instructions: {
        dns: 'Verifique se o CNAME está apontando para engine.vitrine360.com.br',
        ssl: 'Aguarde até 24h para a emissão do certificado SSL'
      }
    });
  }
  next();
}

/**
 * Endpoint para verificar status do domínio
 */
async function checkDomainStatus(req, res) {
  const domain = req.params.domain || req.tenant?.domain;
  
  if (!domain) {
    return res.status(400).json({
      error: 'Domain required',
      message: 'Domínio é obrigatório para verificação.'
    });
  }

  try {
    const [dnsValid, sslResult] = await Promise.all([
      validateDNS(domain),
      validateSSL(domain)
    ]);

    res.json({
      domain: domain,
      dns: {
        valid: dnsValid,
        status: dnsValid ? 'configured' : 'pending',
        instructions: dnsValid ? null : `Configure CNAME ${domain} → engine.vitrine360.com.br`
      },
      ssl: {
        valid: sslResult.valid,
        status: sslResult.valid ? 'active' : 'pending',
        expiresAt: sslResult.validTo,
        daysUntilExpiry: sslResult.daysUntilExpiry,
        issuer: sslResult.issuer?.CN,
        error: sslResult.error
      },
      overall: {
        status: dnsValid && sslResult.valid ? 'active' : 'setup_required',
        ready: dnsValid && sslResult.valid
      },
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error.message,
      domain: domain
    });
  }
}

/**
 * Limpar cache de validação
 */
function clearValidationCache(domain = null) {
  if (domain) {
    validationCache.delete(`validation_${domain}`);
  } else {
    validationCache.clear();
  }
}

module.exports = {
  validateDomain,
  requireValidDomain,
  checkDomainStatus,
  clearValidationCache,
  validateDNS,
  validateSSL
};