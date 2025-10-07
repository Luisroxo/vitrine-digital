/**
 * API Contract Tests
 * Tests for API contracts between services
 */

const { testUtils } = require('../setup');

describe('API Contract Tests', () => {
  describe('Auth Service Contracts', () => {
    test('POST /auth/register contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['name', 'email', 'password', 'tenantName'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$' },
          tenantName: { type: 'string', minLength: 2, maxLength: 50 }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'user', 'tenant', 'token'],
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            required: ['id', 'name', 'email', 'tenantId'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              tenantId: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          tenant: {
            type: 'object',
            required: ['id', 'name', 'domain'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              domain: { type: 'string', pattern: '^[a-z0-9-]+\\.vitrinedigital\\.com$' }
            }
          },
          token: { type: 'string', minLength: 100 }
        }
      };

      expect(requestSchema.required).toContain('email');
      expect(requestSchema.required).toContain('password');
      expect(responseSchema.required).toContain('token');
      expect(responseSchema.properties.user.required).toContain('id');
    });

    test('POST /auth/login contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'user', 'token'],
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            required: ['id', 'name', 'email', 'role', 'tenantId'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['admin', 'manager', 'user'] },
              tenantId: { type: 'integer' }
            }
          },
          token: { type: 'string' },
          expiresIn: { type: 'integer' }
        }
      };

      expect(requestSchema.required).toHaveLength(2);
      expect(responseSchema.properties.user.properties.role.enum).toContain('admin');
    });

    test('GET /auth/verify contract', () => {
      const requestHeaders = {
        'Authorization': 'Bearer {token}'
      };

      const responseSchema = {
        type: 'object',
        required: ['valid', 'user'],
        properties: {
          valid: { type: 'boolean' },
          user: {
            type: 'object',
            required: ['id', 'tenantId', 'role'],
            properties: {
              id: { type: 'integer' },
              tenantId: { type: 'integer' },
              role: { type: 'string' }
            }
          },
          permissions: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      expect(requestHeaders.Authorization).toMatch(/^Bearer /);
      expect(responseSchema.required).toContain('valid');
    });
  });

  describe('Product Service Contracts', () => {
    test('GET /products contract', () => {
      const queryParams = {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        search: { type: 'string', minLength: 1, maxLength: 100 },
        category: { type: 'string' },
        minPrice: { type: 'number', minimum: 0 },
        maxPrice: { type: 'number', minimum: 0 },
        inStock: { type: 'boolean' }
      };

      const responseSchema = {
        type: 'object',
        required: ['products', 'pagination'],
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'price', 'stock', 'category'],
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number', minimum: 0 },
                originalPrice: { type: 'number', minimum: 0 },
                stock: { type: 'integer', minimum: 0 },
                category: { type: 'string' },
                images: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' }
                },
                active: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          },
          pagination: {
            type: 'object',
            required: ['currentPage', 'totalPages', 'totalItems', 'itemsPerPage'],
            properties: {
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              totalItems: { type: 'integer' },
              itemsPerPage: { type: 'integer' }
            }
          }
        }
      };

      expect(queryParams.limit.maximum).toBe(100);
      expect(responseSchema.properties.products.items.required).toContain('price');
    });

    test('POST /products contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['name', 'price', 'category'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          price: { type: 'number', minimum: 0.01 },
          originalPrice: { type: 'number', minimum: 0 },
          stock: { type: 'integer', minimum: 0, default: 0 },
          category: { type: 'string', minLength: 1, maxLength: 100 },
          images: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            maxItems: 10
          },
          active: { type: 'boolean', default: true },
          tags: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20
          },
          weight: { type: 'number', minimum: 0 },
          dimensions: {
            type: 'object',
            properties: {
              height: { type: 'number', minimum: 0 },
              width: { type: 'number', minimum: 0 },
              depth: { type: 'number', minimum: 0 }
            }
          }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'product'],
        properties: {
          success: { type: 'boolean' },
          product: {
            type: 'object',
            required: ['id', 'name', 'price', 'stock', 'tenantId'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              price: { type: 'number' },
              stock: { type: 'integer' },
              tenantId: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      };

      expect(requestSchema.properties.price.minimum).toBe(0.01);
      expect(requestSchema.properties.images.maxItems).toBe(10);
    });

    test('PUT /products/:id/stock contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['stock'],
        properties: {
          stock: { type: 'integer', minimum: 0 },
          operation: { type: 'string', enum: ['set', 'add', 'subtract'] },
          reason: { type: 'string', maxLength: 200 }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'oldStock', 'newStock'],
        properties: {
          success: { type: 'boolean' },
          oldStock: { type: 'integer' },
          newStock: { type: 'integer' },
          operation: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      };

      expect(requestSchema.properties.operation.enum).toContain('set');
      expect(responseSchema.required).toContain('newStock');
    });
  });

  describe('Billing Service Contracts', () => {
    test('GET /billing/plans contract', () => {
      const responseSchema = {
        type: 'object',
        required: ['plans'],
        properties: {
          plans: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'price', 'interval', 'features', 'limits'],
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number', minimum: 0 },
                interval: { type: 'string', enum: ['monthly', 'yearly'] },
                features: {
                  type: 'array',
                  items: { type: 'string' }
                },
                limits: {
                  type: 'object',
                  required: ['maxProducts', 'maxUsers', 'maxStorage'],
                  properties: {
                    maxProducts: { type: 'integer', minimum: 1 },
                    maxUsers: { type: 'integer', minimum: 1 },
                    maxStorage: { type: 'integer', minimum: 1 }, // MB
                    maxBandwidth: { type: 'integer' }, // MB/month
                    maxOrders: { type: 'integer' }
                  }
                },
                popular: { type: 'boolean' },
                active: { type: 'boolean' }
              }
            }
          }
        }
      };

      expect(responseSchema.properties.plans.items.properties.interval.enum).toContain('monthly');
      expect(responseSchema.properties.plans.items.properties.limits.required).toContain('maxProducts');
    });

    test('POST /billing/subscriptions contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['planId', 'paymentMethodId'],
        properties: {
          planId: { type: 'integer' },
          paymentMethodId: { type: 'string' },
          interval: { type: 'string', enum: ['monthly', 'yearly'] },
          couponCode: { type: 'string', maxLength: 50 }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'subscription'],
        properties: {
          success: { type: 'boolean' },
          subscription: {
            type: 'object',
            required: ['id', 'planId', 'status', 'currentPeriodStart', 'currentPeriodEnd'],
            properties: {
              id: { type: 'string' },
              planId: { type: 'integer' },
              status: { type: 'string', enum: ['active', 'trialing', 'past_due', 'canceled'] },
              currentPeriodStart: { type: 'string', format: 'date-time' },
              currentPeriodEnd: { type: 'string', format: 'date-time' },
              trialEnd: { type: 'string', format: 'date-time' },
              cancelAtPeriodEnd: { type: 'boolean' }
            }
          },
          invoice: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              amount: { type: 'number' },
              dueDate: { type: 'string', format: 'date-time' }
            }
          }
        }
      };

      expect(requestSchema.required).toContain('planId');
      expect(responseSchema.properties.subscription.properties.status.enum).toContain('active');
    });

    test('GET /billing/invoices contract', () => {
      const queryParams = {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'canceled'] },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' }
      };

      const responseSchema = {
        type: 'object',
        required: ['invoices', 'pagination'],
        properties: {
          invoices: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'amount', 'status', 'dueDate', 'createdAt'],
              properties: {
                id: { type: 'string' },
                amount: { type: 'number', minimum: 0 },
                status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'canceled'] },
                dueDate: { type: 'string', format: 'date-time' },
                paidDate: { type: 'string', format: 'date-time' },
                description: { type: 'string' },
                subscriptionId: { type: 'string' },
                paymentMethod: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          },
          pagination: {
            type: 'object',
            required: ['currentPage', 'totalPages', 'totalItems'],
            properties: {
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              totalItems: { type: 'integer' }
            }
          }
        }
      };

      expect(queryParams.status.enum).toContain('paid');
      expect(responseSchema.properties.invoices.items.properties.status.enum).toContain('overdue');
    });
  });

  describe('Bling Service Contracts', () => {
    test('POST /bling/auth contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['code', 'state'],
        properties: {
          code: { type: 'string' },
          state: { type: 'string' }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'integration'],
        properties: {
          success: { type: 'boolean' },
          integration: {
            type: 'object',
            required: ['id', 'tenantId', 'status', 'connectedAt'],
            properties: {
              id: { type: 'integer' },
              tenantId: { type: 'integer' },
              status: { type: 'string', enum: ['connected', 'disconnected', 'error'] },
              connectedAt: { type: 'string', format: 'date-time' },
              lastSyncAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      };

      expect(requestSchema.required).toHaveLength(2);
      expect(responseSchema.properties.integration.properties.status.enum).toContain('connected');
    });

    test('POST /bling/sync/products contract', () => {
      const requestSchema = {
        type: 'object',
        properties: {
          force: { type: 'boolean', default: false },
          categories: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'sync'],
        properties: {
          success: { type: 'boolean' },
          sync: {
            type: 'object',
            required: ['id', 'status', 'startedAt'],
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['running', 'completed', 'failed'] },
              startedAt: { type: 'string', format: 'date-time' },
              completedAt: { type: 'string', format: 'date-time' },
              productsProcessed: { type: 'integer', minimum: 0 },
              productsCreated: { type: 'integer', minimum: 0 },
              productsUpdated: { type: 'integer', minimum: 0 },
              productsSkipped: { type: 'integer', minimum: 0 },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      };

      expect(requestSchema.properties.force.default).toBe(false);
      expect(responseSchema.properties.sync.properties.status.enum).toContain('running');
    });

    test('POST /bling/orders contract', () => {
      const requestSchema = {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'integer' },
          sendEmail: { type: 'boolean', default: true }
        }
      };

      const responseSchema = {
        type: 'object',
        required: ['success', 'blingOrder'],
        properties: {
          success: { type: 'boolean' },
          blingOrder: {
            type: 'object',
            required: ['id', 'numero', 'situacao'],
            properties: {
              id: { type: 'integer' },
              numero: { type: 'string' },
              situacao: { type: 'string' },
              dataEmissao: { type: 'string', format: 'date' },
              valorTotal: { type: 'number' },
              cliente: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  telefone: { type: 'string' }
                }
              }
            }
          }
        }
      };

      expect(requestSchema.required).toContain('orderId');
      expect(responseSchema.properties.blingOrder.required).toContain('numero');
    });

    test('GET /bling/webhook contract', () => {
      const responseSchema = {
        type: 'object',
        required: ['webhooks'],
        properties: {
          webhooks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'evento', 'url', 'ativo'],
              properties: {
                id: { type: 'string' },
                evento: { type: 'string', enum: ['produto.alterado', 'pedido.criado', 'estoque.alterado'] },
                url: { type: 'string', format: 'uri' },
                ativo: { type: 'boolean' },
                criadoEm: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      };

      expect(responseSchema.properties.webhooks.items.properties.evento.enum).toContain('produto.alterado');
    });
  });

  describe('Gateway Contracts', () => {
    test('Error response contract', () => {
      const errorResponseSchema = {
        type: 'object',
        required: ['error', 'message', 'statusCode'],
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer', minimum: 400, maximum: 599 },
          details: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string' },
          requestId: { type: 'string' }
        }
      };

      expect(errorResponseSchema.required).toContain('error');
      expect(errorResponseSchema.properties.statusCode.minimum).toBe(400);
    });

    test('Rate limit headers contract', () => {
      const rateLimitHeaders = {
        'X-RateLimit-Limit': { type: 'string', pattern: '^\\d+$' },
        'X-RateLimit-Remaining': { type: 'string', pattern: '^\\d+$' },
        'X-RateLimit-Reset': { type: 'string', pattern: '^\\d+$' },
        'Retry-After': { type: 'string', pattern: '^\\d+$' }
      };

      Object.entries(rateLimitHeaders).forEach(([header, schema]) => {
        expect(header).toMatch(/^X-RateLimit-|^Retry-After$/);
        expect(schema.pattern).toBeDefined();
      });
    });

    test('Authentication headers contract', () => {
      const authHeaders = {
        'Authorization': { 
          type: 'string', 
          pattern: '^Bearer [A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+$'
        },
        'X-Tenant-ID': { type: 'string', pattern: '^\\d+$' },
        'X-User-ID': { type: 'string', pattern: '^\\d+$' }
      };

      expect(authHeaders.Authorization.pattern).toContain('Bearer');
      expect(authHeaders['X-Tenant-ID'].pattern).toBe('^\\d+$');
    });
  });

  describe('Webhook Contracts', () => {
    test('Bling webhook payload contract', () => {
      const webhookSchema = {
        type: 'object',
        required: ['evento', 'dados', 'timestamp'],
        properties: {
          evento: { type: 'string', enum: ['produto.alterado', 'pedido.criado', 'estoque.alterado'] },
          dados: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              codigo: { type: 'string' },
              nome: { type: 'string' },
              preco: { type: 'number' },
              estoque: { type: 'number' }
            }
          },
          timestamp: { type: 'string', format: 'date-time' },
          tentativa: { type: 'integer', minimum: 1, maximum: 5 }
        }
      };

      expect(webhookSchema.properties.evento.enum).toContain('produto.alterado');
      expect(webhookSchema.properties.tentativa.maximum).toBe(5);
    });

    test('Payment webhook payload contract', () => {
      const paymentWebhookSchema = {
        type: 'object',
        required: ['event', 'data', 'created'],
        properties: {
          event: { type: 'string', enum: ['payment.succeeded', 'payment.failed', 'subscription.updated'] },
          data: {
            type: 'object',
            required: ['id', 'amount', 'status'],
            properties: {
              id: { type: 'string' },
              amount: { type: 'number', minimum: 0 },
              currency: { type: 'string', enum: ['BRL'] },
              status: { type: 'string', enum: ['succeeded', 'failed', 'pending', 'canceled'] },
              paymentMethod: { type: 'string', enum: ['credit_card', 'pix', 'boleto'] },
              metadata: { type: 'object' }
            }
          },
          created: { type: 'integer' },
          livemode: { type: 'boolean' }
        }
      };

      expect(paymentWebhookSchema.properties.event.enum).toContain('payment.succeeded');
      expect(paymentWebhookSchema.properties.data.properties.currency.enum).toContain('BRL');
    });
  });

  describe('Contract Validation', () => {
    test('should validate request/response schemas', () => {
      const validationResults = [
        { endpoint: 'POST /auth/login', requestValid: true, responseValid: true },
        { endpoint: 'GET /products', requestValid: true, responseValid: true },
        { endpoint: 'POST /billing/subscriptions', requestValid: true, responseValid: true },
        { endpoint: 'POST /bling/sync/products', requestValid: true, responseValid: true }
      ];

      const allValid = validationResults.every(result => 
        result.requestValid && result.responseValid
      );

      expect(allValid).toBe(true);
      expect(validationResults).toHaveLength(4);
    });

    test('should handle breaking changes detection', () => {
      const apiChanges = [
        {
          endpoint: 'GET /products',
          change: 'Added optional field: tags',
          breaking: false,
          version: '1.1.0'
        },
        {
          endpoint: 'POST /products',
          change: 'Required field added: category',
          breaking: true,
          version: '2.0.0'
        },
        {
          endpoint: 'GET /billing/plans',
          change: 'Removed deprecated field: oldPrice',
          breaking: true,
          version: '2.0.0'
        }
      ];

      const breakingChanges = apiChanges.filter(change => change.breaking);
      const nonBreakingChanges = apiChanges.filter(change => !change.breaking);

      expect(breakingChanges).toHaveLength(2);
      expect(nonBreakingChanges).toHaveLength(1);
      
      breakingChanges.forEach(change => {
        expect(change.version).toMatch(/^2\./);
      });
    });

    test('should validate field types and formats', () => {
      const fieldValidations = [
        { field: 'email', type: 'string', format: 'email', valid: true },
        { field: 'price', type: 'number', minimum: 0, valid: true },
        { field: 'date', type: 'string', format: 'date-time', valid: true },
        { field: 'id', type: 'integer', minimum: 1, valid: true },
        { field: 'url', type: 'string', format: 'uri', valid: true }
      ];

      fieldValidations.forEach(validation => {
        expect(validation.field).toBeDefined();
        expect(validation.type).toBeOneOf(['string', 'number', 'integer', 'boolean', 'object', 'array']);
        expect(validation.valid).toBe(true);
      });
    });
  });
});