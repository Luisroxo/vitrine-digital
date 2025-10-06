const axios = require('axios');
const db = require('../database/connection');

/**
 * Serviço Multi-Tenant de integração com Bling ERP API
 * Cada tenant tem sua própria instância e configuração
 */
class BlingMultiTenantService {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.baseURL = 'https://www.bling.com.br/Api/v3';
    this.integration = null;
    this.api = null;
    
    // Cache para evitar múltiplas consultas à config
    this.configCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Inicializa a integração para o tenant específico
   */
  async initialize() {
    try {
      // Buscar configuração da integração do tenant
      this.integration = await this.getTenantIntegration();
      
      if (!this.integration) {
        throw new Error(`Integração Bling não configurada para o tenant ${this.tenantId}`);
      }

      // Configurar cliente axios com tokens do tenant
      this.api = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Interceptor para adicionar token específico do tenant
      this.api.interceptors.request.use(async (config) => {
        const integration = await this.getTenantIntegration();
        if (integration?.access_token) {
          config.headers.Authorization = `Bearer ${integration.access_token}`;
        }
        return config;
      });

      // Interceptor para tratamento de erros e refresh token
      this.api.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response?.status === 401) {
            // Token expirado, tentar renovar
            try {
              await this.refreshAccessToken();
              // Repetir a requisição original
              return this.api.request(error.config);
            } catch (refreshError) {
              console.error(`Erro ao renovar token para tenant ${this.tenantId}:`, refreshError);
              await this.logError('auth', refreshError.message);
            }
          }
          
          console.error(`Erro na API Bling (tenant ${this.tenantId}):`, error.response?.data || error.message);
          throw error;
        }
      );

      return true;
    } catch (error) {
      console.error(`Erro ao inicializar Bling para tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém configuração da integração Bling do tenant
   */
  async getTenantIntegration() {
    try {
      // Verificar cache primeiro
      const cacheKey = `integration_${this.tenantId}`;
      const cached = this.configCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        return cached.data;
      }

      // Buscar no banco de dados
      const integration = await db('bling_integrations')
        .where('tenant_id', this.tenantId)
        .where('status', 'active')
        .first();

      // Atualizar cache
      this.configCache.set(cacheKey, {
        data: integration,
        timestamp: Date.now()
      });

      return integration;
    } catch (error) {
      console.error(`Erro ao buscar integração do tenant ${this.tenantId}:`, error);
      return null;
    }
  }

  /**
   * Cria ou atualiza configuração de integração do tenant
   */
  async upsertTenantIntegration(config) {
    try {
      const existing = await db('bling_integrations')
        .where('tenant_id', this.tenantId)
        .first();

      const integrationData = {
        tenant_id: this.tenantId,
        client_id: config.client_id,
        client_secret: config.client_secret,
        access_token: config.access_token || null,
        refresh_token: config.refresh_token || null,
        token_expires_at: config.token_expires_at || null,
        company_name: config.company_name || null,
        company_cnpj: config.company_cnpj || null,
        company_id: config.company_id || null,
        sync_settings: config.sync_settings || null,
        status: config.status || 'pending',
        updated_at: new Date()
      };

      let result;
      if (existing) {
        result = await db('bling_integrations')
          .where('tenant_id', this.tenantId)
          .update(integrationData);
        result = { ...existing, ...integrationData };
      } else {
        integrationData.created_at = new Date();
        const [id] = await db('bling_integrations').insert(integrationData);
        result = { id, ...integrationData };
      }

      // Limpar cache
      this.configCache.delete(`integration_${this.tenantId}`);
      
      return result;
    } catch (error) {
      console.error(`Erro ao salvar integração do tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Autentica na API Bling usando OAuth2 (específico do tenant)
   */
  async authenticate(code) {
    try {
      if (!this.integration) {
        throw new Error('Integração não inicializada');
      }

      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: this.integration.client_id,
        client_secret: this.integration.client_secret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      
      // Calcular expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Atualizar configuração do tenant
      await this.upsertTenantIntegration({
        ...this.integration,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        status: 'active'
      });

      await this.logOperation('auth', 'success', 'Autenticação OAuth2 realizada com sucesso');
      
      return tokenData;
    } catch (error) {
      await this.logError('auth', `Erro na autenticação: ${error.message}`);
      throw new Error(`Erro na autenticação Bling (tenant ${this.tenantId}): ${error.message}`);
    }
  }

  /**
   * Renova o token de acesso usando refresh token
   */
  async refreshAccessToken() {
    try {
      const integration = await this.getTenantIntegration();
      
      if (!integration?.refresh_token) {
        throw new Error('Refresh token não disponível');
      }

      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        client_id: integration.client_id,
        client_secret: integration.client_secret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData = response.data;
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Atualizar tokens
      await this.upsertTenantIntegration({
        ...integration,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || integration.refresh_token,
        token_expires_at: expiresAt,
        status: 'active'
      });

      console.log(`✅ Token renovado para tenant ${this.tenantId}`);
      return tokenData;
    } catch (error) {
      await this.logError('auth', `Erro ao renovar token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Testa conexão com a API Bling (específico do tenant)
   */
  async testConnection() {
    try {
      if (!this.api) {
        await this.initialize();
      }

      const response = await this.api.get('/produtos', { params: { limite: 1 } });
      
      // Atualizar status da integração
      await this.upsertTenantIntegration({
        ...this.integration,
        status: 'active',
        last_error: null,
        last_error_at: null
      });

      return true;
    } catch (error) {
      console.error(`Falha na conexão com Bling (tenant ${this.tenantId}):`, error.message);
      
      // Atualizar status de erro
      await this.upsertTenantIntegration({
        ...this.integration,
        status: 'error',
        last_error: error.message,
        last_error_at: new Date()
      });

      return false;
    }
  }

  /**
   * Sincroniza produtos do Bling para a vitrine (isolado por tenant)
   */
  async syncProducts() {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsSuccess = 0;
    let recordsError = 0;

    try {
      if (!this.api) {
        await this.initialize();
      }

      console.log(`🔄 Iniciando sincronização de produtos (tenant ${this.tenantId})`);

      // Buscar produtos do Bling
      const blingProducts = await this.getProducts({
        tipo: 'P', // Apenas produtos
        situacao: 'Ativo'
      });

      recordsProcessed = blingProducts.length;

      if (recordsProcessed === 0) {
        await this.logOperation('sync_products', 'success', 'Nenhum produto encontrado para sincronizar', {
          records_processed: 0,
          records_success: 0,
          records_error: 0,
          duration_ms: Date.now() - startTime
        });
        return [];
      }

      const integration = await this.getTenantIntegration();
      const formattedProducts = [];

      // Processar cada produto
      for (const product of blingProducts) {
        try {
          const formattedProduct = {
            tenant_id: this.tenantId,
            bling_integration_id: integration.id,
            bling_id: product.id,
            nome: product.nome,
            preco: parseFloat(product.preco) || 0,
            precoPromocional: product.precoPromocional ? parseFloat(product.precoPromocional) : null,
            descricao: product.descricao || '',
            categoria: product.categoria?.descricao || 'Geral',
            imagem: product.imagem?.link || 'https://via.placeholder.com/300x200',
            codigo: product.codigo,
            estoque: product.estoque?.saldoVirtualTotal || 0,
            ativo: product.situacao === 'Ativo',
            bling_sync: true,
            bling_data: {
              id: product.id,
              codigo: product.codigo,
              gtin: product.gtin,
              categoria: product.categoria,
              marca: product.marca,
              peso: product.pesoBruto,
              dimensoes: product.dimensoes
            },
            bling_last_updated: new Date(),
            bling_has_conflicts: false,
            last_bling_sync: new Date(),
            updated_at: new Date()
          };

          // Verificar se produto já existe
          const existingProduct = await db('products')
            .where('tenant_id', this.tenantId)
            .where('bling_id', product.id)
            .first();

          if (existingProduct) {
            // Atualizar produto existente
            await db('products')
              .where('tenant_id', this.tenantId)
              .where('bling_id', product.id)
              .update(formattedProduct);
          } else {
            // Criar novo produto
            formattedProduct.created_at = new Date();
            await db('products').insert(formattedProduct);
          }

          formattedProducts.push(formattedProduct);
          recordsSuccess++;
        } catch (productError) {
          console.error(`Erro ao processar produto ${product.id}:`, productError);
          recordsError++;
        }
      }

      // Atualizar estatísticas da integração
      await this.upsertTenantIntegration({
        ...integration,
        products_synced: recordsSuccess,
        last_sync_at: new Date(),
        first_sync_at: integration.first_sync_at || new Date()
      });

      await this.logOperation('sync_products', 'success', `Sincronização concluída: ${recordsSuccess}/${recordsProcessed} produtos`, {
        records_processed: recordsProcessed,
        records_success: recordsSuccess,
        records_error: recordsError,
        duration_ms: Date.now() - startTime
      });

      console.log(`✅ Sincronização concluída (tenant ${this.tenantId}): ${recordsSuccess}/${recordsProcessed} produtos`);
      
      return formattedProducts;
    } catch (error) {
      recordsError = recordsProcessed - recordsSuccess;
      
      await this.logError('sync_products', `Erro na sincronização: ${error.message}`, {
        records_processed: recordsProcessed,
        records_success: recordsSuccess,
        records_error: recordsError,
        duration_ms: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Lista produtos do Bling (com token do tenant)
   */
  async getProducts(params = {}) {
    try {
      if (!this.api) {
        await this.initialize();
      }

      const response = await this.api.get('/produtos', { params });
      return response.data.data || [];
    } catch (error) {
      console.error(`Erro ao buscar produtos (tenant ${this.tenantId}):`, error);
      return [];
    }
  }

  /**
   * Cria pedido de venda no Bling (isolado por tenant)
   */
  async createOrder(orderData) {
    const startTime = Date.now();
    
    try {
      if (!this.api) {
        await this.initialize();
      }

      const blingOrder = {
        numero: orderData.numero || `VIT-${this.tenantId}-${Date.now()}`,
        data: new Date().toISOString().split('T')[0],
        contato: {
          nome: orderData.cliente.nome,
          email: orderData.cliente.email,
          telefone: orderData.cliente.telefone
        },
        itens: orderData.itens.map(item => ({
          produto: {
            id: item.produtoId
          },
          quantidade: item.quantidade,
          valor: item.preco
        })),
        parcelas: [{
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: orderData.total,
          formaPagamento: {
            id: 1 // Configurar IDs das formas de pagamento
          }
        }]
      };

      const response = await this.api.post('/pedidos/vendas', blingOrder);
      
      // Atualizar estatísticas
      const integration = await this.getTenantIntegration();
      await this.upsertTenantIntegration({
        ...integration,
        orders_created: (integration.orders_created || 0) + 1
      });

      await this.logOperation('create_order', 'success', `Pedido criado: ${response.data.data.id}`, {
        order_id: response.data.data.id,
        order_number: blingOrder.numero,
        total_value: orderData.total,
        duration_ms: Date.now() - startTime
      });

      return response.data.data;
    } catch (error) {
      await this.logError('create_order', `Erro ao criar pedido: ${error.message}`, {
        duration_ms: Date.now() - startTime
      });

      console.error(`Erro ao criar pedido (tenant ${this.tenantId}):`, error);
      throw error;
    }
  }

  /**
   * Processa webhook específico do tenant
   */
  async processWebhook(eventData, webhookKey) {
    try {
      const integration = await this.getTenantIntegration();
      
      // Verificar chave do webhook
      if (integration.webhook_key && integration.webhook_key !== webhookKey) {
        throw new Error('Chave de webhook inválida');
      }

      console.log(`🔔 Processando webhook (tenant ${this.tenantId}):`, eventData.event);

      let result = null;

      switch (eventData.event) {
        case 'produto.alterado':
        case 'produto.criado':
          result = await this.handleProductWebhook(eventData);
          break;
          
        case 'estoque.alterado':
          result = await this.handleStockWebhook(eventData);
          break;
          
        default:
          console.log(`Evento webhook não processado: ${eventData.event}`);
          break;
      }

      await this.logOperation('webhook', 'success', `Webhook processado: ${eventData.event}`, {
        event: eventData.event,
        data: eventData
      });

      return result;
    } catch (error) {
      await this.logError('webhook', `Erro no webhook: ${error.message}`, {
        event: eventData?.event,
        data: eventData
      });
      throw error;
    }
  }

  /**
   * Processa webhook de produto
   */
  async handleProductWebhook(eventData) {
    try {
      // Buscar produto atualizado no Bling
      const product = await this.getProduct(eventData.data.id);
      
      if (!product) {
        console.log(`Produto ${eventData.data.id} não encontrado no Bling`);
        return null;
      }

      // Sincronizar produto específico
      const integration = await this.getTenantIntegration();
      
      const formattedProduct = {
        tenant_id: this.tenantId,
        bling_integration_id: integration.id,
        bling_id: product.id,
        nome: product.nome,
        preco: parseFloat(product.preco) || 0,
        precoPromocional: product.precoPromocional ? parseFloat(product.precoPromocional) : null,
        descricao: product.descricao || '',
        categoria: product.categoria?.descricao || 'Geral',
        imagem: product.imagem?.link || 'https://via.placeholder.com/300x200',
        codigo: product.codigo,
        estoque: product.estoque?.saldoVirtualTotal || 0,
        ativo: product.situacao === 'Ativo',
        bling_sync: true,
        bling_data: product,
        bling_last_updated: new Date(),
        last_bling_sync: new Date(),
        updated_at: new Date()
      };

      // Atualizar/inserir produto
      const existingProduct = await db('products')
        .where('tenant_id', this.tenantId)
        .where('bling_id', product.id)
        .first();

      if (existingProduct) {
        await db('products')
          .where('tenant_id', this.tenantId)
          .where('bling_id', product.id)
          .update(formattedProduct);
      } else {
        formattedProduct.created_at = new Date();
        await db('products').insert(formattedProduct);
      }

      return formattedProduct;
    } catch (error) {
      console.error(`Erro ao processar webhook de produto:`, error);
      throw error;
    }
  }

  /**
   * Busca produto específico por ID
   */
  async getProduct(productId) {
    try {
      if (!this.api) {
        await this.initialize();
      }

      const response = await this.api.get(`/produtos/${productId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao buscar produto ${productId}:`, error);
      return null;
    }
  }

  /**
   * Registra operação no log
   */
  async logOperation(operation, status, message, details = {}) {
    try {
      const integration = await this.getTenantIntegration();
      
      await db('bling_sync_logs').insert({
        tenant_id: this.tenantId,
        integration_id: integration?.id || null,
        operation,
        status,
        message,
        details: JSON.stringify(details),
        records_processed: details.records_processed || 0,
        records_success: details.records_success || 0,
        records_error: details.records_error || 0,
        duration_ms: details.duration_ms || null,
        started_at: details.started_at || new Date(),
        completed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      console.error(`Erro ao registrar log (tenant ${this.tenantId}):`, error);
    }
  }

  /**
   * Registra erro no log
   */
  async logError(operation, message, details = {}) {
    await this.logOperation(operation, 'error', message, details);
  }

  /**
   * Obtém histórico de sincronização do tenant
   */
  async getSyncHistory(limit = 50) {
    try {
      return await db('bling_sync_logs')
        .where('tenant_id', this.tenantId)
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      console.error(`Erro ao buscar histórico (tenant ${this.tenantId}):`, error);
      return [];
    }
  }

  /**
   * Obtém estatísticas da integração
   */
  async getIntegrationStats() {
    try {
      const integration = await this.getTenantIntegration();
      
      if (!integration) {
        return null;
      }

      // Estatísticas dos últimos logs
      const recentLogs = await db('bling_sync_logs')
        .where('tenant_id', this.tenantId)
        .where('created_at', '>=', db.raw("date('now', '-30 days')"))
        .select(
          db.raw('COUNT(*) as total_operations'),
          db.raw('SUM(CASE WHEN status = "success" THEN 1 ELSE 0 END) as successful_operations'),
          db.raw('SUM(CASE WHEN status = "error" THEN 1 ELSE 0 END) as failed_operations'),
          db.raw('SUM(records_processed) as total_records_processed'),
          db.raw('AVG(duration_ms) as avg_duration_ms')
        )
        .first();

      return {
        integration: integration,
        stats: recentLogs,
        products_synced: integration.products_synced || 0,
        orders_created: integration.orders_created || 0,
        last_sync: integration.last_sync_at,
        status: integration.status
      };
    } catch (error) {
      console.error(`Erro ao buscar estatísticas (tenant ${this.tenantId}):`, error);
      return null;
    }
  }
}

module.exports = BlingMultiTenantService;