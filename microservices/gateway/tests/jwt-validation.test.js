const JWTValidationPipeline = require('../src/middleware/JWTValidationPipeline');
const jwt = require('jsonwebtoken');

describe('JWTValidationPipeline', () => {
  let jwtPipeline;
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jwtPipeline = new JWTValidationPipeline({
      secret: 'test-secret',
      issuer: 'test-issuer',
      audience: 'test-audience'
    });

    mockReq = {
      headers: {},
      get: jest.fn()
    };
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('Token Validation', () => {
    test('should validate valid JWT token', async () => {
      const payload = {
        sub: 'user123',
        role: 'user',
        tenantId: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience'
      };

      const token = jwt.sign(payload, 'test-secret');
      const result = await jwtPipeline.validateToken(token);

      expect(result.sub).toBe('user123');
      expect(result.role).toBe('user');
      expect(result.tenantId).toBe(1);
    });

    test('should throw error for invalid token', async () => {
      await expect(jwtPipeline.validateToken('invalid-token'))
        .rejects.toThrow();
    });

    test('should throw error for expired token', async () => {
      const payload = {
        sub: 'user123',
        role: 'user',
        tenantId: 1,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iss: 'test-issuer',
        aud: 'test-audience'
      };

      const token = jwt.sign(payload, 'test-secret');
      
      await expect(jwtPipeline.validateToken(token))
        .rejects.toThrow();
    });
  });

  describe('Role Validation', () => {
    test('should validate user has required role', () => {
      const userPayload = { role: 'admin' };
      const hasRole = jwtPipeline.hasRole(userPayload, 'admin');
      expect(hasRole).toBe(true);
    });

    test('should validate role hierarchy', () => {
      const userPayload = { role: 'admin' };
      const hasRole = jwtPipeline.hasRole(userPayload, 'user');
      expect(hasRole).toBe(true);
    });

    test('should reject insufficient role', () => {
      const userPayload = { role: 'user' };
      const hasRole = jwtPipeline.hasRole(userPayload, 'admin');
      expect(hasRole).toBe(false);
    });

    test('should handle multiple role check', () => {
      const userPayload = { role: 'manager' };
      const hasAnyRole = jwtPipeline.hasAnyRole(userPayload, ['admin', 'manager']);
      expect(hasAnyRole).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    test('should validate user has permission', () => {
      const userPayload = { permissions: ['read', 'write'] };
      const hasPerm = jwtPipeline.hasPermission(userPayload, 'read');
      expect(hasPerm).toBe(true);
    });

    test('should reject missing permission', () => {
      const userPayload = { permissions: ['read'] };
      const hasPerm = jwtPipeline.hasPermission(userPayload, 'delete');
      expect(hasPerm).toBe(false);
    });
  });

  describe('Tenant Access', () => {
    test('should allow same tenant access', () => {
      const userPayload = { tenantId: 1, role: 'user' };
      const hasAccess = jwtPipeline.checkTenantAccess(userPayload, 1);
      expect(hasAccess).toBe(true);
    });

    test('should deny different tenant access', () => {
      const userPayload = { tenantId: 1, role: 'user' };
      const hasAccess = jwtPipeline.checkTenantAccess(userPayload, 2);
      expect(hasAccess).toBe(false);
    });

    test('should allow super admin access to any tenant', () => {
      const userPayload = { tenantId: 1, role: 'super_admin' };
      const hasAccess = jwtPipeline.checkTenantAccess(userPayload, 2);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Auth Middleware', () => {
    test('should authenticate valid request', async () => {
      const payload = {
        sub: 'user123',
        role: 'user',
        tenantId: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience'
      };

      const token = jwt.sign(payload, 'test-secret');
      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = jwtPipeline.createAuthMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.userId).toBe('user123');
      expect(mockReq.userRole).toBe('user');
    });

    test('should reject request without token', async () => {
      const middleware = jwtPipeline.createAuthMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing or invalid authorization header',
          code: 'UNAUTHORIZED'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject insufficient role', async () => {
      const payload = {
        sub: 'user123',
        role: 'user',
        tenantId: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience'
      };

      const token = jwt.sign(payload, 'test-secret');
      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = jwtPipeline.createAuthMiddleware({ requiredRole: 'admin' });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow optional authentication', async () => {
      const middleware = jwtPipeline.createAuthMiddleware({ optional: true });
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  describe('Token Management', () => {
    test('should revoke token', () => {
      const token = 'test-token';
      jwtPipeline.revokeToken(token);
      
      expect(jwtPipeline.blacklistedTokens.has(token)).toBe(true);
    });

    test('should reject blacklisted token', async () => {
      const payload = {
        sub: 'user123',
        role: 'user',
        tenantId: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience'
      };

      const token = jwt.sign(payload, 'test-secret');
      jwtPipeline.revokeToken(token);

      await expect(jwtPipeline.validateToken(token))
        .rejects.toThrow('Token has been revoked');
    });
  });
});