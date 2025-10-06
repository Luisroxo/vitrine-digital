const BlingService = require('../services/BlingService');
const connection = require('../database/connection');

class BlingController {
  constructor() {
    this.blingService = new BlingService();
  }

  /**
   * Configura autenticação inicial com Bling
   * GET /api/bling/auth/url
   */
  async getAuthUrl(req, res) {
    try {
      const clientId = process.env.BLING_CLIENT_ID;
      const redirectUri = process.env.BLING_REDIRECT_URI || 'http://localhost:3333/api/bling/auth/callback';
      const state = Date.now().toString(); // State para segurança
      
      const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
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

      if (!code) {
        return res.status(400).json({
          error: 'Código inválido',
          message: 'Código de autorização não recebido'
        });
      }

      // Troca o código pelo token
      const tokenData = await this.blingService.authenticate(code);
      
      // Salva o token no banco de dados (ou variável de ambiente)
      // TODO: Implementar armazenamento seguro do token
      console.log('Token Bling obtido:', {
        access_token: tokenData.access_token.substring(0, 10) + '...',
        expires_in: tokenData.expires_in
      });

      // Testa a conexão
      const connectionTest = await this.blingService.testConnection();
      
      if (connectionTest) {
        // Busca dados da empresa
        const companyInfo = await this.blingService.getCompanyInfo();
        
        res.json({
          success: true,
          message: 'Integração com Bling configurada com sucesso!',
          company: companyInfo?.razaoSocial || 'Empresa conectada',
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
      console.log('Iniciando sincronização de produtos do Bling...');
      
      // Verifica conexão
      const isConnected = await this.blingService.testConnection();
      if (!isConnected) {
        return res.status(400).json({
          error: 'Bling não conectado',
          message: 'Configure a integração com o Bling primeiro'
        });
      }

      // Sincroniza produtos
      const blingProducts = await this.blingService.syncProducts();
      
      if (!blingProducts || blingProducts.length === 0) {
        return res.json({
          success: true,
          message: 'Nenhum produto encontrado no Bling',
          synchronized: 0
        });
      }

      // Salva produtos no banco local
      let synchronized = 0;
      const errors = [];

      for (const product of blingProducts) {
        try {
          // Verifica se produto já existe
          const existingProduct = await connection('products')
            .where('bling_id', product.id)
            .first();

          if (existingProduct) {
            // Atualiza produto existente
            await connection('products')
              .where('bling_id', product.id)
              .update({
                nome: product.nome,
                preco: product.preco,
                preco_promocional: product.precoPromocional,
                descricao: product.descricao,
                categoria: product.categoria,
                imagem: product.imagem,
                codigo: product.codigo,
                estoque: product.estoque,
                ativo: product.ativo,
                bling_data: JSON.stringify(product.blingData),
                updated_at: connection.fn.now()
              });
          } else {
            // Insere novo produto
            await connection('products').insert({
              nome: product.nome,
              preco: product.preco,
              preco_promocional: product.precoPromocional,
              descricao: product.descricao,
              categoria: product.categoria,
              imagem: product.imagem,
              codigo: product.codigo,
              estoque: product.estoque,
              ativo: product.ativo,
              bling_id: product.id,
              bling_data: JSON.stringify(product.blingData),
              created_at: connection.fn.now(),
              updated_at: connection.fn.now()
            });
          }
          
          synchronized++;
        } catch (productError) {
          console.error(`Erro ao salvar produto ${product.id}:`, productError);
          errors.push({
            productId: product.id,
            productName: product.nome,
            error: productError.message
          });
        }
      }

      res.json({
        success: true,
        message: `Sincronização concluída: ${synchronized} produtos processados`,
        synchronized,
        total: blingProducts.length,
        errors: errors.length > 0 ? errors : undefined
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
      const isConnected = await this.blingService.testConnection();
      
      if (isConnected) {
        const companyInfo = await this.blingService.getCompanyInfo();
        res.json({
          connected: true,
          company: companyInfo?.razaoSocial || 'Conectado',
          message: 'Integração ativa'
        });
      } else {
        res.json({
          connected: false,
          message: 'Bling não conectado'
        });
      }
    } catch (error) {
      res.json({
        connected: false,
        error: error.message
      });
    }
  }

  /**
   * Lista categorias do Bling
   * GET /api/bling/categories
   */
  async getCategories(req, res) {
    try {
      const categories = await this.blingService.getCategories();
      res.json({
        success: true,
        categories
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

      // Cria contato no Bling se necessário
      let blingContact = null;
      if (cliente.email) {
        try {
          blingContact = await this.blingService.createOrUpdateContact(cliente);
        } catch (contactError) {
          console.warn('Erro ao criar contato no Bling:', contactError.message);
        }
      }

      // Cria o pedido no Bling
      const orderData = {
        numero: `WEB-${Date.now()}`,
        cliente,
        itens,
        total,
        formaPagamento,
        observacoes,
        contactId: blingContact?.id
      };

      const blingOrder = await this.blingService.createOrder(orderData);

      res.json({
        success: true,
        message: 'Pedido criado no Bling com sucesso',
        blingOrderId: blingOrder.id,
        orderNumber: blingOrder.numero
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
   * Webhook para receber atualizações do Bling
   * POST /api/bling/webhook
   */
  async webhook(req, res) {
    try {
      const { evento, dados } = req.body;
      
      console.log('Webhook recebido do Bling:', { evento, dados });

      switch (evento) {
        case 'produto.atualizado':
          // Atualiza produto no banco local
          await this.handleProductUpdate(dados);
          break;
          
        case 'estoque.alterado':
          // Atualiza estoque no banco local
          await this.handleStockUpdate(dados);
          break;
          
        case 'pedido.alterado':
          // Processa alteração de status do pedido
          await this.handleOrderUpdate(dados);
          break;
          
        default:
          console.log('Evento não tratado:', evento);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).json({
        error: 'Erro no processamento do webhook'
      });
    }
  }

  // Métodos auxiliares para webhook
  async handleProductUpdate(data) {
    try {
      if (data.id) {
        const product = await this.blingService.getProduct(data.id);
        if (product) {
          await connection('products')
            .where('bling_id', data.id)
            .update({
              nome: product.nome,
              preco: product.preco,
              updated_at: connection.fn.now()
            });
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar produto via webhook:', error);
    }
  }

  async handleStockUpdate(data) {
    try {
      if (data.produtoId) {
        const stock = await this.blingService.checkStock(data.produtoId);
        await connection('products')
          .where('bling_id', data.produtoId)
          .update({
            estoque: stock.saldo || 0,
            updated_at: connection.fn.now()
          });
      }
    } catch (error) {
      console.error('Erro ao atualizar estoque via webhook:', error);
    }
  }

  async handleOrderUpdate(data) {
    // Implementar lógica de atualização de pedidos conforme necessário
    console.log('Pedido atualizado no Bling:', data);
  }
}

module.exports = BlingController;