// Setup para testes do Bling Service
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.RATE_LIMIT_MAX = '1000';
process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key';
process.env.BLING_CLIENT_ID = 'test-client-id';
process.env.BLING_CLIENT_SECRET = 'test-client-secret';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

// Mock console methods
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