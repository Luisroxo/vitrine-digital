const axios = require('axios');

class CloudflareManager {
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
    this.baseURL = 'https://api.cloudflare.com/client/v4';
    
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!this.apiToken || !this.zoneId) {
      console.warn('⚠️ Cloudflare API não configurada. Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID');
    }
  }

  /**
   * Verifica se as credenciais estão válidas
   */
  async validateCredentials() {
    try {
      console.log('🔐 Validando credenciais Cloudflare...');
      
      const response = await this.api.get('/user/tokens/verify');
      
      if (response.data.success) {
        console.log('✅ Credenciais Cloudflare válidas!');
        return true;
      } else {
        console.error('❌ Credenciais Cloudflare inválidas:', response.data.errors);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro ao validar credenciais:', error.message);
      return false;
    }
  }

  /**
   * Cria registro DNS A apontando para o servidor
   */
  async createDNSRecord(subdomain, targetIP = process.env.SERVER_IP) {
    try {
      console.log(`🌐 Criando DNS: ${subdomain} -> ${targetIP}`);
      
      if (!targetIP) {
        throw new Error('SERVER_IP não definido nas variáveis de ambiente');
      }

      const recordData = {
        type: 'A',
        name: subdomain,
        content: targetIP,
        ttl: 300, // 5 minutos
        proxied: true // Usar proxy do Cloudflare (CDN + DDoS protection)
      };

      const response = await this.api.post(`/zones/${this.zoneId}/dns_records`, recordData);
      
      if (response.data.success) {
        console.log(`✅ DNS criado: ${subdomain}`);
        return {
          success: true,
          record: response.data.result,
          subdomain: subdomain,
          ip: targetIP
        };
      } else {
        console.error('❌ Erro ao criar DNS:', response.data.errors);
        throw new Error(`Falha ao criar DNS: ${response.data.errors[0]?.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao criar DNS para ${subdomain}:`, error.message);
      throw error;
    }
  }

  /**
   * Atualiza registro DNS existente
   */
  async updateDNSRecord(recordId, subdomain, targetIP) {
    try {
      console.log(`🔄 Atualizando DNS: ${subdomain} -> ${targetIP}`);
      
      const recordData = {
        type: 'A',
        name: subdomain,
        content: targetIP,
        ttl: 300,
        proxied: true
      };

      const response = await this.api.put(`/zones/${this.zoneId}/dns_records/${recordId}`, recordData);
      
      if (response.data.success) {
        console.log(`✅ DNS atualizado: ${subdomain}`);
        return response.data.result;
      } else {
        throw new Error(`Falha ao atualizar DNS: ${response.data.errors[0]?.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar DNS:`, error.message);
      throw error;
    }
  }

  /**
   * Remove registro DNS
   */
  async deleteDNSRecord(recordId) {
    try {
      console.log(`🗑️ Removendo DNS record ID: ${recordId}`);
      
      const response = await this.api.delete(`/zones/${this.zoneId}/dns_records/${recordId}`);
      
      if (response.data.success) {
        console.log(`✅ DNS removido com sucesso`);
        return true;
      } else {
        throw new Error(`Falha ao remover DNS: ${response.data.errors[0]?.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao remover DNS:`, error.message);
      throw error;
    }
  }

  /**
   * Busca registro DNS por nome
   */
  async findDNSRecord(subdomain) {
    try {
      console.log(`🔍 Buscando DNS: ${subdomain}`);
      
      const response = await this.api.get(`/zones/${this.zoneId}/dns_records`, {
        params: {
          name: subdomain,
          type: 'A'
        }
      });
      
      if (response.data.success && response.data.result.length > 0) {
        return response.data.result[0];
      } else {
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Erro ao buscar DNS:`, error.message);
      return null;
    }
  }

  /**
   * Lista todos os registros DNS da zona
   */
  async listDNSRecords() {
    try {
      console.log('📋 Listando registros DNS...');
      
      const response = await this.api.get(`/zones/${this.zoneId}/dns_records`);
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(`Falha ao listar DNS: ${response.data.errors[0]?.message}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao listar DNS:', error.message);
      return [];
    }
  }

  /**
   * Verifica status de propagação DNS
   */
  async checkDNSPropagation(subdomain) {
    try {
      console.log(`🌐 Verificando propagação DNS: ${subdomain}`);
      
      // Usar serviço externo para verificar propagação
      const checkResponse = await axios.get(`https://dns.google/resolve`, {
        params: {
          name: subdomain,
          type: 'A'
        }
      });
      
      const hasRecord = checkResponse.data.Answer && checkResponse.data.Answer.length > 0;
      
      return {
        subdomain,
        propagated: hasRecord,
        records: checkResponse.data.Answer || [],
        checked_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Erro ao verificar propagação:`, error.message);
      return {
        subdomain,
        propagated: false,
        error: error.message
      };
    }
  }

  /**
   * Setup completo de DNS para novo tenant
   */
  async setupTenantDNS(tenant) {
    try {
      console.log(`🚀 Setup DNS completo para: ${tenant.domain}`);
      
      // 1. Verificar se já existe
      const existingRecord = await this.findDNSRecord(tenant.domain);
      
      let dnsRecord;
      if (existingRecord) {
        console.log('📝 Registro DNS já existe, atualizando...');
        dnsRecord = await this.updateDNSRecord(
          existingRecord.id, 
          tenant.domain, 
          process.env.SERVER_IP
        );
      } else {
        console.log('➕ Criando novo registro DNS...');
        const result = await this.createDNSRecord(tenant.domain);
        dnsRecord = result.record;
      }

      // 2. Aguardar propagação (opcional)
      console.log('⏳ Aguardando propagação DNS...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos
      
      // 3. Verificar propagação
      const propagation = await this.checkDNSPropagation(tenant.domain);
      
      console.log(`✅ DNS setup completo para ${tenant.domain}`);
      
      return {
        success: true,
        domain: tenant.domain,
        record_id: dnsRecord.id,
        ip: dnsRecord.content,
        propagation: propagation
      };
      
    } catch (error) {
      console.error(`❌ Falha no setup DNS:`, error);
      throw error;
    }
  }

  /**
   * Remove DNS completo de um tenant
   */
  async removeTenantDNS(domain) {
    try {
      console.log(`🗑️ Removendo DNS: ${domain}`);
      
      const record = await this.findDNSRecord(domain);
      
      if (record) {
        await this.deleteDNSRecord(record.id);
        console.log(`✅ DNS ${domain} removido com sucesso`);
        return true;
      } else {
        console.log(`⚠️ DNS ${domain} não encontrado`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Erro ao remover DNS:`, error);
      throw error;
    }
  }

  /**
   * Status completo de um domínio
   */
  async getDomainStatus(domain) {
    try {
      const record = await this.findDNSRecord(domain);
      const propagation = await this.checkDNSPropagation(domain);
      
      return {
        domain,
        dns_configured: !!record,
        dns_record_id: record?.id,
        target_ip: record?.content,
        propagated: propagation.propagated,
        last_checked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        domain,
        dns_configured: false,
        error: error.message
      };
    }
  }
}

module.exports = CloudflareManager;