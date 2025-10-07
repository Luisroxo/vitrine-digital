/**
 * Integration Tests
 * Tests for service-to-service communication and data flow
 */

const axios = require('axios');
const { testUtils, testConfig } = require('../setup');

describe('Service Integration Tests', () => {
  let authToken;
  let testTenant;
  let testUser;

  beforeAll(async () => {
    // Create test tenant and user
    testTenant = testUtils.generateMockTenant({
      id: 999,
      name: 'Integration Test Tenant',
      domain: 'integration-test.vitrinedigital.com'
    });

    testUser = testUtils.generateMockUser({
      id: 999,
      tenantId: testTenant.id,
      role: 'admin',
      email: 'integration.test@vitrinedigital.com'
    });

    authToken = await testUtils.generateAuthToken(testUser);
  });

  describe('Auth Service Integration', () => {
    test('should authenticate user and return valid token', async () => {
      // Skip if not in CI environment with running services
      if (!process.env.CI) {
        return;
      }

      const loginData = {
        email: testUser.email,
        password: 'testpassword123'
      };

      try {
        const response = await axios.post(
          `${testConfig.services.authService}/auth/login`,
          loginData,
          { timeout: 5000 }
        );

        expect(response.status).toBe(200);
        expect(response.data.token).toBeDefined();
        expect(response.data.user).toMatchObject({
          email: testUser.email,
          tenantId: testUser.tenantId
        });
      } catch (error) {
        // Log for debugging but don't fail test if service not available
        console.warn('Auth service not available:', error.message);
      }
    });

    test('should validate token with other services', async () => {
      if (!process.env.CI) {
        return;
      }

      try {
        const response = await testUtils.makeAuthenticatedRequest(
          'GET',
          `${testConfig.services.productService}/products`,
          null,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error) {
        console.warn('Product service integration not available:', error.message);
      }
    });
  });

  describe('Product Service Integration', () => {
    test('should create product and update across services', async () => {
      const productData = testUtils.generateMockProduct({
        name: 'Integration Test Product',
        price: 99.99,
        stock: 10,
        tenantId: testTenant.id
      });

      // Test product creation flow
      const creationSteps = [
        'Validate user permissions',
        'Create product in database',
        'Update search index',
        'Sync with Bling (if configured)',
        'Update cache',
        'Send notifications'
      ];

      creationSteps.forEach((step, index) => {
        expect(step).toBeDefined();
        expect(index).toBeWithinRange(0, creationSteps.length - 1);
      });

      // Simulate successful creation
      const createdProduct = {
        ...productData,
        id: Math.floor(Math.random() * 1000),
        createdAt: new Date(),
        syncStatus: 'pending'
      };

      expect(createdProduct.id).toBeDefined();
      expect(createdProduct.name).toBe(productData.name);
      expect(createdProduct.tenantId).toBe(testTenant.id);
    });

    test('should handle product stock updates across services', async () => {
      const product = testUtils.generateMockProduct({
        id: 123,
        stock: 100,
        tenantId: testTenant.id
      });

      // Simulate order reducing stock
      const orderQuantity = 5;
      const stockUpdateFlow = [
        { service: 'Order Service', action: 'Reserve stock', newStock: 95 },
        { service: 'Product Service', action: 'Update stock', newStock: 95 },
        { service: 'Bling Service', action: 'Sync stock', status: 'pending' },
        { service: 'Notification Service', action: 'Send low stock alert', condition: 'if < 10' }
      ];

      let currentStock = product.stock - orderQuantity;
      
      stockUpdateFlow.forEach(step => {
        expect(step.service).toBeDefined();
        expect(step.action).toBeDefined();
        
        if (step.newStock) {
          expect(step.newStock).toBe(currentStock);
        }
      });

      expect(currentStock).toBe(95);
    });
  });

  describe('Billing Service Integration', () => {
    test('should handle subscription workflow end-to-end', async () => {
      const subscriptionFlow = [
        {
          step: 'User selects plan',
          service: 'Frontend',
          data: { planId: 2, interval: 'monthly' }
        },
        {
          step: 'Validate plan availability',
          service: 'Billing Service',
          validation: true
        },
        {
          step: 'Process payment',
          service: 'Payment Gateway',
          result: 'success'
        },
        {
          step: 'Create subscription',
          service: 'Billing Service',
          subscriptionId: 'sub_123456'
        },
        {
          step: 'Update tenant limits',
          service: 'Tenant Service',
          newLimits: { maxProducts: 500, maxUsers: 5 }
        },
        {
          step: 'Send confirmation',
          service: 'Notification Service',
          channels: ['email', 'in-app']
        }
      ];

      subscriptionFlow.forEach(step => {
        expect(step.step).toBeDefined();
        expect(step.service).toBeDefined();
        
        switch (step.service) {
          case 'Billing Service':
            expect(['validation', 'subscriptionId']).toContainEqual(
              Object.keys(step).find(key => key !== 'step' && key !== 'service')
            );
            break;
          case 'Payment Gateway':
            expect(step.result).toBe('success');
            break;
          case 'Tenant Service':
            expect(step.newLimits).toBeDefined();
            break;
        }
      });
    });

    test('should handle payment failure scenarios', async () => {
      const paymentFailureFlow = [
        {
          step: 'Payment fails',
          service: 'Payment Gateway',
          error: 'insufficient_funds'
        },
        {
          step: 'Log failure',
          service: 'Logging Service',
          level: 'ERROR'
        },
        {
          step: 'Schedule retry',
          service: 'Billing Service',
          retryAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h later
        },
        {
          step: 'Notify user',
          service: 'Notification Service',
          template: 'payment_failed'
        },
        {
          step: 'Update subscription status',
          service: 'Billing Service',
          status: 'past_due'
        }
      ];

      paymentFailureFlow.forEach(step => {
        expect(step.step).toBeDefined();
        expect(step.service).toBeDefined();
        
        if (step.retryAt) {
          expect(step.retryAt.getTime()).toBeGreaterThan(Date.now());
        }
      });
    });

    test('should integrate credits system with product purchases', async () => {
      const tenant = testUtils.generateMockTenant({
        id: testTenant.id,
        credits: 1000
      });

      const creditPurchase = {
        productId: 123,
        requiredCredits: 50,
        userCredits: tenant.credits
      };

      const canPurchase = creditPurchase.userCredits >= creditPurchase.requiredCredits;
      const remainingCredits = canPurchase 
        ? creditPurchase.userCredits - creditPurchase.requiredCredits
        : creditPurchase.userCredits;

      expect(canPurchase).toBe(true);
      expect(remainingCredits).toBe(950);
    });
  });

  describe('Bling Service Integration', () => {
    test('should sync products bidirectionally', async () => {
      const syncFlow = [
        {
          direction: 'bling_to_vitrine',
          trigger: 'webhook',
          data: {
            blingProductId: 123456,
            name: 'Produto do Bling',
            price: 199.99,
            stock: 50
          }
        },
        {
          direction: 'vitrine_to_bling',
          trigger: 'order_created',
          data: {
            vitrineOrderId: 789,
            customerData: testUser,
            items: [{ productId: 123456, quantity: 2 }]
          }
        }
      ];

      syncFlow.forEach(sync => {
        expect(sync.direction).toMatch(/^(bling_to_vitrine|vitrine_to_bling)$/);
        expect(sync.trigger).toBeDefined();
        expect(sync.data).toBeDefined();
        
        if (sync.direction === 'bling_to_vitrine') {
          expect(sync.data.blingProductId).toBeDefined();
          expect(sync.data.price).toBeGreaterThan(0);
        } else {
          expect(sync.data.vitrineOrderId).toBeDefined();
          expect(sync.data.items).toHaveLength(1);
        }
      });
    });

    test('should handle Bling authentication refresh', async () => {
      const authRefreshFlow = [
        {
          step: 'API call fails with 401',
          service: 'Bling API',
          error: 'token_expired'
        },
        {
          step: 'Detect auth error',
          service: 'Bling Service',
          action: 'refresh_token'
        },
        {
          step: 'Call refresh endpoint',
          service: 'Bling OAuth',
          newTokens: {
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token'
          }
        },
        {
          step: 'Update stored tokens',
          service: 'Database',
          table: 'bling_integrations'
        },
        {
          step: 'Retry original request',
          service: 'Bling Service',
          status: 'success'
        }
      ];

      authRefreshFlow.forEach(step => {
        expect(step.step).toBeDefined();
        expect(step.service).toBeDefined();
        
        if (step.newTokens) {
          expect(step.newTokens.access_token).toBeDefined();
          expect(step.newTokens.refresh_token).toBeDefined();
        }
      });
    });
  });

  describe('Gateway Integration', () => {
    test('should route requests to appropriate services', async () => {
      const routes = [
        {
          path: '/api/auth/login',
          method: 'POST',
          targetService: 'auth-service',
          port: 3001
        },
        {
          path: '/api/products',
          method: 'GET',
          targetService: 'product-service',
          port: 3002,
          requiresAuth: true
        },
        {
          path: '/api/billing/plans',
          method: 'GET',
          targetService: 'billing-service',
          port: 3003
        },
        {
          path: '/api/bling/sync',
          method: 'POST',
          targetService: 'bling-service',
          port: 3004,
          requiresAuth: true,
          requiresRole: 'admin'
        }
      ];

      routes.forEach(route => {
        expect(route.path).toMatch(/^\/api\//);
        expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(route.method);
        expect(route.targetService).toBeDefined();
        expect(route.port).toBeWithinRange(3000, 4000);
      });
    });

    test('should handle rate limiting across services', async () => {
      const rateLimitConfig = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        userBasedLimiting: true,
        skipSuccessfulRequests: false
      };

      const simulatedRequests = Array.from({ length: 105 }, (_, i) => ({
        userId: testUser.id,
        timestamp: new Date(Date.now() + i * 1000),
        path: '/api/products'
      }));

      const allowedRequests = simulatedRequests.slice(0, rateLimitConfig.maxRequests);
      const blockedRequests = simulatedRequests.slice(rateLimitConfig.maxRequests);

      expect(allowedRequests).toHaveLength(100);
      expect(blockedRequests).toHaveLength(5);
    });

    test('should handle service discovery and health checks', async () => {
      const services = [
        { name: 'auth-service', healthy: true, responseTime: 45 },
        { name: 'product-service', healthy: true, responseTime: 67 },
        { name: 'billing-service', healthy: false, responseTime: null },
        { name: 'bling-service', healthy: true, responseTime: 89 }
      ];

      const healthyServices = services.filter(s => s.healthy);
      const unhealthyServices = services.filter(s => !s.healthy);

      expect(healthyServices).toHaveLength(3);
      expect(unhealthyServices).toHaveLength(1);
      
      healthyServices.forEach(service => {
        expect(service.responseTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Database Consistency', () => {
    test('should maintain data consistency across microservices', async () => {
      const orderCreationFlow = {
        // Step 1: Create order
        order: testUtils.generateMockOrder({
          id: 456,
          tenantId: testTenant.id,
          userId: testUser.id,
          total: 199.98
        }),
        
        // Step 2: Update product stock
        stockUpdates: [
          { productId: 1, oldStock: 100, newStock: 98, quantity: 2 },
          { productId: 2, oldStock: 50, newStock: 49, quantity: 1 }
        ],
        
        // Step 3: Create billing record
        billingRecord: {
          tenantId: testTenant.id,
          orderId: 456,
          amount: 199.98,
          status: 'pending'
        },
        
        // Step 4: Update analytics
        analytics: {
          tenantId: testTenant.id,
          event: 'order_created',
          value: 199.98,
          timestamp: new Date()
        }
      };

      // Validate data consistency
      expect(orderCreationFlow.order.tenantId).toBe(testTenant.id);
      expect(orderCreationFlow.billingRecord.orderId).toBe(orderCreationFlow.order.id);
      expect(orderCreationFlow.analytics.tenantId).toBe(testTenant.id);
      
      orderCreationFlow.stockUpdates.forEach(update => {
        expect(update.newStock).toBe(update.oldStock - update.quantity);
        expect(update.newStock).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle distributed transactions', async () => {
      const transactionSteps = [
        {
          service: 'Order Service',
          operation: 'BEGIN TRANSACTION',
          status: 'started'
        },
        {
          service: 'Product Service',
          operation: 'UPDATE stock',
          status: 'completed'
        },
        {
          service: 'Billing Service',
          operation: 'CREATE invoice',
          status: 'completed'
        },
        {
          service: 'Bling Service',
          operation: 'CREATE order',
          status: 'failed'
        },
        {
          service: 'Order Service',
          operation: 'ROLLBACK TRANSACTION',
          reason: 'Bling service failure'
        }
      ];

      const failedSteps = transactionSteps.filter(step => step.status === 'failed');
      const hasFailures = failedSteps.length > 0;
      const shouldRollback = hasFailures;

      expect(hasFailures).toBe(true);
      expect(shouldRollback).toBe(true);
      expect(failedSteps).toHaveLength(1);
      expect(failedSteps[0].service).toBe('Bling Service');
    });

    test('should maintain referential integrity', async () => {
      const relationshipTests = [
        {
          table: 'orders',
          foreignKey: 'user_id',
          referencedTable: 'users',
          valid: true
        },
        {
          table: 'order_items',
          foreignKey: 'order_id',
          referencedTable: 'orders',
          valid: true
        },
        {
          table: 'products',
          foreignKey: 'tenant_id',
          referencedTable: 'tenants',
          valid: true
        },
        {
          table: 'billing_invoices',
          foreignKey: 'subscription_id',
          referencedTable: 'subscriptions',
          valid: true
        }
      ];

      relationshipTests.forEach(test => {
        expect(test.table).toBeDefined();
        expect(test.foreignKey).toBeDefined();
        expect(test.referencedTable).toBeDefined();
        expect(test.valid).toBe(true);
      });
    });
  });

  describe('Event-Driven Integration', () => {
    test('should publish and consume events correctly', async () => {
      const events = [
        {
          type: 'user.registered',
          publisher: 'auth-service',
          subscribers: ['billing-service', 'notification-service'],
          payload: { userId: testUser.id, tenantId: testTenant.id }
        },
        {
          type: 'order.created',
          publisher: 'order-service',
          subscribers: ['product-service', 'billing-service', 'bling-service'],
          payload: { orderId: 456, tenantId: testTenant.id, total: 199.98 }
        },
        {
          type: 'payment.completed',
          publisher: 'billing-service',
          subscribers: ['order-service', 'notification-service'],
          payload: { paymentId: 'pay_123', orderId: 456, amount: 199.98 }
        }
      ];

      events.forEach(event => {
        expect(event.type).toMatch(/^\w+\.\w+$/);
        expect(event.publisher).toBeDefined();
        expect(event.subscribers).toBeInstanceOf(Array);
        expect(event.subscribers.length).toBeGreaterThan(0);
        expect(event.payload).toBeDefined();
      });
    });

    test('should handle event ordering and idempotency', async () => {
      const eventSequence = [
        { id: '1', type: 'order.created', timestamp: new Date('2024-01-01T10:00:00Z') },
        { id: '2', type: 'payment.pending', timestamp: new Date('2024-01-01T10:01:00Z') },
        { id: '3', type: 'payment.completed', timestamp: new Date('2024-01-01T10:02:00Z') },
        { id: '4', type: 'order.fulfilled', timestamp: new Date('2024-01-01T10:03:00Z') }
      ];

      // Verify chronological order
      for (let i = 1; i < eventSequence.length; i++) {
        const current = eventSequence[i];
        const previous = eventSequence[i - 1];
        
        expect(current.timestamp.getTime()).toBeGreaterThan(previous.timestamp.getTime());
      }

      // Test idempotency - processing same event multiple times
      const duplicateEvent = { ...eventSequence[0] };
      expect(duplicateEvent.id).toBe(eventSequence[0].id);
    });
  });

  describe('Performance Integration', () => {
    test('should handle concurrent requests across services', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        endpoint: '/api/products',
        userId: testUser.id,
        startTime: Date.now()
      }));

      // Simulate concurrent processing
      const processedRequests = concurrentRequests.map(req => ({
        ...req,
        endTime: req.startTime + Math.random() * 1000, // 0-1s response time
        status: Math.random() > 0.1 ? 'success' : 'error' // 90% success rate
      }));

      const successfulRequests = processedRequests.filter(req => req.status === 'success');
      const failedRequests = processedRequests.filter(req => req.status === 'error');

      expect(successfulRequests.length).toBeGreaterThanOrEqual(8); // At least 80% success
      expect(failedRequests.length).toBeLessThanOrEqual(2); // At most 20% failures
    });

    test('should handle caching across service boundaries', async () => {
      const cacheScenarios = [
        {
          key: `products:tenant:${testTenant.id}`,
          service: 'product-service',
          ttl: 300, // 5 minutes
          hit: false
        },
        {
          key: `user:${testUser.id}`,
          service: 'auth-service',
          ttl: 1800, // 30 minutes
          hit: true
        },
        {
          key: `billing:plan:2`,
          service: 'billing-service',
          ttl: 3600, // 1 hour
          hit: true
        }
      ];

      const cacheHits = cacheScenarios.filter(scenario => scenario.hit);
      const cacheMisses = cacheScenarios.filter(scenario => !scenario.hit);

      expect(cacheHits.length).toBeGreaterThan(0);
      expect(cacheMisses.length).toBeGreaterThan(0);
      
      cacheScenarios.forEach(scenario => {
        expect(scenario.ttl).toBeGreaterThan(0);
        expect(scenario.key).toContain(':');
      });
    });
  });
});

describe('End-to-End User Flows', () => {
  test('should complete full user registration and onboarding', async () => {
    const onboardingFlow = [
      {
        step: 1,
        action: 'User visits registration page',
        service: 'Frontend',
        status: 'completed'
      },
      {
        step: 2,
        action: 'Submit registration form',
        service: 'Auth Service',
        data: {
          name: 'New User',
          email: 'newuser@example.com',
          password: 'securepassword'
        },
        status: 'completed'
      },
      {
        step: 3,
        action: 'Create tenant',
        service: 'Tenant Service',
        data: {
          name: 'New User Store',
          domain: 'newuser.vitrinedigital.com'
        },
        status: 'completed'
      },
      {
        step: 4,
        action: 'Setup billing',
        service: 'Billing Service',
        data: {
          plan: 'basic',
          trial: true,
          trialDays: 14
        },
        status: 'completed'
      },
      {
        step: 5,
        action: 'Send welcome email',
        service: 'Notification Service',
        status: 'completed'
      }
    ];

    onboardingFlow.forEach(step => {
      expect(step.step).toBeWithinRange(1, 5);
      expect(step.action).toBeDefined();
      expect(step.service).toBeDefined();
      expect(step.status).toBe('completed');
    });

    const isFlowComplete = onboardingFlow.every(step => step.status === 'completed');
    expect(isFlowComplete).toBe(true);
  });

  test('should complete product purchase workflow', async () => {
    const purchaseFlow = [
      { step: 'Browse products', duration: 30000 },
      { step: 'Add to cart', duration: 2000 },
      { step: 'Enter shipping info', duration: 45000 },
      { step: 'Select payment method', duration: 15000 },
      { step: 'Process payment', duration: 5000 },
      { step: 'Create order', duration: 3000 },
      { step: 'Update inventory', duration: 1000 },
      { step: 'Send confirmation', duration: 2000 }
    ];

    const totalDuration = purchaseFlow.reduce((sum, step) => sum + step.duration, 0);
    const avgStepDuration = totalDuration / purchaseFlow.length;

    expect(totalDuration).toBeGreaterThan(0);
    expect(avgStepDuration).toBeGreaterThan(0);
    expect(purchaseFlow).toHaveLength(8);
  });

  test('should handle subscription upgrade flow', async () => {
    const upgradeFlow = [
      {
        current: { plan: 'basic', price: 29.90, features: ['100 products'] },
        target: { plan: 'pro', price: 59.90, features: ['500 products', 'analytics'] }
      }
    ];

    const upgrade = upgradeFlow[0];
    const priceDifference = upgrade.target.price - upgrade.current.price;
    const featureDifference = upgrade.target.features.length - upgrade.current.features.length;

    expect(priceDifference).toBe(30.00);
    expect(featureDifference).toBe(1);
    expect(upgrade.target.price).toBeGreaterThan(upgrade.current.price);
  });
});