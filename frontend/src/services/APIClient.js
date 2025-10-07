import axios from 'axios';

/**
 * Advanced API Client for Microservices Gateway
 * Handles authentication, error handling, retries, and service communication
 */
class APIClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3000';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    
    // Authentication state
    this.authToken = localStorage.getItem('auth_token');
    this.tenantId = localStorage.getItem('tenant_id');
    
    // Initialize axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Setup interceptors
    this.setupRequestInterceptors();
    this.setupResponseInterceptors();

    // Event listeners for auth changes
    this.setupAuthListeners();

    console.log('🚀 API Client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Setup request interceptors for authentication and headers
   */
  setupRequestInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Add tenant ID if available
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }

        // Add request timestamp for debugging
        config.headers['X-Request-Timestamp'] = new Date().toISOString();

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        console.log('📤 API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: {
            'Authorization': config.headers.Authorization ? '[REDACTED]' : 'none',
            'X-Tenant-ID': config.headers['X-Tenant-ID'] || 'none',
            'X-Request-ID': config.headers['X-Request-ID']
          }
        });

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptors for error handling and retries
   */
  setupResponseInterceptors() {
    this.client.interceptors.response.use(
      (response) => {
        console.log('📥 API Response:', {
          status: response.status,
          url: response.config.url,
          method: response.config.method?.toUpperCase(),
          responseTime: response.headers['x-response-time'] || 'unknown'
        });

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        console.error('❌ API Error:', {
          status: error.response?.status,
          url: originalRequest?.url,
          method: originalRequest?.method?.toUpperCase(),
          message: error.response?.data?.message || error.message
        });

        // Handle authentication errors
        if (error.response?.status === 401) {
          await this.handleAuthError();
          return Promise.reject(error);
        }

        // Handle retry logic for server errors and network issues
        if (this.shouldRetry(error) && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          if (originalRequest._retryCount <= this.maxRetries) {
            const delay = this.calculateRetryDelay(originalRequest._retryCount);
            
            console.log(`🔄 Retrying request (${originalRequest._retryCount}/${this.maxRetries}) after ${delay}ms`);
            
            await this.sleep(delay);
            return this.client(originalRequest);
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Setup authentication event listeners
   */
  setupAuthListeners() {
    // Listen for storage changes (multi-tab support)
    window.addEventListener('storage', (event) => {
      if (event.key === 'auth_token') {
        this.authToken = event.newValue;
      }
      if (event.key === 'tenant_id') {
        this.tenantId = event.newValue;
      }
    });

    // Listen for custom auth events
    window.addEventListener('auth:login', (event) => {
      this.setAuthToken(event.detail.token, event.detail.tenantId);
    });

    window.addEventListener('auth:logout', () => {
      this.clearAuth();
    });
  }

  /**
   * Authentication Service Methods
   */
  async login(credentials) {
    try {
      const response = await this.client.post('/auth/login', credentials);
      
      if (response.data.success) {
        this.setAuthToken(response.data.token, response.data.tenantId);
        
        // Dispatch login event
        window.dispatchEvent(new CustomEvent('auth:login', {
          detail: {
            token: response.data.token,
            tenantId: response.data.tenantId,
            user: response.data.user
          }
        }));
      }

      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async register(userData) {
    try {
      const response = await this.client.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async logout() {
    try {
      if (this.authToken) {
        await this.client.post('/auth/logout');
      }
    } catch (error) {
      console.warn('Logout request failed:', error.message);
    } finally {
      this.clearAuth();
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  async refreshToken() {
    try {
      const response = await this.client.post('/auth/refresh');
      
      if (response.data.success) {
        this.setAuthToken(response.data.token, this.tenantId);
      }

      return response.data;
    } catch (error) {
      this.clearAuth();
      throw this.formatError(error);
    }
  }

  /**
   * Product Service Methods
   */
  async getProducts(filters = {}) {
    try {
      const response = await this.client.get('/products', { params: filters });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getProduct(productId) {
    try {
      const response = await this.client.get(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async createProduct(productData) {
    try {
      const response = await this.client.post('/products', productData);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async updateProduct(productId, productData) {
    try {
      const response = await this.client.put(`/products/${productId}`, productData);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async deleteProduct(productId) {
    try {
      const response = await this.client.delete(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async searchProducts(query, filters = {}) {
    try {
      const response = await this.client.get('/products/search', {
        params: { q: query, ...filters }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Bling Integration Methods
   */
  async getBlingStatus() {
    try {
      const response = await this.client.get('/bling/status');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async initiateBlingAuth() {
    try {
      const response = await this.client.get('/bling/auth/initiate');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async completeBlingAuth(code, state) {
    try {
      const response = await this.client.post('/bling/auth/callback', {
        code,
        state
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async syncBlingProducts(options = {}) {
    try {
      const response = await this.client.post('/bling/products/sync', options);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getBlingOrders(filters = {}) {
    try {
      const response = await this.client.get('/bling/orders', { params: filters });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async createBlingOrder(orderData) {
    try {
      const response = await this.client.post('/bling/orders', orderData);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Billing Service Methods
   */
  async getCreditBalance() {
    try {
      const response = await this.client.get(`/billing/credits/balance/${this.tenantId}`);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async purchaseCredits(amount, paymentMethod, paymentData = {}) {
    try {
      const response = await this.client.post('/billing/credits/purchase', {
        tenantId: this.tenantId,
        amount,
        paymentMethod,
        paymentData
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getCreditTransactions(limit = 50, offset = 0) {
    try {
      const response = await this.client.get(`/billing/credits/transactions/${this.tenantId}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getSubscriptionPlans() {
    try {
      const response = await this.client.get('/billing/subscriptions/plans');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getSubscription() {
    try {
      const response = await this.client.get(`/billing/subscriptions/${this.tenantId}`);
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async createSubscription(planId, paymentData = {}) {
    try {
      const response = await this.client.post('/billing/subscriptions/create', {
        tenantId: this.tenantId,
        planId,
        ...paymentData
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async changePlan(subscriptionId, newPlanId, options = {}) {
    try {
      const response = await this.client.put(`/billing/subscriptions/${subscriptionId}/plan`, {
        newPlanId,
        ...options
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async cancelSubscription(subscriptionId, options = {}) {
    try {
      const response = await this.client.delete(`/billing/subscriptions/${subscriptionId}`, {
        data: options
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getRevenueAnalytics(period = '30d', includeForecasts = true) {
    try {
      const response = await this.client.get('/billing/analytics/revenue', {
        params: {
          period,
          tenantId: this.tenantId,
          includeForecasts
        }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getDashboard() {
    try {
      const response = await this.client.get('/billing/analytics/dashboard', {
        params: { tenantId: this.tenantId }
      });
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * System Methods
   */
  async getSystemHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async getSystemStats() {
    try {
      const response = await this.client.get('/stats');
      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * File Upload Methods
   */
  async uploadFile(file, type = 'product-image', options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      Object.keys(options).forEach(key => {
        formData.append(key, options[key]);
      });

      const response = await this.client.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: options.onProgress
      });

      return response.data;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Utility Methods
   */
  setAuthToken(token, tenantId) {
    this.authToken = token;
    this.tenantId = tenantId;
    
    localStorage.setItem('auth_token', token);
    if (tenantId) {
      localStorage.setItem('tenant_id', tenantId);
    }
  }

  clearAuth() {
    this.authToken = null;
    this.tenantId = null;
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('tenant_id');
  }

  isAuthenticated() {
    return !!this.authToken;
  }

  getTenantId() {
    return this.tenantId;
  }

  async handleAuthError() {
    console.log('🔒 Authentication error - clearing auth and redirecting to login');
    
    this.clearAuth();
    
    // Redirect to login if not already there
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  shouldRetry(error) {
    // Don't retry client errors (4xx) except 408 (timeout) and 429 (rate limit)
    if (error.response) {
      const status = error.response.status;
      if (status >= 400 && status < 500) {
        return status === 408 || status === 429;
      }
      return status >= 500; // Retry server errors
    }

    // Retry network errors
    return error.code === 'NETWORK_ERROR' || 
           error.code === 'ECONNABORTED' || 
           error.code === 'ENOTFOUND';
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        type: 'API_ERROR',
        status: error.response.status,
        message: error.response.data?.message || error.response.statusText,
        data: error.response.data,
        code: error.response.data?.code,
        requestId: error.response.headers['x-request-id']
      };
    } else if (error.request) {
      // Network error
      return {
        type: 'NETWORK_ERROR',
        message: 'Network error - please check your connection',
        code: error.code
      };
    } else {
      // Other error
      return {
        type: 'CLIENT_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Batch Operations
   */
  async batch(requests) {
    try {
      const promises = requests.map(req => {
        const { method, url, data, params } = req;
        return this.client.request({
          method: method.toLowerCase(),
          url,
          data,
          params
        });
      });

      const responses = await Promise.allSettled(promises);
      
      return responses.map((result, index) => ({
        id: requests[index].id || index,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value.data : null,
        error: result.status === 'rejected' ? this.formatError(result.reason) : null
      }));
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Real-time Methods (WebSocket support)
   */
  connect(options = {}) {
    if (typeof window !== 'undefined' && window.WebSocket) {
      const wsUrl = this.baseURL.replace(/^http/, 'ws') + '/ws';
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('🔗 WebSocket connected');
        
        // Send authentication
        if (this.authToken) {
          this.ws.send(JSON.stringify({
            type: 'auth',
            token: this.authToken
          }));
        }

        options.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          options.onMessage?.(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        options.onDisconnect?.();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        options.onError?.(error);
      };
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }
}

// Create singleton instance
const apiClient = new APIClient();

// Export both the class and the singleton
export { APIClient };
export default apiClient;