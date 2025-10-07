const request = require('supertest');
const app = require('../src/index');

describe('Product Analytics API', () => {
  const tenantId = 1;
  const headers = {
    'x-tenant-id': tenantId,
    'Content-Type': 'application/json'
  };

  beforeEach(async () => {
    // Setup test data if needed
  });

  afterEach(async () => {
    // Cleanup test data if needed
  });

  describe('POST /api/analytics/views', () => {
    test('should track product view successfully', async () => {
      const viewData = {
        product_id: 1,
        session_id: 'test-session-123',
        user_agent: 'Mozilla/5.0 Test Browser',
        ip_address: '192.168.1.1',
        referrer: 'https://google.com',
        source: 'web'
      };

      const response = await request(app)
        .post('/api/analytics/views')
        .set(headers)
        .send(viewData);

      expect(response.status).toBe(200);
      expect(response.body.tracked).toBe(true);
    });

    test('should validate required fields', async () => {
      const invalidData = {
        session_id: 'test-session'
        // missing product_id
      };

      const response = await request(app)
        .post('/api/analytics/views')
        .set(headers)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/analytics/searches', () => {
    test('should track search successfully', async () => {
      const searchData = {
        query: 'smartphone',
        results_count: 15,
        session_id: 'test-session-123',
        filters: {
          category: 'electronics',
          price_range: '100-500'
        }
      };

      const response = await request(app)
        .post('/api/analytics/searches')
        .set(headers)
        .send(searchData);

      expect(response.status).toBe(200);
      expect(response.body.query).toBe('smartphone');
      expect(response.body.results_count).toBe(15);
    });
  });

  describe('GET /api/analytics/products/top', () => {
    test('should return top products', async () => {
      const response = await request(app)
        .get('/api/analytics/products/top?period=30days&limit=5')
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('period', '30days');
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });
  });

  describe('GET /api/analytics/stock/alerts', () => {
    test('should return stock alerts', async () => {
      const response = await request(app)
        .get('/api/analytics/stock/alerts')
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_alerts');
      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBe(true);
    });
  });

  describe('GET /api/analytics/performance', () => {
    test('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance?period=24hours')
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('period', '24hours');
      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('views');
    });
  });

  describe('GET /api/analytics/dashboard', () => {
    test('should return complete dashboard data', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard?period=7days')
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('period', '7days');
      expect(response.body).toHaveProperty('top_products');
      expect(response.body).toHaveProperty('stock_alerts');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('search_analytics');
    });
  });

  describe('Authorization', () => {
    test('should require tenant ID header', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing tenant ID');
    });
  });
});