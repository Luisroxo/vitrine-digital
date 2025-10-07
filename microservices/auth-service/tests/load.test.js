const request = require('supertest');
const AuthService = require('../src/index');

describe('Auth Service Load Testing', () => {
  let authService;
  let app;
  
  beforeAll(async () => {
    authService = new AuthService();
    app = authService.app;
    await authService.start();
  });

  afterAll(async () => {
    if (authService) {
      await authService.stop();
    }
  });

  describe('Login Endpoint Load Test', () => {
    const testUser = {
      email: 'loadtest@example.com',
      password: 'Test123!@#',
      tenant_id: 1,
      role: 'user'
    };

    beforeAll(async () => {
      // Create test user for load testing
      await request(app)
        .post('/auth/register')
        .set('x-tenant-id', '1')
        .send(testUser);
    });

    test('should handle 50 concurrent login requests', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      // Create array of promises for concurrent requests
      const loginPromises = Array.from({ length: concurrentRequests }, () => 
        request(app)
          .post('/auth/login')
          .set('x-tenant-id', '1')
          .send({
            email: testUser.email,
            password: testUser.password
          })
      );

      const responses = await Promise.all(loginPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete in less than 5 seconds
      expect(responses.length).toBe(concurrentRequests);

      console.log(`✅ Load Test Results:
        - Concurrent Requests: ${concurrentRequests}
        - Total Time: ${totalTime}ms
        - Average Response Time: ${totalTime / concurrentRequests}ms
        - Requests per Second: ${(concurrentRequests / (totalTime / 1000)).toFixed(2)}
      `);
    }, 10000);

    test('should handle 100 token validation requests', async () => {
      // First, get a valid token
      const loginResponse = await request(app)
        .post('/auth/login')
        .set('x-tenant-id', '1')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      const token = loginResponse.body.token;
      const concurrentRequests = 100;
      const startTime = Date.now();

      // Create concurrent /auth/me requests
      const validationPromises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/auth/me')
          .set('x-tenant-id', '1')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(validationPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all validations succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user).toBeDefined();
      });

      expect(totalTime).toBeLessThan(3000); // Should be faster than login

      console.log(`✅ Token Validation Load Test:
        - Concurrent Validations: ${concurrentRequests}
        - Total Time: ${totalTime}ms
        - Average Response Time: ${totalTime / concurrentRequests}ms
        - Validations per Second: ${(concurrentRequests / (totalTime / 1000)).toFixed(2)}
      `);
    }, 10000);

    test('should handle rate limiting gracefully', async () => {
      const rateLimitedRequests = 10; // More than the 5 per 15min limit
      
      // Make requests that should trigger rate limiting
      const promises = Array.from({ length: rateLimitedRequests }, () =>
        request(app)
          .post('/auth/login')
          .set('x-tenant-id', '1')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const failedLoginCount = responses.filter(r => r.status === 401).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(rateLimitedCount + failedLoginCount).toBe(rateLimitedRequests);

      console.log(`✅ Rate Limiting Test:
        - Total Requests: ${rateLimitedRequests}
        - Rate Limited: ${rateLimitedCount}
        - Failed Logins: ${failedLoginCount}
      `);
    });

    test('should maintain response times under load', async () => {
      const iterations = 5;
      const requestsPerIteration = 20;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: requestsPerIteration }, () =>
          request(app)
            .post('/auth/login')
            .set('x-tenant-id', '1')
            .send({
              email: testUser.email,
              password: testUser.password
            })
        );

        await Promise.all(promises);
        const endTime = Date.now();
        
        const avgResponseTime = (endTime - startTime) / requestsPerIteration;
        responseTimes.push(avgResponseTime);
      }

      const overallAverage = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(overallAverage).toBeLessThan(200); // Average should be under 200ms
      expect(maxResponseTime).toBeLessThan(500); // Max should be under 500ms

      console.log(`✅ Response Time Consistency:
        - Average Response Time: ${overallAverage.toFixed(2)}ms
        - Max Response Time: ${maxResponseTime.toFixed(2)}ms
        - Min Response Time: ${Math.min(...responseTimes).toFixed(2)}ms
      `);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during high load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let batch = 0; batch < 5; batch++) {
        const promises = Array.from({ length: 50 }, () =>
          request(app)
            .get('/health')
        );
        await Promise.all(promises);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);

      console.log(`✅ Memory Usage:
        - Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)
      `);
    }, 30000);
  });
});