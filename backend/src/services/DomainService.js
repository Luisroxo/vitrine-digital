const NginxManager = require('./NginxManager');
const CloudflareManager = require('./CloudflareManager');
const tenantService = require('./TenantService');

class DomainService {
  constructor() {
    this.nginx = new NginxManager();
    this.cloudflare = new CloudflareManager();
    this.tenantService = tenantService;
  }

  /**
   * Setup completo de domínio: DNS + Nginx + SSL
   */
  async setupDomain(tenantId, domain) {
    const transaction = await require('../database/connection').transaction();
    
    try {
      console.log(`🚀 Iniciando setup completo do domínio: ${domain}`);
      
      // 1. Buscar tenant
      const tenant = await this.tenantService.findById(tenantId);
      if (!tenant) {
        throw new Error('Tenant não encontrado');
      }

      // 2. Validar domínio
      if (!this.isValidDomain(domain)) {
        throw new Error('Formato de domínio inválido');
      }

      // 3. Setup DNS no Cloudflare
      console.log('🌐 Configurando DNS...');
      const dnsResult = await this.cloudflare.setupTenantDNS({ 
        ...tenant, 
        domain 
      });

      // 4. Setup Nginx
      console.log('⚙️ Configurando Nginx...');
      const nginxResult = await this.nginx.setupDomain({ 
        ...tenant, 
        domain 
      });

      // 5. Atualizar banco de dados
      await this.tenantService.addDomain(tenantId, {
        domain: domain,
        dns_record_id: dnsResult.record_id,
        target_ip: dnsResult.ip,
        ssl_status: 'pending',
        status: 'active'
      }, transaction);

      await transaction.commit();

      console.log(`🎉 Domínio ${domain} configurado com sucesso!`);
      
      return {
        success: true,
        domain: domain,
        tenant_id: tenantId,
        dns: dnsResult,
        nginx: nginxResult,
        next_steps: [
          'DNS propagation em andamento (5-15 min)',
          'SSL será configurado automaticamente',
          'Domínio estará disponível em breve'
        ]
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Falha no setup do domínio:`, error);
      
      // Cleanup em caso de erro
      await this.cleanup(domain);
      
      throw error;
    }
  }

  /**
   * Remove domínio completo
   */
  async removeDomain(tenantId, domain) {
    const transaction = await require('../database/connection').transaction();
    
    try {
      console.log(`🗑️ Removendo domínio: ${domain}`);
      
      // 1. Remover do Nginx
      try {
        await this.nginx.removeDomain(domain);
      } catch (error) {
        console.warn('⚠️ Erro ao remover Nginx (continuando):', error.message);
      }

      // 2. Remover DNS do Cloudflare
      try {
        await this.cloudflare.removeTenantDNS(domain);
      } catch (error) {
        console.warn('⚠️ Erro ao remover DNS (continuando):', error.message);
      }

      // 3. Remover do banco
      await this.tenantService.removeDomain(tenantId, domain, transaction);

      await transaction.commit();

      console.log(`✅ Domínio ${domain} removido com sucesso`);
      
      return {
        success: true,
        domain: domain,
        message: 'Domínio removido com sucesso'
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Erro ao remover domínio:`, error);
      throw error;
    }
  }

  /**
   * Status completo de um domínio
   */
  async getDomainStatus(domain) {
    try {
      console.log(`🔍 Verificando status do domínio: ${domain}`);
      
      // Status paralelo de DNS, Nginx e SSL
      const [dnsStatus, nginxStatus, sslStatus] = await Promise.all([
        this.cloudflare.getDomainStatus(domain),
        this.nginx.getDomainStatus(domain),
        this.getSSLStatus(domain)
      ]);

      const overallStatus = this.calculateOverallStatus(dnsStatus, nginxStatus, sslStatus);

      return {
        domain,
        overall_status: overallStatus,
        dns: dnsStatus,
        nginx: nginxStatus,
        ssl: sslStatus,
        last_checked: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Erro ao verificar status:`, error);
      return {
        domain,
        overall_status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Verifica status SSL de um domínio
   */
  async getSSLStatus(domain) {
    try {
      // Simular verificação SSL (implementar com biblioteca real depois)
      const https = require('https');
      const url = `https://${domain}`;
      
      return new Promise((resolve) => {
        const req = https.get(url, (res) => {
          resolve({
            domain,
            ssl_valid: true,
            certificate_issuer: 'Let\'s Encrypt',
            expires_at: null // Implementar parsing do certificado
          });
        });
        
        req.on('error', () => {
          resolve({
            domain,
            ssl_valid: false,
            error: 'SSL não configurado ou inválido'
          });
        });
        
        req.setTimeout(5000, () => {
          req.destroy();
          resolve({
            domain,
            ssl_valid: false,
            error: 'Timeout na verificação SSL'
          });
        });
      });
      
    } catch (error) {
      return {
        domain,
        ssl_valid: false,
        error: error.message
      };
    }
  }

  /**
   * Calcula status geral baseado nos componentes
   */
  calculateOverallStatus(dns, nginx, ssl) {
    if (dns.dns_configured && nginx.active && ssl.ssl_valid) {
      return 'active';
    } else if (dns.dns_configured && nginx.active) {
      return 'ssl_pending';
    } else if (dns.dns_configured) {
      return 'nginx_pending';
    } else {
      return 'dns_pending';
    }
  }

  /**
   * Valida formato do domínio
   */
  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  /**
   * Cleanup em caso de erro
   */
  async cleanup(domain) {
    console.log(`🧹 Fazendo cleanup do domínio: ${domain}`);
    
    const cleanupPromises = [
      this.nginx.removeDomain(domain).catch(() => {}),
      this.cloudflare.removeTenantDNS(domain).catch(() => {})
    ];

    await Promise.all(cleanupPromises);
    console.log(`✅ Cleanup concluído para: ${domain}`);
  }

  /**
   * Health check de todos os domínios
   */
  async healthCheckAllDomains() {
    try {
      console.log('🏥 Executando health check de todos os domínios...');
      
      const tenants = await this.tenantService.findAll();
      const healthChecks = [];

      for (const tenant of tenants) {
        if (tenant.domains && tenant.domains.length > 0) {
          for (const domainObj of tenant.domains) {
            const status = await this.getDomainStatus(domainObj.domain);
            healthChecks.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              ...status
            });
          }
        }
      }

      const summary = {
        total_domains: healthChecks.length,
        active: healthChecks.filter(d => d.overall_status === 'active').length,
        ssl_pending: healthChecks.filter(d => d.overall_status === 'ssl_pending').length,
        nginx_pending: healthChecks.filter(d => d.overall_status === 'nginx_pending').length,
        dns_pending: healthChecks.filter(d => d.overall_status === 'dns_pending').length,
        errors: healthChecks.filter(d => d.overall_status === 'error').length,
        checked_at: new Date().toISOString()
      };

      console.log('✅ Health check concluído:', summary);
      
      return {
        summary,
        details: healthChecks
      };
      
    } catch (error) {
      console.error('❌ Erro no health check:', error);
      throw error;
    }
  }

  /**
   * Renova SSL de todos os domínios
   */
  async renewAllSSL() {
    console.log('🔒 Renovando SSL de todos os domínios...');
    
    // Implementar integração com Certbot
    // Por enquanto, simular
    
    return {
      success: true,
      message: 'SSL renewal agendado',
      scheduled_at: new Date().toISOString()
    };
  }
}

module.exports = DomainService;