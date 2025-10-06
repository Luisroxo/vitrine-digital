const axios = require('axios');

/**
 * Serviço de integração com Bling ERP API
 * Baseado na análise dos repositórios:
 * - AlexandreBellas/bling-erp-api-js (JavaScript/TypeScript)
 * - AlexandreBellas/bling-erp-api-php (PHP)
 */
class BlingService {
  constructor() {
    this.baseURL = 'https://www.bling.com.br/Api/v3';
    this.accessToken = process.env.BLING_ACCESS_TOKEN;
    this.clientId = process.env.BLING_CLIENT_ID;
    this.clientSecret = process.env.BLING_CLIENT_SECRET;
    
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Interceptor para adicionar token em todas as requisições
    this.api.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Interceptor para tratamento de erros
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Erro na API Bling:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Autentica na API Bling usando OAuth2
   * @param {string} code - Código de autorização
   * @returns {Promise<Object>} Token de acesso
   */
  async authenticate(code) {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      return response.data;
    } catch (error) {
      throw new Error(`Erro na autenticação Bling: ${error.message}`);
    }
  }

  /**
   * Atualiza o token de acesso usando refresh token
   * @param {string} refreshToken - Token de atualização
   * @returns {Promise<Object>} Novo token de acesso
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      return response.data;
    } catch (error) {
      throw new Error(`Erro ao renovar token Bling: ${error.message}`);
    }
  }

  /**
   * PRODUTOS - Endpoints baseados na análise do repositório
   */

  /**
   * Lista produtos do Bling
   * @param {Object} params - Parâmetros de filtro
   * @returns {Promise<Array>} Lista de produtos
   */
  async getProducts(params = {}) {
    try {
      const response = await this.api.get('/produtos', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      return [];
    }
  }

  /**
   * Busca produto específico por ID
   * @param {number} productId - ID do produto
   * @returns {Promise<Object|null>} Produto encontrado
   */
  async getProduct(productId) {
    try {
      const response = await this.api.get(`/produtos/${productId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao buscar produto ${productId}:`, error);
      return null;
    }
  }

  /**
   * Sincroniza produtos do Bling para a vitrine
   * @returns {Promise<Array>} Produtos formatados para a vitrine
   */
  async syncProducts() {
    try {
      const blingProducts = await this.getProducts({
        tipo: 'P', // Apenas produtos (não serviços)
        situacao: 'Ativo'
      });

      // Formata produtos para o padrão da vitrine
      return blingProducts.map(product => ({
        id: product.id,
        nome: product.nome,
        preco: product.preco || 0,
        precoPromocional: product.precoPromocional || null,
        descricao: product.descricao || '',
        categoria: product.categoria?.descricao || 'Geral',
        imagem: product.imagem?.link || 'https://via.placeholder.com/300x200',
        codigo: product.codigo,
        estoque: product.estoque?.saldoVirtualTotal || 0,
        ativo: product.situacao === 'Ativo',
        dataAtualizacao: new Date(),
        // Campos específicos do Bling
        blingData: {
          id: product.id,
          codigo: product.codigo,
          gtin: product.gtin,
          categoria: product.categoria,
          marca: product.marca,
          peso: product.pesoBruto,
          dimensoes: product.dimensoes
        }
      }));
    } catch (error) {
      console.error('Erro na sincronização de produtos:', error);
      throw error;
    }
  }

  /**
   * PEDIDOS DE VENDA - Funcionalidades para e-commerce
   */

  /**
   * Cria pedido de venda no Bling
   * @param {Object} orderData - Dados do pedido
   * @returns {Promise<Object>} Pedido criado
   */
  async createOrder(orderData) {
    try {
      const blingOrder = {
        numero: orderData.numero || Date.now(),
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
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      throw error;
    }
  }

  /**
   * ESTOQUE - Controle de estoque
   */

  /**
   * Verifica estoque de um produto
   * @param {number} productId - ID do produto
   * @returns {Promise<Object>} Informações de estoque
   */
  async checkStock(productId) {
    try {
      const response = await this.api.get(`/estoques/${productId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao verificar estoque do produto ${productId}:`, error);
      return { saldo: 0 };
    }
  }

  /**
   * CATEGORIAS - Gestão de categorias
   */

  /**
   * Lista categorias de produtos
   * @returns {Promise<Array>} Categorias disponíveis
   */
  async getCategories() {
    try {
      const response = await this.api.get('/categorias/produtos');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      return [];
    }
  }

  /**
   * CONTATOS - Gestão de clientes
   */

  /**
   * Cria ou atualiza contato (cliente)
   * @param {Object} contactData - Dados do contato
   * @returns {Promise<Object>} Contato criado/atualizado
   */
  async createOrUpdateContact(contactData) {
    try {
      const blingContact = {
        nome: contactData.nome,
        email: contactData.email,
        telefone: contactData.telefone,
        tipoPessoa: contactData.cpf ? 'F' : 'J', // Física ou Jurídica
        cpfCnpj: contactData.cpf || contactData.cnpj,
        endereco: contactData.endereco ? {
          endereco: contactData.endereco.logradouro,
          numero: contactData.endereco.numero,
          complemento: contactData.endereco.complemento,
          bairro: contactData.endereco.bairro,
          cep: contactData.endereco.cep,
          municipio: contactData.endereco.cidade,
          uf: contactData.endereco.estado
        } : null
      };

      const response = await this.api.post('/contatos', blingContact);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar/atualizar contato:', error);
      throw error;
    }
  }

  /**
   * Utilitários para configuração inicial
   */

  /**
   * Testa conexão com a API Bling
   * @returns {Promise<boolean>} Status da conexão
   */
  async testConnection() {
    try {
      await this.api.get('/produtos', { params: { limite: 1 } });
      return true;
    } catch (error) {
      console.error('Falha na conexão com Bling:', error.message);
      return false;
    }
  }

  /**
   * Obtém configurações da empresa no Bling
   * @returns {Promise<Object>} Dados da empresa
   */
  async getCompanyInfo() {
    try {
      const response = await this.api.get('/empresas');
      return response.data.data?.[0] || null;
    } catch (error) {
      console.error('Erro ao obter dados da empresa:', error);
      return null;
    }
  }
}

module.exports = BlingService;