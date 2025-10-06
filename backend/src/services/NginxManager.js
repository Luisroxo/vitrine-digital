const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class NginxManager {
  constructor() {
    this.templatePath = path.join(__dirname, '../../infrastructure/nginx/domain-template.conf');
    this.nginxSitesPath = '/etc/nginx/sites-available';
    this.nginxEnabledPath = '/etc/nginx/sites-enabled';
    this.nginxMainConfig = '/etc/nginx/nginx.conf';
  }

  /**
   * Gera configuração Nginx para um novo domínio
   */
  async generateDomainConfig(tenant) {
    try {
      console.log(`🔧 Gerando configuração Nginx para: ${tenant.domain}`);
      
      // Ler template
      const template = await fs.readFile(this.templatePath, 'utf8');
      
      // Substituir variáveis
      const config = template
        .replace(/\{\{DOMAIN_NAME\}\}/g, tenant.domain)
        .replace(/\{\{TENANT_ID\}\}/g, tenant.id)
        .replace(/\{\{BACKEND_PORT\}\}/g, process.env.PORT || 3333);

      // Caminho do arquivo de configuração
      const configPath = path.join(this.nginxSitesPath, `${tenant.domain}.conf`);
      
      // Escrever configuração
      await fs.writeFile(configPath, config);
      
      console.log(`✅ Configuração gerada: ${configPath}`);
      return configPath;
      
    } catch (error) {
      console.error(`❌ Erro ao gerar configuração Nginx:`, error);
      throw new Error(`Falha ao gerar configuração Nginx: ${error.message}`);
    }
  }

  /**
   * Ativa uma configuração de domínio
   */
  async enableDomain(domain) {
    try {
      console.log(`🔗 Ativando domínio: ${domain}`);
      
      const availablePath = path.join(this.nginxSitesPath, `${domain}.conf`);
      const enabledPath = path.join(this.nginxEnabledPath, `${domain}.conf`);
      
      // Criar symlink
      await fs.symlink(availablePath, enabledPath);
      
      console.log(`✅ Domínio ativado: ${domain}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao ativar domínio:`, error);
      throw new Error(`Falha ao ativar domínio: ${error.message}`);
    }
  }

  /**
   * Desativa uma configuração de domínio
   */
  async disableDomain(domain) {
    try {
      console.log(`🚫 Desativando domínio: ${domain}`);
      
      const enabledPath = path.join(this.nginxEnabledPath, `${domain}.conf`);
      
      // Remover symlink
      await fs.unlink(enabledPath);
      
      console.log(`✅ Domínio desativado: ${domain}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao desativar domínio:`, error);
      throw new Error(`Falha ao desativar domínio: ${error.message}`);
    }
  }

  /**
   * Testa configuração Nginx
   */
  async testConfig() {
    try {
      console.log('🧪 Testando configuração Nginx...');
      
      execSync('nginx -t', { stdio: 'inherit' });
      
      console.log('✅ Configuração Nginx válida!');
      return true;
      
    } catch (error) {
      console.error('❌ Erro na configuração Nginx:', error.message);
      throw new Error('Configuração Nginx inválida');
    }
  }

  /**
   * Recarrega configuração Nginx
   */
  async reloadNginx() {
    try {
      console.log('🔄 Recarregando Nginx...');
      
      // Testar antes de recarregar
      await this.testConfig();
      
      // Recarregar
      execSync('systemctl reload nginx', { stdio: 'inherit' });
      
      console.log('✅ Nginx recarregado com sucesso!');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao recarregar Nginx:', error.message);
      throw new Error('Falha ao recarregar Nginx');
    }
  }

  /**
   * Setup completo de um novo domínio
   */
  async setupDomain(tenant) {
    try {
      console.log(`🚀 Setup completo do domínio: ${tenant.domain}`);
      
      // 1. Gerar configuração
      await this.generateDomainConfig(tenant);
      
      // 2. Ativar domínio
      await this.enableDomain(tenant.domain);
      
      // 3. Testar e recarregar
      await this.reloadNginx();
      
      console.log(`🎉 Domínio ${tenant.domain} configurado com sucesso!`);
      
      return {
        success: true,
        domain: tenant.domain,
        message: 'Domínio configurado com sucesso'
      };
      
    } catch (error) {
      console.error(`❌ Falha no setup do domínio:`, error);
      
      // Rollback em caso de erro
      try {
        await this.disableDomain(tenant.domain);
      } catch (rollbackError) {
        console.error('❌ Falha no rollback:', rollbackError);
      }
      
      throw error;
    }
  }

  /**
   * Remove configuração de um domínio
   */
  async removeDomain(domain) {
    try {
      console.log(`🗑️ Removendo domínio: ${domain}`);
      
      // 1. Desativar
      await this.disableDomain(domain);
      
      // 2. Remover arquivo de configuração
      const configPath = path.join(this.nginxSitesPath, `${domain}.conf`);
      await fs.unlink(configPath);
      
      // 3. Recarregar Nginx
      await this.reloadNginx();
      
      console.log(`✅ Domínio ${domain} removido com sucesso!`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao remover domínio:`, error);
      throw new Error(`Falha ao remover domínio: ${error.message}`);
    }
  }

  /**
   * Lista domínios configurados
   */
  async listDomains() {
    try {
      const files = await fs.readdir(this.nginxEnabledPath);
      const domains = files
        .filter(file => file.endsWith('.conf'))
        .map(file => file.replace('.conf', ''));
      
      return domains;
      
    } catch (error) {
      console.error('❌ Erro ao listar domínios:', error);
      return [];
    }
  }

  /**
   * Status de um domínio específico
   */
  async getDomainStatus(domain) {
    try {
      const enabledPath = path.join(this.nginxEnabledPath, `${domain}.conf`);
      
      // Verificar se está ativo
      try {
        await fs.access(enabledPath);
        return {
          domain,
          active: true,
          nginx_config: true
        };
      } catch {
        return {
          domain,
          active: false,
          nginx_config: false
        };
      }
      
    } catch (error) {
      return {
        domain,
        active: false,
        nginx_config: false,
        error: error.message
      };
    }
  }
}

module.exports = NginxManager;