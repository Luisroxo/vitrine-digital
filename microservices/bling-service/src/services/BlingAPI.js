const axios = require('axios');
const crypto = require('crypto');
const { Logger } = require('../../shared');

class BlingAPI {
  constructor() {
    this.baseURL = process.env.BLING_API_URL || 'https://bling.com.br/Api/v3';
    this.clientId = process.env.BLING_CLIENT_ID;
    this.clientSecret = process.env.BLING_CLIENT_SECRET;
    this.redirectUri = process.env.BLING_REDIRECT_URI;
    this.logger = new Logger('bling-api');
    
    // Rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  // OAuth2 Authorization
  generateAuthURL(tenantId, state = null) {
    const stateParam = state || crypto.randomBytes(32).toString('hex');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'products orders contacts inventory webhooks',
      state: `${tenantId}:${stateParam}`
    });
    
    return `${this.baseURL}/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code, tenantId) {
    try {
      const response = await this.makeRequest('POST', '/oauth/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code
      });

      return {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        token_type: response.token_type,
        scope: response.scope
      };
    } catch (error) {
      this.logger.error('Token exchange failed', { tenantId, error: error.message });
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(refreshToken, tenantId) {
    try {
      const response = await this.makeRequest('POST', '/oauth/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      });

      return {
        access_token: response.access_token,
        refresh_token: response.refresh_token || refreshToken, // Bling may not return new refresh token
        expires_in: response.expires_in,
        token_type: response.token_type,
        scope: response.scope
      };
    } catch (error) {
      this.logger.error('Token refresh failed', { tenantId, error: error.message });
      throw error;
    }
  }

  // Products API
  async getProducts(accessToken, page = 1, limit = 100, filters = {}) {
    const params = {
      page,
      limit,
      ...filters
    };

    return this.makeAuthenticatedRequest('GET', '/products', params, accessToken);
  }

  async getProduct(accessToken, productId) {
    return this.makeAuthenticatedRequest('GET', `/products/${productId}`, null, accessToken);
  }

  async createProduct(accessToken, productData) {
    return this.makeAuthenticatedRequest('POST', '/products', productData, accessToken);
  }

  async updateProduct(accessToken, productId, productData) {
    return this.makeAuthenticatedRequest('PUT', `/products/${productId}`, productData, accessToken);
  }

  // Orders API
  async getOrders(accessToken, page = 1, limit = 100, filters = {}) {
    const params = {
      page,
      limit,
      ...filters
    };

    return this.makeAuthenticatedRequest('GET', '/orders', params, accessToken);
  }

  async getOrder(accessToken, orderId) {
    return this.makeAuthenticatedRequest('GET', `/orders/${orderId}`, null, accessToken);
  }

  async createOrder(accessToken, orderData) {
    return this.makeAuthenticatedRequest('POST', '/orders', orderData, accessToken);
  }

  async updateOrderStatus(accessToken, orderId, status) {
    return this.makeAuthenticatedRequest('PATCH', `/orders/${orderId}/status`, { status }, accessToken);
  }

  // Contacts API
  async getContacts(accessToken, page = 1, limit = 100, filters = {}) {
    const params = {
      page,
      limit,
      ...filters
    };

    return this.makeAuthenticatedRequest('GET', '/contacts', params, accessToken);
  }

  async createContact(accessToken, contactData) {
    return this.makeAuthenticatedRequest('POST', '/contacts', contactData, accessToken);
  }

  // Inventory API
  async getInventory(accessToken, productId) {
    return this.makeAuthenticatedRequest('GET', `/products/${productId}/inventory`, null, accessToken);
  }

  async updateInventory(accessToken, productId, inventoryData) {
    return this.makeAuthenticatedRequest('PUT', `/products/${productId}/inventory`, inventoryData, accessToken);
  }

  // Webhooks API
  async createWebhook(accessToken, webhookData) {
    return this.makeAuthenticatedRequest('POST', '/webhooks', webhookData, accessToken);
  }

  async getWebhooks(accessToken) {
    return this.makeAuthenticatedRequest('GET', '/webhooks', null, accessToken);
  }

  async deleteWebhook(accessToken, webhookId) {
    return this.makeAuthenticatedRequest('DELETE', `/webhooks/${webhookId}`, null, accessToken);
  }

  // Make authenticated request with rate limiting
  async makeAuthenticatedRequest(method, endpoint, data, accessToken) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        method,
        endpoint,
        data,
        accessToken,
        resolve,
        reject
      });

      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }

  // Process request queue with rate limiting
  async processRequestQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        const result = await this.executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }

      // Rate limiting delay
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    this.isProcessingQueue = false;
  }

  // Execute individual request
  async executeRequest({ method, endpoint, data, accessToken }) {
    const config = {
      method: method.toLowerCase(),
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VitrinemDigital/1.0.0'
      },
      timeout: 30000
    };

    if (method.toUpperCase() === 'GET' && data) {
      config.params = data;
    } else if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      
      this.logger.info('Bling API request successful', {
        method,
        endpoint,
        status: response.status,
        rateLimitRemaining: response.headers['x-ratelimit-remaining']
      });

      return response.data;
    } catch (error) {
      this.logger.error('Bling API request failed', {
        method,
        endpoint,
        status: error.response?.status,
        error: error.response?.data || error.message
      });

      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
        this.rateLimitDelay = Math.max(this.rateLimitDelay, retryAfter * 1000);
        this.logger.warn('Rate limit hit, increasing delay', { newDelay: this.rateLimitDelay });
      }

      throw error;
    }
  }

  // Make non-authenticated request (for token operations)
  async makeRequest(method, endpoint, data) {
    const config = {
      method: method.toLowerCase(),
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VitrinemDigital/1.0.0'
      },
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.logger.error('Bling API request failed', {
        method,
        endpoint,
        status: error.response?.status,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }
}

module.exports = BlingAPI;