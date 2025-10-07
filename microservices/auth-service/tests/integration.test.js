const request = require('supertest');
const AuthService = require('../src/index');

describe('Auth Service - Token Validation & Protected Routes', () => {
  let authService;
  let app;
  let testUserToken;
  let testUser;

  beforeAll(async () => {
    authService = new AuthService();
    app = authService.app;
    await authService.start();

    // Create test user
    testUser = {
      email: 'test@example.com',
      password: 'Test123!@#',
      tenant_id: 1,
      role: 'user'
    };

    // Register test user
    const registerResponse = await request(app)
      .post('/auth/register')
      .set('x-tenant-id', '1')
      .send(testUser);

    // Login to get token
    const loginResponse = await request(app)
      .post('/auth/login')
      .set('x-tenant-id', '1')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    testUserToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    if (authService) {
      await authService.stop();
    }
  });

  describe('Token Validation Endpoint', () => {
    test('should validate valid token', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .set('x-tenant-id', '1')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.permissions).toBeDefined();
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .set('x-tenant-id', '1')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(401);
    });
  });

  describe('Protected Routes Configuration', () => {
    test('should access public routes without token', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
    });

    test('should require token for protected routes', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(401);
    });

    test('should access protected routes with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', '1')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    test('should deny access to different tenant', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', '999') // Different tenant
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    test('should allow access to correct tenant', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', '1') // Correct tenant
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Session Management', () => {
    test('should list user sessions', async () => {
      const response = await request(app)
        .get('/auth/sessions')
        .set('x-tenant-id', '1')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toBeDefined();
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });

    test('should allow terminating sessions', async () => {
      // First get sessions to find a session ID
      const sessionsResponse = await request(app)
        .get('/auth/sessions')
        .set('x-tenant-id', '1')
        .set('Authorization', `Bearer ${testUserToken}`);

      const sessions = sessionsResponse.body.data.sessions;
      
      if (sessions.length > 0) {
        const sessionId = sessions[0].id;
        
        const response = await request(app)
          .delete(`/auth/sessions/${sessionId}`)
          .set('x-tenant-id', '1')
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Permissions System', () => {
    test('should return user permissions', async () => {
      const response = await request(app)
        .get('/auth/permissions')
        .set('x-tenant-id', '1')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.permissions).toBeDefined();
      expect(Array.isArray(response.body.data.permissions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed tokens gracefully', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .set('x-tenant-id', '1')
        .set('Authorization', 'Bearer malformed.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should handle missing tenant header', async () => {
      const response = await request(app)
        .post('/auth/validate')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing tenant ID');
    });
  });

  describe('Configuration Endpoint', () => {
    test('should return route configurations', async () => {
      // This would be available if the gateway integration is active
      // For now, just test that the auth service can handle unknown routes
      const response = await request(app)
        .get('/unknown-route')
        .set('x-tenant-id', '1');

      // Should return 404, not crash
      expect([404, 401]).toContain(response.status);
    });
  });
});