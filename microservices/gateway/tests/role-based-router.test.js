const RoleBasedRouter = require('../src/middleware/RoleBasedRouter');

describe('RoleBasedRouter', () => {
  let roleRouter;
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    roleRouter = new RoleBasedRouter();

    mockReq = {
      path: '/test',
      method: 'GET',
      query: {},
      body: {},
      params: {}
    };
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('Route Configuration', () => {
    test('should add route rule successfully', () => {
      roleRouter.addRouteRule('/test', ['admin']);
      
      const config = roleRouter.findRouteConfig('/test', 'GET');
      expect(config.roles).toEqual(['admin']);
    });

    test('should add method-specific route rule', () => {
      roleRouter.addRouteRule('/test', {
        'GET': ['public'],
        'POST': ['admin']
      });

      const getConfig = roleRouter.findRouteConfig('/test', 'GET');
      const postConfig = roleRouter.findRouteConfig('/test', 'POST');

      expect(getConfig.roles).toEqual(['public']);
      expect(postConfig.roles).toEqual(['admin']);
    });

    test('should convert patterns to regex correctly', () => {
      const regex = roleRouter.patternToRegex('/products/*/analytics');
      
      expect(regex.test('/products/123/analytics')).toBe(true);
      expect(regex.test('/products/abc/analytics')).toBe(true);
      expect(regex.test('/products/123/other')).toBe(false);
    });
  });

  describe('Role Access Control', () => {
    test('should allow public access', () => {
      const hasAccess = roleRouter.hasRoleAccess(null, ['public']);
      expect(hasAccess).toBe(true);
    });

    test('should allow direct role match', () => {
      const hasAccess = roleRouter.hasRoleAccess('admin', ['admin']);
      expect(hasAccess).toBe(true);
    });

    test('should allow role hierarchy access', () => {
      const hasAccess = roleRouter.hasRoleAccess('admin', ['user']);
      expect(hasAccess).toBe(true);
    });

    test('should deny insufficient role', () => {
      const hasAccess = roleRouter.hasRoleAccess('user', ['admin']);
      expect(hasAccess).toBe(false);
    });

    test('should deny access without role when auth required', () => {
      const hasAccess = roleRouter.hasRoleAccess(null, ['user']);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Tenant Access Control', () => {
    test('should allow same tenant access', () => {
      const userPayload = { tenantId: 1, role: 'user' };
      const hasAccess = roleRouter.checkTenantAccess(userPayload, 1);
      expect(hasAccess).toBe(true);
    });

    test('should deny different tenant access', () => {
      const userPayload = { tenantId: 1, role: 'user' };
      const hasAccess = roleRouter.checkTenantAccess(userPayload, 2);
      expect(hasAccess).toBe(false);
    });

    test('should allow super admin access to any tenant', () => {
      const userPayload = { tenantId: 1, role: 'super_admin' };
      const hasAccess = roleRouter.checkTenantAccess(userPayload, 2);
      expect(hasAccess).toBe(true);
    });

    test('should allow admin with allowed tenants', () => {
      const userPayload = { 
        tenantId: 1, 
        role: 'admin',
        allowedTenants: [1, 2, 3]
      };
      const hasAccess = roleRouter.checkTenantAccess(userPayload, 2);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Route Middleware', () => {
    test('should allow access with sufficient role', () => {
      roleRouter.addRouteRule('/test', ['user']);
      mockReq.userRole = 'admin';
      mockReq.user = { sub: 'user123', role: 'admin' };

      const middleware = roleRouter.middleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.routeConfig).toBeDefined();
    });

    test('should deny access with insufficient role', () => {
      roleRouter.addRouteRule('/test', ['admin']);
      mockReq.userRole = 'user';
      mockReq.user = { sub: 'user123', role: 'user' };

      const middleware = roleRouter.middleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Access denied',
          code: 'INSUFFICIENT_ROLE'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should check tenant isolation', () => {
      roleRouter.addRouteRule('/test', ['user']);
      mockReq.userRole = 'user';
      mockReq.user = { sub: 'user123', role: 'user', tenantId: 1 };
      mockReq.query.tenantId = '2';

      const middleware = roleRouter.middleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Access denied',
          code: 'TENANT_ACCESS_VIOLATION'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow tenant access for same tenant', () => {
      roleRouter.addRouteRule('/test', ['user']);
      mockReq.userRole = 'user';
      mockReq.user = { sub: 'user123', role: 'user', tenantId: 1 };
      mockReq.query.tenantId = '1';

      const middleware = roleRouter.middleware();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    test('should return correct rate limits for role', () => {
      const adminLimits = roleRouter.getRoleRateLimit('admin');
      const userLimits = roleRouter.getRoleRateLimit('user');
      const publicLimits = roleRouter.getRoleRateLimit('public');

      expect(adminLimits.max).toBeGreaterThan(userLimits.max);
      expect(userLimits.max).toBeGreaterThan(publicLimits.max);
    });
  });

  describe('Default Routes', () => {
    test('should have configured auth routes', () => {
      const loginConfig = roleRouter.findRouteConfig('/auth/login', 'POST');
      expect(loginConfig.roles).toContain('public');

      const meConfig = roleRouter.findRouteConfig('/auth/me', 'GET');
      expect(meConfig.roles).toContain('user');
    });

    test('should have configured product routes', () => {
      const getConfig = roleRouter.findRouteConfig('/products', 'GET');
      const postConfig = roleRouter.findRouteConfig('/products', 'POST');

      expect(getConfig.roles).toContain('public');
      expect(postConfig.roles).toContain('admin');
    });

    test('should have configured bling routes', () => {
      const authConfig = roleRouter.findRouteConfig('/bling/auth', 'GET');
      expect(authConfig.roles).toContain('lojista');
    });

    test('should have configured billing routes', () => {
      const creditsConfig = roleRouter.findRouteConfig('/billing/credits', 'GET');
      expect(creditsConfig.roles).toContain('lojista');

      const adminConfig = roleRouter.findRouteConfig('/billing/admin/stats', 'GET');
      expect(adminConfig.roles).toContain('admin');
    });
  });

  describe('Statistics', () => {
    test('should return route statistics', () => {
      const stats = roleRouter.getStats();
      
      expect(stats).toHaveProperty('totalRoutes');
      expect(stats).toHaveProperty('roleHierarchy');
      expect(stats).toHaveProperty('routes');
      expect(stats.totalRoutes).toBeGreaterThan(0);
    });
  });

  describe('Route Management', () => {
    test('should remove route rule', () => {
      roleRouter.addRouteRule('/test-remove', ['admin']);
      
      const removed = roleRouter.removeRouteRule('/test-remove');
      expect(removed).toBe(true);

      const config = roleRouter.findRouteConfig('/test-remove', 'GET');
      expect(config.pattern).toBe('default'); // Falls back to default
    });

    test('should update role hierarchy', () => {
      const newHierarchy = {
        'custom_role': ['user']
      };

      roleRouter.updateRoleHierarchy(newHierarchy);
      expect(roleRouter.roleHierarchy).toHaveProperty('custom_role');
    });
  });
});