const CircuitBreakerMiddleware = require('../src/middleware/CircuitBreakerMiddleware');

describe('CircuitBreakerMiddleware', () => {
  let circuitBreaker;
  let mockLogger;
  let req, res, next;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    circuitBreaker = new CircuitBreakerMiddleware(mockLogger);
    
    req = {
      method: 'GET',
      path: '/test'
    };
    
    res = {
      statusCode: 200,
      end: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  test('should allow requests when circuit is closed', () => {
    const middleware = circuitBreaker.middleware('test-service');
    
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  test('should track failures and open circuit', () => {
    const options = { threshold: 2, resetTimeout: 1000 };
    const middleware = circuitBreaker.middleware('test-service', options);
    
    // Simulate failures
    res.statusCode = 500;
    
    middleware(req, res, next);
    res.end(); // Trigger failure detection
    
    middleware(req, res, next);
    res.end(); // Second failure - should open circuit
    
    const status = circuitBreaker.getAllStatus();
    expect(status['test-service'].failures).toBeGreaterThanOrEqual(2);
    expect(status['test-service'].state).toBe('OPEN');
  });

  test('should block requests when circuit is open', () => {
    const breaker = circuitBreaker.getBreaker('test-service', { threshold: 1, resetTimeout: 1000 });
    
    // Manually open the circuit
    breaker.failures = 1;
    breaker.state = 'OPEN';
    breaker.nextAttempt = Date.now() + 1000;
    
    const middleware = circuitBreaker.middleware('test-service');
    middleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Service temporarily unavailable',
        code: 'CIRCUIT_BREAKER_OPEN'
      })
    );
  });

  test('should transition to half-open after timeout', () => {
    const breaker = circuitBreaker.getBreaker('test-service', { threshold: 1, resetTimeout: 100 });
    
    // Manually set circuit as open but with expired timeout
    breaker.state = 'OPEN';
    breaker.nextAttempt = Date.now() - 100; // Expired timeout
    
    const middleware = circuitBreaker.middleware('test-service');
    res.statusCode = 200;
    next.mockClear();
    
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    
    const status = circuitBreaker.getAllStatus();
    expect(status['test-service'].state).toBe('HALF_OPEN');
  });

  test('should close circuit on successful response in half-open state', () => {
    const breaker = circuitBreaker.getBreaker('test-service', { threshold: 1 });
    
    // Manually set to half-open
    breaker.state = 'HALF_OPEN';
    
    const middleware = circuitBreaker.middleware('test-service');
    res.statusCode = 200;
    
    middleware(req, res, next);
    res.end();
    
    const status = circuitBreaker.getAllStatus();
    expect(status['test-service'].state).toBe('CLOSED');
    expect(status['test-service'].failures).toBe(0);
  });

  test('should get status of all circuit breakers', () => {
    circuitBreaker.getBreaker('service1');
    circuitBreaker.getBreaker('service2');
    
    const status = circuitBreaker.getAllStatus();
    
    expect(status).toHaveProperty('service1');
    expect(status).toHaveProperty('service2');
    expect(status.service1).toHaveProperty('state');
    expect(status.service1).toHaveProperty('failures');
  });

  test('should use different thresholds for different services', () => {
    const breaker1 = circuitBreaker.getBreaker('service1', { threshold: 3 });
    const breaker2 = circuitBreaker.getBreaker('service2', { threshold: 5 });
    
    expect(breaker1.threshold).toBe(3);
    expect(breaker2.threshold).toBe(5);
  });

  test('should reuse existing circuit breaker for same service', () => {
    const breaker1 = circuitBreaker.getBreaker('test-service');
    const breaker2 = circuitBreaker.getBreaker('test-service');
    
    expect(breaker1).toBe(breaker2);
  });
});