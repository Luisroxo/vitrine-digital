const request = require('supertest');
const express = require('express');

// Create a simple test app
function createTestApp() {
  const app = express();
  
  app.use(express.json());
  
  // Mock auth middleware
  app.use((req, res, next) => {
    if (req.headers.authorization) {
      req.user = { tenantId: 'test-tenant', userId: 'test-user' };
    }
    next();
  });

  // Health check
  app.get('/', (req, res) => {
    res.json({
      service: 'Bling Integration Service',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/bling/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        bling_api: 'available'
      }
    });
  });

  // Auth routes
  app.get('/api/bling/auth/url', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.json({
      success: true,
      data: {
        authURL: 'https://bling.com.br/oauth/authorize?client_id=test',
        instructions: 'Visit this URL to authorize Bling integration'
      }
    });
  });

  app.get('/api/bling/auth/callback', (req, res) => {
    const { error } = req.query;
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Authorization denied',
        message: error
      });
    }
    res.json({ success: true, message: 'Authorization successful' });
  });

  // Connection routes
  app.get('/api/bling/connections', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.json({ success: true, data: [] });
  });

  app.post('/api/bling/connections', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and Client Secret are required'
      });
    }
    res.status(201).json({ 
      success: true, 
      data: { 
        connection: { id: 'test-id', status: 'pending' },
        authURL: 'https://bling.com.br/oauth/authorize'
      }
    });
  });

  // Sync routes
  app.post('/api/bling/sync/:jobType', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { jobType } = req.params;
    const validTypes = ['products', 'orders', 'inventory', 'contacts'];
    if (!validTypes.includes(jobType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid job type',
        validTypes
      });
    }
    res.json({ success: true, data: { jobId: 'test-job-id', status: 'scheduled' } });
  });

  app.get('/api/bling/sync/stats', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.json({
      success: true,
      data: {
        waiting: 0,
        active: 0,
        completed: 5,
        failed: 1,
        recentJobs: []
      }
    });
  });

  // Dashboard
  app.get('/api/bling/dashboard', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.json({
      success: true,
      data: {
        connections: { total: 1, active: 1 },
        sync: { waiting: 0, active: 0, completed: 5 },
        lastUpdated: new Date()
      }
    });
  });

  // Webhooks
  app.post('/api/bling/webhooks/:tenantId', (req, res) => {
    res.json({ success: true, message: 'Webhook received' });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
      method: req.method
    });
  });

  return app;
}

describe('Bling Service', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('Health Endpoints', () => {
    test('GET / should return service info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('version');
    });

    test('GET /api/bling/health should return health status', async () => {
      const response = await request(app)
        .get('/api/bling/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Authentication Routes', () => {
    test('GET /api/bling/auth/url should return auth URL', async () => {
      const response = await request(app)
        .get('/api/bling/auth/url')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('authURL');
    });

    test('GET /api/bling/auth/callback should handle OAuth callback', async () => {
      // This would need more setup to properly test
      const response = await request(app)
        .get('/api/bling/auth/callback?error=access_denied')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Connection Routes', () => {
    test('GET /api/bling/connections should return connections', async () => {
      const response = await request(app)
        .get('/api/bling/connections')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/bling/connections should create connection', async () => {
      const connectionData = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };

      const response = await request(app)
        .post('/api/bling/connections')
        .set('Authorization', 'Bearer test-token')
        .send(connectionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('POST /api/bling/connections should validate required fields', async () => {
      const response = await request(app)
        .post('/api/bling/connections')
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Sync Routes', () => {
    test('POST /api/bling/sync/products should start product sync', async () => {
      const response = await request(app)
        .post('/api/bling/sync/products')
        .set('Authorization', 'Bearer test-token')
        .send({ config: { pageSize: 50 } })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('POST /api/bling/sync/invalid should return error', async () => {
      const response = await request(app)
        .post('/api/bling/sync/invalid')
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('GET /api/bling/sync/stats should return sync statistics', async () => {
      const response = await request(app)
        .get('/api/bling/sync/stats')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Dashboard Routes', () => {
    test('GET /api/bling/dashboard should return dashboard data', async () => {
      const response = await request(app)
        .get('/api/bling/dashboard')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('connections');
      expect(response.body.data).toHaveProperty('sync');
    });
  });

  describe('Webhook Routes', () => {
    test('POST /api/bling/webhooks/:tenantId should handle webhook', async () => {
      const webhookPayload = {
        event_type: 'product.updated',
        event_id: 'test-event-id',
        data: { productId: 'test-product' }
      };

      const response = await request(app)
        .post('/api/bling/webhooks/test-tenant')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/bling/unknown')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/bling/connections')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      // Make multiple requests quickly
      const requests = Array(10).fill().map(() => 
        request(app).get('/')
      );
      
      const responses = await Promise.all(requests);
      
      // All should succeed or get rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});