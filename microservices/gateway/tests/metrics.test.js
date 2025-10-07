const MetricsMiddleware = require('../src/middleware/MetricsMiddleware');

describe('MetricsMiddleware', () => {
  let metrics;
  let mockLogger;
  let req, res, next;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    metrics = new MetricsMiddleware(mockLogger);
    
    req = {
      method: 'GET',
      path: '/test',
      route: { path: '/test' }
    };
    
    res = {
      statusCode: 200,
      send: jest.fn(),
      on: jest.fn()
    };
    
    next = jest.fn();
  });

  test('should track requests', () => {
    const middleware = metrics.middleware();
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    
    const metricsData = metrics.getMetrics();
    expect(metricsData.requests['GET:/test']).toBe(1);
  });

  test('should track response status codes', (done) => {
    const middleware = metrics.middleware();
    
    // Mock res.send to trigger response tracking
    res.send = function(data) {
      // Simulate response completion
      const duration = 100;
      metrics.trackResponse(res, duration);
      done();
    };
    
    middleware(req, res, next);
    res.send('test response');
    
    const metricsData = metrics.getMetrics();
    expect(metricsData.responses['2xx']).toBeGreaterThanOrEqual(1);
  });

  test('should track latency', () => {
    const duration = 150;
    metrics.trackResponse(res, duration);
    
    const metricsData = metrics.getMetrics();
    expect(metricsData.latency.count).toBe(1);
    expect(metricsData.latency.average).toBe(duration);
  });

  test('should track errors', () => {
    const error = { code: 'TEST_ERROR', name: 'TestError' };
    metrics.trackError(req, error);
    
    const metricsData = metrics.getMetrics();
    expect(metricsData.errors['TEST_ERROR']).toBe(1);
  });

  test('should calculate P95 latency correctly', () => {
    // Add 100 latency measurements
    for (let i = 1; i <= 100; i++) {
      metrics.trackResponse(res, i);
    }
    
    const metricsData = metrics.getMetrics();
    expect(metricsData.latency.p95).toBeGreaterThanOrEqual(90);
  });

  test('should reset metrics', () => {
    metrics.trackRequest(req);
    metrics.trackResponse(res, 100);
    
    let metricsData = metrics.getMetrics();
    expect(metricsData.requests['GET:/test']).toBe(1);
    
    metrics.resetMetrics();
    
    metricsData = metrics.getMetrics();
    expect(metricsData.requests['GET:/test']).toBeUndefined();
  });

  test('should include system information in metrics', () => {
    const metricsData = metrics.getMetrics();
    
    expect(metricsData).toHaveProperty('uptime');
    expect(metricsData).toHaveProperty('memory');
    expect(metricsData).toHaveProperty('timestamp');
    expect(typeof metricsData.uptime).toBe('number');
    expect(typeof metricsData.memory).toBe('object');
  });
});