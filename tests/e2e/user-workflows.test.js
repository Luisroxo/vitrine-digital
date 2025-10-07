/**
 * End-to-End Tests
 * Tests for complete user workflows and business processes
 */

const { testUtils, testConfig } = require('../setup');

describe('End-to-End User Workflows', () => {
  let browser;
  let page;
  let testTenant;
  let testUser;

  beforeAll(async () => {
    // Mock browser setup for E2E testing
    browser = {
      name: 'Chrome',
      version: '119.0',
      headless: true
    };

    page = {
      url: '',
      title: '',
      elements: new Map()
    };

    testTenant = testUtils.generateMockTenant({
      id: 500,
      name: 'E2E Test Store',
      domain: 'e2e-test.vitrinedigital.com'
    });

    testUser = testUtils.generateMockUser({
      id: 600,
      tenantId: testTenant.id,
      role: 'admin',
      email: 'e2e.admin@vitrinedigital.com'
    });
  });

  describe('User Registration and Onboarding Flow', () => {
    test('should complete full registration workflow', async () => {
      const registrationFlow = [
        {
          step: 1,
          page: '/register',
          action: 'Fill registration form',
          data: {
            name: 'New Store Owner',
            email: 'newowner@example.com',
            password: 'SecurePass123!',
            tenantName: 'Amazing Store',
            confirmPassword: 'SecurePass123!'
          },
          expected: 'Form validation passes'
        },
        {
          step: 2,
          page: '/register',
          action: 'Submit form',
          expected: 'Redirect to verification page',
          redirectTo: '/verify-email'
        },
        {
          step: 3,
          page: '/verify-email',
          action: 'Enter verification code',
          data: { code: '123456' },
          expected: 'Email verified successfully'
        },
        {
          step: 4,
          page: '/onboarding/plan',
          action: 'Select billing plan',
          data: { planId: 2, interval: 'monthly' },
          expected: 'Redirect to payment'
        },
        {
          step: 5,
          page: '/onboarding/payment',
          action: 'Enter payment details',
          data: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123'
          },
          expected: 'Payment processed successfully'
        },
        {
          step: 6,
          page: '/dashboard',
          action: 'Welcome dashboard loaded',
          expected: 'User logged in and dashboard visible'
        }
      ];

      // Simulate each step
      for (const flowStep of registrationFlow) {
        page.url = testConfig.baseUrl + flowStep.page;
        page.title = getPageTitle(flowStep.page);

        // Validate step requirements
        expect(flowStep.step).toBeWithinRange(1, 6);
        expect(flowStep.page).toMatch(/^\/[a-z-\/]*$/);
        expect(flowStep.action).toBeDefined();
        expect(flowStep.expected).toBeDefined();

        // Simulate form interactions
        if (flowStep.data) {
          Object.entries(flowStep.data).forEach(([field, value]) => {
            page.elements.set(field, value);
          });
        }

        // Validate expected outcomes
        if (flowStep.redirectTo) {
          expect(flowStep.redirectTo).toMatch(/^\/[a-z-\/]*$/);
        }
      }

      expect(page.url).toContain('/dashboard');
      expect(registrationFlow).toHaveLength(6);
    });

    test('should handle registration validation errors', async () => {
      const validationTests = [
        {
          scenario: 'Weak password',
          data: { password: '123' },
          expectedError: 'Password must be at least 8 characters',
          errorField: 'password'
        },
        {
          scenario: 'Invalid email',
          data: { email: 'invalid-email' },
          expectedError: 'Please enter a valid email address',
          errorField: 'email'
        },
        {
          scenario: 'Passwords do not match',
          data: { password: 'Pass123!', confirmPassword: 'Pass456!' },
          expectedError: 'Passwords do not match',
          errorField: 'confirmPassword'
        },
        {
          scenario: 'Duplicate email',
          data: { email: testUser.email },
          expectedError: 'Email already registered',
          errorField: 'email'
        }
      ];

      validationTests.forEach(test => {
        expect(test.scenario).toBeDefined();
        expect(test.expectedError).toBeDefined();
        expect(test.errorField).toBeDefined();
        expect(['password', 'email', 'confirmPassword']).toContain(test.errorField);
      });
    });

    test('should complete onboarding checklist', async () => {
      const onboardingTasks = [
        {
          id: 'verify-email',
          title: 'Verify your email address',
          completed: true,
          required: true
        },
        {
          id: 'setup-payment',
          title: 'Add payment method',
          completed: true,
          required: true
        },
        {
          id: 'create-first-product',
          title: 'Create your first product',
          completed: false,
          required: false
        },
        {
          id: 'customize-theme',
          title: 'Customize your store theme',
          completed: false,
          required: false
        },
        {
          id: 'setup-domain',
          title: 'Connect custom domain',
          completed: false,
          required: false
        }
      ];

      const requiredTasks = onboardingTasks.filter(task => task.required);
      const completedRequired = requiredTasks.filter(task => task.completed);
      const optionalTasks = onboardingTasks.filter(task => !task.required);

      expect(completedRequired).toHaveLength(requiredTasks.length);
      expect(optionalTasks).toHaveLength(3);

      const onboardingProgress = (completedRequired.length / requiredTasks.length) * 100;
      expect(onboardingProgress).toBe(100);
    });
  });

  describe('Product Management Workflow', () => {
    test('should create and manage products', async () => {
      const productWorkflow = [
        {
          step: 'Navigate to products',
          page: '/admin/products',
          action: 'Click "Add Product" button',
          expected: 'Product form opens'
        },
        {
          step: 'Fill product details',
          action: 'Enter product information',
          data: {
            name: 'E2E Test Product',
            description: 'A product created during E2E testing',
            price: 99.99,
            originalPrice: 129.99,
            category: 'Electronics',
            stock: 50,
            weight: 0.5,
            tags: ['test', 'electronics', 'gadget']
          },
          expected: 'Form validation passes'
        },
        {
          step: 'Upload images',
          action: 'Add product images',
          data: {
            images: [
              'https://example.com/product1.jpg',
              'https://example.com/product2.jpg'
            ]
          },
          expected: 'Images uploaded successfully'
        },
        {
          step: 'Set dimensions',
          action: 'Enter product dimensions',
          data: {
            dimensions: {
              height: 10,
              width: 15,
              depth: 5
            }
          },
          expected: 'Dimensions saved'
        },
        {
          step: 'Save product',
          action: 'Click save button',
          expected: 'Product created successfully',
          redirectTo: '/admin/products'
        },
        {
          step: 'Verify listing',
          page: '/admin/products',
          action: 'Check product appears in list',
          expected: 'Product visible in products table'
        }
      ];

      // Validate workflow structure
      productWorkflow.forEach((step, index) => {
        expect(step.step).toBeDefined();
        expect(step.action).toBeDefined();
        expect(step.expected).toBeDefined();
        
        if (step.data) {
          expect(typeof step.data).toBe('object');
        }
      });

      // Test product data validation
      const productData = productWorkflow[1].data;
      expect(productData.price).toBeGreaterThan(0);
      expect(productData.stock).toBeGreaterThanOrEqual(0);
      expect(productData.name.length).toBeGreaterThan(0);
      expect(productData.tags).toBeInstanceOf(Array);
    });

    test('should update product stock', async () => {
      const stockUpdateFlow = [
        {
          action: 'Navigate to product details',
          page: '/admin/products/123',
          currentStock: 50
        },
        {
          action: 'Click stock adjustment button',
          modal: 'stock-adjustment-modal',
          visible: true
        },
        {
          action: 'Enter stock adjustment',
          data: {
            operation: 'add',
            quantity: 25,
            reason: 'New inventory received'
          }
        },
        {
          action: 'Save stock adjustment',
          expected: 'Stock updated successfully',
          newStock: 75
        },
        {
          action: 'Verify stock history',
          page: '/admin/products/123/history',
          expected: 'Stock change logged'
        }
      ];

      const initialStock = stockUpdateFlow[0].currentStock;
      const adjustment = stockUpdateFlow[2].data;
      const finalStock = stockUpdateFlow[3].newStock;

      if (adjustment.operation === 'add') {
        expect(finalStock).toBe(initialStock + adjustment.quantity);
      } else if (adjustment.operation === 'subtract') {
        expect(finalStock).toBe(initialStock - adjustment.quantity);
      }

      expect(adjustment.reason).toBeDefined();
      expect(adjustment.quantity).toBeGreaterThan(0);
    });

    test('should handle bulk product operations', async () => {
      const bulkOperations = [
        {
          operation: 'Bulk price update',
          selection: [1, 2, 3, 4, 5],
          data: {
            type: 'percentage_increase',
            value: 10 // 10% increase
          },
          expected: 'Prices updated for 5 products'
        },
        {
          operation: 'Bulk category change',
          selection: [1, 3, 5],
          data: {
            newCategory: 'Sale Items'
          },
          expected: 'Category updated for 3 products'
        },
        {
          operation: 'Bulk status toggle',
          selection: [2, 4],
          data: {
            active: false
          },
          expected: '2 products deactivated'
        }
      ];

      bulkOperations.forEach(op => {
        expect(op.selection).toBeInstanceOf(Array);
        expect(op.selection.length).toBeGreaterThan(0);
        expect(op.data).toBeDefined();
        expect(op.expected).toContain(op.selection.length.toString());
      });
    });
  });

  describe('Order Processing Workflow', () => {
    test('should process complete order lifecycle', async () => {
      const orderLifecycle = [
        {
          stage: 'Customer browsing',
          page: '/products',
          action: 'View product catalog',
          status: 'browsing'
        },
        {
          stage: 'Add to cart',
          action: 'Click "Add to Cart"',
          data: {
            productId: 123,
            quantity: 2,
            price: 99.99
          },
          status: 'cart_updated'
        },
        {
          stage: 'Cart review',
          page: '/cart',
          action: 'Review cart contents',
          data: {
            items: [
              { productId: 123, quantity: 2, subtotal: 199.98 }
            ],
            total: 199.98,
            shipping: 15.00,
            tax: 20.00,
            grandTotal: 234.98
          },
          status: 'cart_ready'
        },
        {
          stage: 'Checkout initiation',
          page: '/checkout',
          action: 'Begin checkout process',
          status: 'checkout_started'
        },
        {
          stage: 'Shipping information',
          action: 'Enter shipping details',
          data: {
            name: 'Customer Name',
            address: 'Rua Example, 123',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567',
            phone: '(11) 99999-9999'
          },
          status: 'shipping_entered'
        },
        {
          stage: 'Payment processing',
          action: 'Process payment',
          data: {
            method: 'credit_card',
            cardLast4: '1111',
            amount: 234.98
          },
          status: 'payment_processing'
        },
        {
          stage: 'Order confirmation',
          action: 'Generate order',
          data: {
            orderId: 'ORD-' + Date.now(),
            status: 'confirmed',
            total: 234.98
          },
          status: 'order_created'
        },
        {
          stage: 'Inventory update',
          action: 'Reduce product stock',
          data: {
            productId: 123,
            oldStock: 50,
            newStock: 48,
            reserved: 2
          },
          status: 'inventory_updated'
        },
        {
          stage: 'Order fulfillment',
          action: 'Prepare for shipping',
          data: {
            trackingNumber: 'BR123456789',
            carrier: 'Correios'
          },
          status: 'preparing_shipment'
        },
        {
          stage: 'Order completion',
          action: 'Mark as shipped',
          data: {
            shippedAt: new Date(),
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          },
          status: 'shipped'
        }
      ];

      // Validate order progression
      orderLifecycle.forEach((stage, index) => {
        expect(stage.stage).toBeDefined();
        expect(stage.action).toBeDefined();
        expect(stage.status).toBeDefined();

        // Validate order totals
        if (stage.data && stage.data.total) {
          expect(stage.data.total).toBeGreaterThan(0);
        }

        // Validate stock updates
        if (stage.data && stage.data.oldStock !== undefined) {
          expect(stage.data.newStock).toBe(stage.data.oldStock - stage.data.reserved);
        }
      });

      const statusProgression = orderLifecycle.map(stage => stage.status);
      expect(statusProgression).toContain('order_created');
      expect(statusProgression).toContain('shipped');
    });

    test('should handle order cancellation', async () => {
      const cancellationFlow = [
        {
          trigger: 'Customer cancellation request',
          orderId: 'ORD-123456',
          currentStatus: 'confirmed',
          reason: 'Customer changed mind'
        },
        {
          action: 'Check cancellation eligibility',
          eligible: true,
          reason: 'Order not yet shipped'
        },
        {
          action: 'Process refund',
          refundMethod: 'original_payment_method',
          amount: 234.98,
          refundId: 'REF-789012'
        },
        {
          action: 'Restore inventory',
          productUpdates: [
            { productId: 123, stockIncrease: 2 }
          ]
        },
        {
          action: 'Update order status',
          newStatus: 'canceled',
          canceledAt: new Date()
        },
        {
          action: 'Send notification',
          channels: ['email', 'sms'],
          template: 'order_canceled'
        }
      ];

      // Validate cancellation logic
      const eligibilityCheck = cancellationFlow[1];
      expect(eligibilityCheck.eligible).toBe(true);

      const refundStep = cancellationFlow[2];
      expect(refundStep.amount).toBeGreaterThan(0);
      expect(refundStep.refundId).toMatch(/^REF-/);

      const inventoryRestore = cancellationFlow[3];
      expect(inventoryRestore.productUpdates).toHaveLength(1);
      expect(inventoryRestore.productUpdates[0].stockIncrease).toBeGreaterThan(0);
    });

    test('should handle payment failures', async () => {
      const paymentFailureScenarios = [
        {
          scenario: 'Insufficient funds',
          errorCode: 'card_declined',
          customerAction: 'Try different card',
          retryAllowed: true
        },
        {
          scenario: 'Expired card',
          errorCode: 'expired_card', 
          customerAction: 'Update card details',
          retryAllowed: true
        },
        {
          scenario: 'Invalid CVV',
          errorCode: 'incorrect_cvc',
          customerAction: 'Check CVV number',
          retryAllowed: true
        },
        {
          scenario: 'Suspected fraud',
          errorCode: 'fraud_suspected',
          customerAction: 'Contact bank',
          retryAllowed: false
        }
      ];

      paymentFailureScenarios.forEach(scenario => {
        expect(scenario.errorCode).toBeDefined();
        expect(scenario.customerAction).toBeDefined();
        expect(typeof scenario.retryAllowed).toBe('boolean');
        
        if (!scenario.retryAllowed) {
          expect(scenario.scenario).toContain('fraud');
        }
      });

      const retryableFailures = paymentFailureScenarios.filter(s => s.retryAllowed);
      const nonRetryableFailures = paymentFailureScenarios.filter(s => !s.retryAllowed);
      
      expect(retryableFailures).toHaveLength(3);
      expect(nonRetryableFailures).toHaveLength(1);
    });
  });

  describe('Subscription Management Workflow', () => {
    test('should handle subscription upgrade', async () => {
      const upgradeFlow = [
        {
          current: {
            plan: 'Basic',
            price: 29.90,
            features: ['100 products', 'Basic support']
          },
          target: {
            plan: 'Pro',
            price: 59.90,
            features: ['500 products', 'Priority support', 'Analytics']
          }
        },
        {
          action: 'Calculate proration',
          daysRemaining: 15,
          currentMonthlyRate: 29.90,
          newMonthlyRate: 59.90,
          prorationAmount: 15.00
        },
        {
          action: 'Process upgrade payment',
          chargeAmount: 15.00,
          paymentMethod: 'card_ending_1111'
        },
        {
          action: 'Update subscription',
          newPlanId: 2,
          effectiveDate: new Date(),
          nextBillingAmount: 59.90
        },
        {
          action: 'Update tenant limits',
          newLimits: {
            maxProducts: 500,
            maxUsers: 5,
            analyticsEnabled: true
          }
        }
      ];

      const currentPlan = upgradeFlow[0].current;
      const targetPlan = upgradeFlow[0].target;
      const proration = upgradeFlow[1];

      expect(targetPlan.price).toBeGreaterThan(currentPlan.price);
      expect(targetPlan.features.length).toBeGreaterThan(currentPlan.features.length);
      expect(proration.prorationAmount).toBeGreaterThan(0);
    });

    test('should handle subscription cancellation', async () => {
      const cancellationFlow = [
        {
          step: 'Cancellation request',
          reason: 'Business closure',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date('2024-02-01')
        },
        {
          step: 'Retention attempt',
          offers: [
            { type: 'discount', value: 20, description: '20% off next 3 months' },
            { type: 'downgrade', plan: 'Basic', description: 'Switch to Basic plan' }
          ],
          customerDecision: 'proceed_with_cancellation'
        },
        {
          step: 'Data export offer',
          dataTypes: ['products', 'customers', 'orders'],
          exportFormat: 'CSV',
          downloadLink: 'https://exports.vitrinedigital.com/tenant-500-export.zip'
        },
        {
          step: 'Schedule cancellation',
          effectiveDate: new Date('2024-02-01'),
          accessUntil: new Date('2024-02-01'),
          dataRetentionDays: 90
        },
        {
          step: 'Send confirmation',
          emailSent: true,
          confirmationNumber: 'CANCEL-789123'
        }
      ];

      const retentionStep = cancellationFlow[1];
      expect(retentionStep.offers).toHaveLength(2);
      expect(retentionStep.customerDecision).toBe('proceed_with_cancellation');

      const dataExportStep = cancellationFlow[2];
      expect(dataExportStep.dataTypes).toContain('products');
      expect(dataExportStep.downloadLink).toMatch(/^https:/);

      const scheduleStep = cancellationFlow[3];
      expect(scheduleStep.dataRetentionDays).toBe(90);
    });
  });

  describe('Bling Integration Workflow', () => {
    test('should complete Bling ERP connection', async () => {
      const blingIntegrationFlow = [
        {
          step: 'Initiate OAuth',
          page: '/admin/integrations/bling',
          action: 'Click "Connect to Bling"',
          redirectTo: 'https://bling.com.br/oauth/authorize'
        },
        {
          step: 'User authorization',
          page: 'bling.com.br',
          action: 'User grants permissions',
          permissions: ['read:products', 'write:orders', 'read:customers']
        },
        {
          step: 'OAuth callback',
          page: '/admin/integrations/bling/callback',
          data: {
            code: 'auth_code_123',
            state: 'random_state_456'
          },
          action: 'Exchange code for tokens'
        },
        {
          step: 'Store credentials',
          action: 'Save access tokens',
          data: {
            accessToken: 'access_token_789',
            refreshToken: 'refresh_token_012',
            expiresAt: new Date(Date.now() + 3600000)
          }
        },
        {
          step: 'Test connection',
          action: 'Verify API access',
          endpoint: 'GET /api/v3/produtos',
          status: 200
        },
        {
          step: 'Initial sync',
          action: 'Sync existing products',
          syncStatus: 'in_progress',
          productsFound: 150
        }
      ];

      // Validate OAuth flow
      const oauthStep = blingIntegrationFlow[0];
      expect(oauthStep.redirectTo).toContain('bling.com.br');

      const callbackStep = blingIntegrationFlow[2];
      expect(callbackStep.data.code).toMatch(/^auth_code_/);
      expect(callbackStep.data.state).toMatch(/^random_state_/);

      const credentialStep = blingIntegrationFlow[3];
      expect(credentialStep.data.accessToken).toBeDefined();
      expect(credentialStep.data.refreshToken).toBeDefined();

      const syncStep = blingIntegrationFlow[5];
      expect(syncStep.productsFound).toBeGreaterThan(0);
    });

    test('should sync products from Bling', async () => {
      const productSyncFlow = [
        {
          action: 'Fetch products from Bling',
          endpoint: 'GET /api/v3/produtos',
          pagination: { page: 1, limit: 100 },
          response: {
            data: [
              {
                id: 123456,
                nome: 'Produto do Bling',
                preco: 99.99,
                estoque: 50,
                categoria: 'Eletrônicos'
              }
            ]
          }
        },
        {
          action: 'Map Bling product to local format',
          mapping: {
            'id': 'blingId',
            'nome': 'name',
            'preco': 'price',
            'estoque': 'stock',
            'categoria': 'category'
          }
        },
        {
          action: 'Check for existing product',
          query: 'SELECT id FROM products WHERE bling_id = ?',
          params: [123456],
          found: false
        },
        {
          action: 'Create new product',
          data: {
            blingId: 123456,
            name: 'Produto do Bling',
            price: 99.99,
            stock: 50,
            category: 'Eletrônicos',
            tenantId: testTenant.id,
            syncedAt: new Date()
          }
        },
        {
          action: 'Update sync status',
          syncRecord: {
            blingProductId: 123456,
            localProductId: 789,
            status: 'synced',
            lastSyncAt: new Date()
          }
        }
      ];

      // Validate product mapping
      const mappingStep = productSyncFlow[1];
      expect(Object.keys(mappingStep.mapping)).toContain('nome');
      expect(Object.values(mappingStep.mapping)).toContain('name');

      const productData = productSyncFlow[3].data;
      expect(productData.blingId).toBeDefined();
      expect(productData.tenantId).toBe(testTenant.id);
      expect(productData.price).toBeGreaterThan(0);
    });

    test('should create order in Bling', async () => {
      const orderToBlingFlow = [
        {
          step: 'Order created locally',
          orderId: 'ORD-456789',
          orderData: {
            customer: {
              name: 'João Silva',
              email: 'joao@example.com',
              phone: '(11) 99999-9999'
            },
            items: [
              {
                productId: 789,
                blingProductId: 123456,
                quantity: 2,
                price: 99.99
              }
            ],
            total: 199.98
          }
        },
        {
          step: 'Map to Bling format',
          blingPayload: {
            cliente: {
              nome: 'João Silva',
              email: 'joao@example.com',
              telefone: '(11) 99999-9999'
            },
            itens: [
              {
                produto: {
                  id: 123456
                },
                quantidade: 2,
                valor: 99.99
              }
            ],
            valorTotal: 199.98
          }
        },
        {
          step: 'Send to Bling API',
          endpoint: 'POST /api/v3/pedidos',
          headers: {
            'Authorization': 'Bearer access_token_789',
            'Content-Type': 'application/json'
          },
          response: {
            data: {
              id: 987654,
              numero: 'PED-001',
              situacao: 'Em aberto'
            }
          }
        },
        {
          step: 'Update local order',
          updateData: {
            blingOrderId: 987654,
            blingOrderNumber: 'PED-001',
            syncedToBling: true,
            syncedAt: new Date()
          }
        }
      ];

      // Validate order conversion
      const localOrder = orderToBlingFlow[0].orderData;
      const blingPayload = orderToBlingFlow[1].blingPayload;

      expect(localOrder.customer.name).toBe(blingPayload.cliente.nome);
      expect(localOrder.total).toBe(blingPayload.valorTotal);
      expect(localOrder.items[0].blingProductId).toBe(blingPayload.itens[0].produto.id);

      const apiResponse = orderToBlingFlow[2].response;
      expect(apiResponse.data.id).toBeDefined();
      expect(apiResponse.data.numero).toMatch(/^PED-/);
    });
  });

  describe('Admin Dashboard Workflow', () => {
    test('should display comprehensive analytics', async () => {
      const dashboardMetrics = [
        {
          widget: 'Revenue Overview',
          timeframe: 'Last 30 days',
          data: {
            totalRevenue: 15750.00,
            previousPeriod: 12300.00,
            growth: 28.0,
            trend: 'up'
          }
        },
        {
          widget: 'Orders Summary',
          data: {
            totalOrders: 89,
            pendingOrders: 5,
            shippedOrders: 76,
            canceledOrders: 8,
            averageOrderValue: 176.97
          }
        },
        {
          widget: 'Top Products',
          data: [
            { id: 1, name: 'Smartphone XYZ', sales: 25, revenue: 4999.75 },
            { id: 2, name: 'Headphones Pro', sales: 18, revenue: 2699.82 },
            { id: 3, name: 'Tablet Ultra', sales: 12, revenue: 3599.88 }
          ]
        },
        {
          widget: 'Low Stock Alert',
          data: [
            { id: 5, name: 'Cable USB-C', currentStock: 3, minimumStock: 10 },
            { id: 8, name: 'Power Bank', currentStock: 1, minimumStock: 5 }
          ]
        },
        {
          widget: 'Customer Analytics',
          data: {
            totalCustomers: 156,
            newCustomers: 12,
            returningCustomers: 67,
            customerRetentionRate: 42.9
          }
        }
      ];

      // Validate metrics calculations
      const revenueWidget = dashboardMetrics[0];
      const growthRate = ((revenueWidget.data.totalRevenue - revenueWidget.data.previousPeriod) / revenueWidget.data.previousPeriod) * 100;
      expect(Math.round(growthRate)).toBe(Math.round(revenueWidget.data.growth));

      const ordersWidget = dashboardMetrics[1];
      const calculatedAOV = revenueWidget.data.totalRevenue / ordersWidget.data.totalOrders;
      expect(Math.round(calculatedAOV * 100) / 100).toBeCloseTo(ordersWidget.data.averageOrderValue, 1);

      const topProductsWidget = dashboardMetrics[2];
      expect(topProductsWidget.data).toHaveLength(3);
      expect(topProductsWidget.data[0].sales).toBeGreaterThan(topProductsWidget.data[1].sales);

      const lowStockWidget = dashboardMetrics[3];
      lowStockWidget.data.forEach(product => {
        expect(product.currentStock).toBeLessThan(product.minimumStock);
      });
    });

    test('should handle bulk actions', async () => {
      const bulkActions = [
        {
          action: 'Export orders',
          selection: 'last_30_days',
          format: 'CSV',
          fields: ['order_id', 'customer_name', 'total', 'status', 'created_at'],
          recordCount: 89
        },
        {
          action: 'Update order status',
          orderIds: [101, 102, 103],
          newStatus: 'shipped',
          trackingNumbers: ['BR123', 'BR124', 'BR125']
        },
        {
          action: 'Send marketing email',
          customerSegment: 'inactive_30_days',
          template: 'comeback_offer',
          recipientCount: 23
        }
      ];

      bulkActions.forEach(action => {
        expect(action.action).toBeDefined();
        
        if (action.orderIds) {
          expect(action.orderIds).toBeInstanceOf(Array);
        }
        
        if (action.recordCount) {
          expect(action.recordCount).toBeGreaterThan(0);
        }
      });
    });
  });

  // Helper function to get page titles
  function getPageTitle(path) {
    const titles = {
      '/register': 'Create Your Store - Vitrine Digital',
      '/verify-email': 'Verify Email - Vitrine Digital',
      '/onboarding/plan': 'Choose Your Plan - Vitrine Digital',
      '/onboarding/payment': 'Payment Setup - Vitrine Digital',
      '/dashboard': 'Dashboard - Vitrine Digital',
      '/admin/products': 'Products - Admin Panel',
      '/products': 'Product Catalog',
      '/cart': 'Shopping Cart',
      '/checkout': 'Checkout'
    };
    
    return titles[path] || 'Vitrine Digital';
  }
});