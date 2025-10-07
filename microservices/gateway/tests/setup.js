// Setup para testes do Gateway
process.env.NODE_ENV = 'test';
process.env.GATEWAY_PORT = '0'; // Usa porta aleatória nos testes
process.env.RATE_LIMIT_MAX = '1000'; // Rate limit alto para testes
process.env.JWT_SECRET = 'test-secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';

// Mock console methods para reduzir ruído nos testes
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});