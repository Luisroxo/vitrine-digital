/**
 * Test Environment Setup
 * Configures testing environment for all microservices
 */

const { Client } = require('pg');
const redis = require('redis');
const axios = require('axios');

// Global test configuration
global.testConfig = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'vitrine_digital_test',
    username: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres'
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: process.env.TEST_REDIS_PORT || 6379,
    db: process.env.TEST_REDIS_DB || 1
  },
  services: {
    authService: process.env.TEST_AUTH_SERVICE_URL || 'http://localhost:3001',
    productService: process.env.TEST_PRODUCT_SERVICE_URL || 'http://localhost:3002',
    billingService: process.env.TEST_BILLING_SERVICE_URL || 'http://localhost:3003',
    blingService: process.env.TEST_BLING_SERVICE_URL || 'http://localhost:3004',
    gateway: process.env.TEST_GATEWAY_URL || 'http://localhost:3000'
  },
  timeout: 30000
};

// Global test utilities
global.testUtils = {
  // Database utilities
  async createTestDatabase() {
    const client = new Client({
      host: global.testConfig.database.host,
      port: global.testConfig.database.port,
      user: global.testConfig.database.username,
      password: global.testConfig.database.password,
      database: 'postgres' // Connect to default DB first
    });
    
    await client.connect();
    
    try {
      // Drop test database if exists
      await client.query(`DROP DATABASE IF EXISTS ${global.testConfig.database.database}`);
      // Create fresh test database
      await client.query(`CREATE DATABASE ${global.testConfig.database.database}`);
    } catch (error) {
      console.warn('Database setup warning:', error.message);
    } finally {
      await client.end();
    }
  },

  async cleanupTestDatabase() {
    const client = new Client(global.testConfig.database);
    await client.connect();
    
    try {
      // Clean all test data
      const tables = [
        'orders', 'order_items', 'products', 'categories',
        'users', 'tenants', 'billing_plans', 'invoices',
        'bling_integrations', 'partnerships'
      ];
      
      for (const table of tables) {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      }
    } catch (error) {
      console.warn('Database cleanup warning:', error.message);
    } finally {
      await client.end();
    }
  },

  // Redis utilities
  async createRedisConnection() {
    const client = redis.createClient({
      host: global.testConfig.redis.host,
      port: global.testConfig.redis.port,
      db: global.testConfig.redis.db
    });
    
    await client.connect();
    return client;
  },

  async cleanupRedis() {
    const client = await this.createRedisConnection();
    await client.flushDb();
    await client.quit();
  },

  // HTTP utilities
  async waitForService(serviceUrl, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`${serviceUrl}/health`, { timeout: 1000 });
        return true;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Service ${serviceUrl} not available after ${maxAttempts} attempts`);
  },

  // Mock data generators
  generateMockUser(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      name: 'Test User',
      email: `test.user.${Date.now()}@example.com`,
      password: 'testpassword123',
      role: 'user',
      tenantId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },

  generateMockTenant(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      name: 'Test Tenant',
      domain: `test-tenant-${Date.now()}.vitrinedigital.com`,
      plan: 'basic',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },

  generateMockProduct(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      name: 'Test Product',
      description: 'Test product description',
      price: 99.99,
      stock: 100,
      categoryId: 1,
      tenantId: 1,
      blingId: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },

  generateMockOrder(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      userId: 1,
      tenantId: 1,
      status: 'pending',
      total: 99.99,
      paymentMethod: 'credit_card',
      items: [
        {
          productId: 1,
          quantity: 1,
          unitPrice: 99.99,
          total: 99.99
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  },

  // Authentication utilities
  async generateAuthToken(user = null) {
    if (!user) {
      user = this.generateMockUser();
    }
    
    // Mock JWT token generation
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    // In real implementation, use proper JWT signing
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  },

  // API testing utilities
  async makeAuthenticatedRequest(method, url, data = null, token = null) {
    if (!token) {
      token = await this.generateAuthToken();
    }
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }
    
    return axios(config);
  }
};

// Jest setup and teardown
beforeAll(async () => {
  // Setup test environment
  console.log('🧪 Setting up test environment...');
  
  try {
    // Create test database
    await global.testUtils.createTestDatabase();
    
    // Clean Redis
    await global.testUtils.cleanupRedis();
    
    // Wait for services to be available (in CI/CD environment)
    if (process.env.CI) {
      const services = Object.values(global.testConfig.services);
      await Promise.all(
        services.map(serviceUrl => 
          global.testUtils.waitForService(serviceUrl)
        )
      );
    }
    
    console.log('✅ Test environment ready');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error);
    throw error;
  }
}, 60000);

afterAll(async () => {
  // Cleanup test environment
  console.log('🧹 Cleaning up test environment...');
  
  try {
    await global.testUtils.cleanupTestDatabase();
    await global.testUtils.cleanupRedis();
    console.log('✅ Test environment cleaned');
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error);
  }
});

// Individual test cleanup
afterEach(async () => {
  // Clean up after each test
  try {
    await global.testUtils.cleanupRedis();
  } catch (error) {
    console.warn('Redis cleanup warning:', error.message);
  }
});

// Custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => 
        pass 
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
      pass
    };
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
      pass
    };
  },
  
  toBeWithinRange(received, min, max) {
    const pass = received >= min && received <= max;
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be within range ${min}-${max}`
          : `expected ${received} to be within range ${min}-${max}`,
      pass
    };
  },
  
  toHaveValidBrazilianCurrency(received) {
    const currencyRegex = /^R\$\s?\d{1,3}(\.\d{3})*,\d{2}$/;
    const pass = currencyRegex.test(received);
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be valid Brazilian currency format`
          : `expected ${received} to be valid Brazilian currency format`,
      pass
    };
  }
});

module.exports = {
  testConfig: global.testConfig,
  testUtils: global.testUtils
};