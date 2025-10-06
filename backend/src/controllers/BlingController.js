const BlingMultiTenantService = require('../services/BlingMultiTenantService');
const db = require('../database/connection');

class BlingController {
  // Instâncias são criadas por tenant conforme necessário
  getTenantBlingService(tenantId) {
    return new BlingMultiTenantService(tenantId);
  }

  /**
   * Configura autenticação inicial com Bling
   * GET /api/bling/auth/url
   */
  /**
   * Configura credenciais da integração Bling (por tenant)
   * POST /api/bling/auth/config
   */
  async configureIntegration(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado',
          message: 'Contexto de tenant é obrigatório'
        });
      }

      const { client_id, client_secret, company_name, sync_settings } = req.body;

      if (!client_id || !client_secret) {
        return res.status(400).json({
          error: 'Dados incompletos',
          message: 'Client ID e Client Secret são obrigatórios'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      
      // Criar/atualizar configuração da integração
      const integration = await blingService.upsertTenantIntegration({
        client_id,
        client_secret,
        company_name,
        sync_settings,
        status: 'configured'
      });

      res.json({
        message: 'Configuração salva com sucesso',
        integration: {
          id: integration.id,
          company_name: integration.company_name,
          status: integration.status,
          created_at: integration.created_at
        }
      });
    } catch (error) {
      console.error('Erro ao configurar integração:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }

  async getAuthUrl(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      const integration = await blingService.getTenantIntegration();
      
      if (!integration || !integration.client_id) {
        return res.status(400).json({
          error: 'Integração não configurada',
          message: 'Configure primeiro o Client ID e Client Secret'
        });
      }

      const redirectUri = process.env.BLING_REDIRECT_URI || 'http://localhost:3333/api/bling/auth/callback';
      const state = `${tenantId}_${Date.now()}`; // Incluir tenant no state

      const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${integration.client_id}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      res.json({
        authUrl,
        state,
        message: 'Acesse a URL para autorizar a integração com o Bling'
      });
    } catch (error) {
      console.error('Erro ao gerar URL de autenticação:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Não foi possível gerar URL de autenticação'
      });
    }
  }

  /**
   * Callback de autenticação OAuth2
   * GET /api/bling/auth/callback?code=...&state=...
   */
  async authCallback(req, res) {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.status(400).json({
          error: 'Autorização negada',
          message: 'Usuário negou acesso ao Bling'
        });
      }

      if (!code || !state) {
        return res.status(400).json({
          error: 'Dados inválidos',
          message: 'Código de autorização ou state não recebidos'
        });
      }

      // Extrair tenantId do state
      const [tenantId] = state.split('_');
      if (!tenantId) {
        return res.status(400).json({
          error: 'State inválido',
          message: 'Não foi possível identificar o tenant'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      
      // Inicializar e autenticar
      await blingService.initialize();
      const tokenData = await blingService.authenticate(code);
      
      console.log(`✅ Token Bling obtido para tenant ${tenantId}:`, {
        access_token: tokenData.access_token.substring(0, 10) + '...',
        expires_in: tokenData.expires_in
      });

      // Testa a conexão
      const connectionTest = await blingService.testConnection();
      
      if (connectionTest) {
        res.json({
          success: true,
          message: 'Integração com Bling configurada com sucesso!',
          tenantId,
          expiresIn: tokenData.expires_in
        });
      } else {
        res.status(500).json({
          error: 'Falha na conexão',
          message: 'Token obtido mas não foi possível conectar com a API'
        });
      }

    } catch (error) {
      console.error('Erro no callback de autenticação:', error);
      res.status(500).json({
        error: 'Erro na autenticação',
        message: error.message
      });
    }
  }

  /**
   * Sincroniza produtos do Bling
   * POST /api/bling/sync/products
   */
  async syncProducts(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      console.log(`🔄 Iniciando sincronização de produtos do Bling (tenant ${tenantId})...`);
      
      const blingService = this.getTenantBlingService(tenantId);
      
      // Verifica conexão
      const isConnected = await blingService.testConnection();
      if (!isConnected) {
        return res.status(400).json({
          error: 'Bling não conectado',
          message: 'Configure a integração com o Bling primeiro'
        });
      }

      // Sincroniza produtos (já salva no banco automaticamente)
      const syncedProducts = await blingService.syncProducts();
      
      if (!syncedProducts || syncedProducts.length === 0) {
        return res.json({
          success: true,
          message: 'Nenhum produto encontrado no Bling',
          synchronized: 0
        });
      }

      res.json({
        success: true,
        message: `Sincronização concluída: ${syncedProducts.length} produtos processados`,
        synchronized: syncedProducts.length,
        tenant_id: tenantId,
        products: syncedProducts.map(p => ({
          id: p.bling_id,
          nome: p.nome,
          preco: p.preco,
          categoria: p.categoria,
          estoque: p.estoque
        }))
      });

    } catch (error) {
      console.error('Erro na sincronização de produtos:', error);
      res.status(500).json({
        error: 'Erro na sincronização',
        message: error.message
      });
    }
  }

  /**
   * Verifica status da conexão com Bling
   * GET /api/bling/status
   */
  async getStatus(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      const stats = await blingService.getIntegrationStats();
      
      if (!stats) {
        return res.json({
          connected: false,
          message: 'Integração não configurada',
          tenant_id: tenantId
        });
      }

      const isConnected = await blingService.testConnection();
      
      res.json({
        connected: isConnected,
        tenant_id: tenantId,
        integration: {
          id: stats.integration.id,
          status: stats.integration.status,
          company_name: stats.integration.company_name,
          products_synced: stats.products_synced,
          orders_created: stats.orders_created,
          last_sync: stats.last_sync,
          created_at: stats.integration.created_at
        },
        stats: stats.stats,
        message: isConnected ? 'Integração ativa' : 'Erro de conexão'
      });
    } catch (error) {
      res.json({
        connected: false,
        error: error.message,
        tenant_id: req.tenant?.id
      });
    }
  }

  /**
   * Lista categorias do Bling
   * GET /api/bling/categories
   */
  async getCategories(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      
      // Buscar categorias mapeadas do tenant
      const categories = await db('bling_category_mappings')
        .where('tenant_id', tenantId)
        .select('*');

      res.json({
        success: true,
        tenant_id: tenantId,
        categories: categories || []
      });
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      res.status(500).json({
        error: 'Erro ao buscar categorias',
        message: error.message
      });
    }
  }

  /**
   * Cria pedido no Bling a partir de um pedido da vitrine
   * POST /api/bling/orders
   */
  async createOrder(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { 
        cliente, 
        itens, 
        total, 
        formaPagamento,
        observacoes 
      } = req.body;

      // Valida dados obrigatórios
      if (!cliente || !itens || !total) {
        return res.status(400).json({
          error: 'Dados incompletos',
          message: 'Cliente, itens e total são obrigatórios'
        });
      }

      const blingService = this.getTenantBlingService(tenantId);
      
      // Cria o pedido no Bling
      const orderData = {
        numero: `WEB-${tenantId}-${Date.now()}`,
        cliente,
        itens,
        total,
        formaPagamento,
        observacoes
      };

      const blingOrder = await blingService.createOrder(orderData);

      res.json({
        success: true,
        message: 'Pedido criado no Bling com sucesso',
        tenant_id: tenantId,
        blingOrderId: blingOrder.id,
        orderNumber: orderData.numero
      });

    } catch (error) {
      console.error('Erro ao criar pedido no Bling:', error);
      res.status(500).json({
        error: 'Erro ao criar pedido',
        message: error.message
      });
    }
  }

  /**
   * Webhook para receber atualizações do Bling (multi-tenant)
   * POST /api/bling/webhook/:tenantId/:webhookKey
   */
  async webhook(req, res) {
    try {
      const { tenantId, webhookKey } = req.params;
      const eventData = req.body;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant ID é obrigatório na URL'
        });
      }

      console.log(`🔔 Webhook recebido do Bling (tenant ${tenantId}):`, eventData);

      const blingService = this.getTenantBlingService(tenantId);
      
      // Processar webhook específico do tenant
      const result = await blingService.processWebhook(eventData, webhookKey);

      res.json({ 
        received: true,
        tenant_id: tenantId,
        event: eventData.event,
        processed: !!result
      });

    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).json({
        error: 'Erro no processamento do webhook',
        message: error.message
      });
    }
  }

  /**
   * Obtém histórico de sincronização
   * GET /api/bling/sync/history
   */
  async getSyncHistory(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      const { limit = 50 } = req.query;
      const blingService = this.getTenantBlingService(tenantId);
      
      const history = await blingService.getSyncHistory(parseInt(limit));

      res.json({
        success: true,
        tenant_id: tenantId,
        history
      });
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({
        error: 'Erro ao buscar histórico',
        message: error.message
      });
    }
  }

  /**
   * Remove integração do tenant
   * DELETE /api/bling/integration
   */
  async removeIntegration(req, res) {
    try {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant não identificado'
        });
      }

      // Desativar integração
      await db('bling_integrations')
        .where('tenant_id', tenantId)
        .update({
          status: 'inactive',
          access_token: null,
          refresh_token: null,
          updated_at: new Date()
        });

      res.json({
        success: true,
        message: 'Integração removida com sucesso',
        tenant_id: tenantId
      });
    } catch (error) {
      console.error('Erro ao remover integração:', error);
      res.status(500).json({
        error: 'Erro ao remover integração',
        message: error.message
      });
    }
  }
}

module.exports = BlingController;