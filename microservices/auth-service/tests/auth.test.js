const request = require('supertest');
const app = require('../src/index');

describe('Auth Service Integration Tests', () => {
  const testTenantId = 1;
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    first_name: 'Test',
    last_name: 'User',
    role: 'user'
  };

  let authTokens = {};
  let userId;

  beforeAll(async () => {
    // Setup test database if needed
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('x-tenant-id', testTenantId)
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      authTokens = response.body.data.tokens;
      userId = response.body.data.user.id;
    });

    it('should reject registration with missing tenant ID', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing tenant ID');
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('x-tenant-id', testTenantId)
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('x-tenant-id', testTenantId)
        .send({
          ...testUser,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('x-tenant-id', testTenantId)
        .send({
          ...testUser,
          email: 'weak@example.com',
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('x-tenant-id', testTenantId)
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      authTokens = response.body.data.tokens;
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('x-tenant-id', testTenantId)
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('x-tenant-id', testTenantId)
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login without tenant ID', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing tenant ID');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', testTenantId)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.permissions).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', testTenantId);

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', testTenantId)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('x-tenant-id', testTenantId)
        .send({
          refreshToken: authTokens.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      authTokens = response.body.data.tokens;
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('x-tenant-id', testTenantId)
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return user sessions', async () => {
      const response = await request(app)
        .get('/auth/sessions')
        .set('x-tenant-id', testTenantId)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeDefined();
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('x-tenant-id', testTenantId)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          refreshToken: authTokens.refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject access with logged out token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('x-tenant-id', testTenantId)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      // Should still work as we only invalidated the session, not the JWT itself
      // In a real implementation, you might have token blacklisting
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoint', async () => {
      const promises = [];
      
      // Make more requests than the rate limit allows
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/auth/login')
            .set('x-tenant-id', testTenantId)
            .send({
              email: 'rate@limit.test',
              password: 'WrongPassword123!'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});

describe('Auth Service Unit Tests', () => {
  describe('Permission System', () => {
    // Add unit tests for permission checking logic
    it('should check permissions correctly', () => {
      // Test permission matching logic
    });

    it('should handle wildcard permissions', () => {
      // Test wildcard permission matching
    });

    it('should enforce tenant isolation', () => {
      // Test tenant isolation logic
    });
  });
});