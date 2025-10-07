const request = require('supertest');
const express = require('express');

// Mock dos serviços compartilhados
jest.mock('../../shared', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    middleware: jest.fn(() => (req, res, next) => next()),
    logStartup: jest.fn()
  })),
  JWTUtils: jest.fn().mockImplementation(() => ({
    createAuthMiddleware: jest.fn(() => (req, res, next) => {
      req.user = { id: 1, tenantId: 'test-tenant' };
      next();
    }),
    createRoleMiddleware: jest.fn(() => (req, res, next) => next())
  })),
  ErrorHandler: {
    notFoundHandler: jest.fn(() => (req, res, next) => {
      res.status(404).json({ error: 'Not found' });
    }),
    globalHandler: jest.fn(() => (err, req, res, next) => {
      res.status(500).json({ error: 'Internal server error' });
    })
  }
}));

// Mock do http-proxy-middleware
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => (req, res, next) => {
    // Simula resposta do serviço
    res.json({ success: true, service: 'mocked' });
  })
}));

describe('API Gateway', () => {
  let app;
  let APIGateway;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Import after mocks are set up
    APIGateway = require('../src/index');
    const gateway = new APIGateway();
    app = gateway.app;
  });

  describe('Health Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /status should return system status', async () => {
      const response = await request(app)
        .get('/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
    });

    test('GET /metrics should return metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('GET /circuit-breaker should return circuit breaker status', async () => {
      const response = await request(app)
        .get('/circuit-breaker')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply global rate limiting', async () => {
      // Fazer muitas requests rapidamente para testar rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(request(app).get('/health'));
      }
      
      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.status);
      });
    });
  });

  describe('Proxy Routes', () => {
    test('should proxy auth routes', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should proxy product routes with auth', async () => {
      const response = await request(app)
        .get('/products')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should proxy bling routes with auth', async () => {
      const response = await request(app)
        .get('/bling/products')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should proxy billing routes with auth', async () => {
      const response = await request(app)
        .get('/billing/plans')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet adiciona vários headers de segurança
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Metrics Collection', () => {
    test('should collect request metrics', async () => {
      // Fazer algumas requests
      await request(app).get('/health');
      await request(app).get('/status');
      
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const metrics = response.body.data;
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('responses');
      expect(metrics).toHaveProperty('latency');
    });
  });
});