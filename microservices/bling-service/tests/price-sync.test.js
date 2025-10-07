const BlingPriceSyncService = require('../src/services/BlingPriceSyncService');
const { EventPublisher } = require('../../shared');

describe('BlingPriceSyncService', () => {
  let priceSyncService;
  let mockDatabase;
  let mockBlingService;
  let mockEventPublisher;

  beforeEach(() => {
    // Mock database
    mockDatabase = {
      schema: {
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: jest.fn().mockImplementation((name, callback) => {
          const mockTable = {
            increments: jest.fn().mockReturnThis(),
            primary: jest.fn().mockReturnThis(),
            integer: jest.fn().mockReturnThis(),
            string: jest.fn().mockReturnThis(),
            decimal: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            timestamps: jest.fn().mockReturnThis(),
            notNullable: jest.fn().mockReturnThis(),
            nullable: jest.fn().mockReturnThis(),
            defaultTo: jest.fn().mockReturnThis(),
            index: jest.fn().mockReturnThis()
          };
          callback(mockTable);
          return Promise.resolve();
        })
      },
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      first: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    };

    // Mock Bling Service
    mockBlingService = {
      makeApiRequest: jest.fn()
    };

    // Mock Event Publisher
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue()
    };

    // Initialize service
    priceSyncService = new BlingPriceSyncService(
      mockDatabase,
      mockBlingService,
      mockEventPublisher
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (priceSyncService.syncInterval) {
      clearInterval(priceSyncService.syncInterval);
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await priceSyncService.initialize();
      
      expect(result).toBe(true);
      expect(mockDatabase.schema.hasTable).toHaveBeenCalledWith('bling_price_history');
      expect(mockDatabase.schema.createTable).toHaveBeenCalled();
    });

    it('should not create table if it already exists', async () => {
      mockDatabase.schema.hasTable.mockResolvedValue(true);
      
      await priceSyncService.initialize();
      
      expect(mockDatabase.schema.createTable).not.toHaveBeenCalled();
    });
  });

  describe('periodic sync', () => {
    it('should start periodic sync', () => {
      priceSyncService.startPeriodicSync();
      
      expect(priceSyncService.state.isRunning).toBe(true);
      expect(priceSyncService.syncInterval).toBeDefined();
    });

    it('should stop periodic sync', () => {
      priceSyncService.startPeriodicSync();
      priceSyncService.stopPeriodicSync();
      
      expect(priceSyncService.state.isRunning).toBe(false);
      expect(priceSyncService.syncInterval).toBeNull();
    });

    it('should not start if already running', () => {
      priceSyncService.startPeriodicSync();
      const firstInterval = priceSyncService.syncInterval;
      
      priceSyncService.startPeriodicSync();
      
      expect(priceSyncService.syncInterval).toBe(firstInterval);
    });
  });

  describe('price extraction', () => {
    it('should extract price from preco.valor', () => {
      const blingProduct = {
        preco: { valor: '99.99' }
      };
      
      const price = priceSyncService.extractProductPrice(blingProduct);
      
      expect(price).toBe(99.99);
    });

    it('should extract price from precoVenda', () => {
      const blingProduct = {
        precoVenda: '149.50'
      };
      
      const price = priceSyncService.extractProductPrice(blingProduct);
      
      expect(price).toBe(149.50);
    });

    it('should extract price from valor', () => {
      const blingProduct = {
        valor: '29.99'
      };
      
      const price = priceSyncService.extractProductPrice(blingProduct);
      
      expect(price).toBe(29.99);
    });

    it('should return null if no price found', () => {
      const blingProduct = {
        nome: 'Product without price'
      };
      
      const price = priceSyncService.extractProductPrice(blingProduct);
      
      expect(price).toBeNull();
    });
  });

  describe('price change detection', () => {
    it('should detect significant price change', () => {
      const oldPrice = 100.00;
      const newPrice = 102.00; // 2% change
      
      const hasChanged = priceSyncService.hasPriceChanged(oldPrice, newPrice);
      
      expect(hasChanged).toBe(true);
    });

    it('should not detect insignificant price change', () => {
      const oldPrice = 100.00;
      const newPrice = 100.50; // 0.5% change
      
      const hasChanged = priceSyncService.hasPriceChanged(oldPrice, newPrice);
      
      expect(hasChanged).toBe(false);
    });

    it('should detect change when old price is null', () => {
      const oldPrice = null;
      const newPrice = 100.00;
      
      const hasChanged = priceSyncService.hasPriceChanged(oldPrice, newPrice);
      
      expect(hasChanged).toBe(true);
    });
  });

  describe('tenant price sync', () => {
    beforeEach(() => {
      mockDatabase.where.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({
            tenant_id: 1,
            access_token: 'token',
            refresh_token: 'refresh'
          })
        })
      });
    });

    it('should sync prices for tenant', async () => {
      const mockProducts = [
        {
          id: '123',
          codigo: 'SKU001',
          nome: 'Product 1',
          preco: { valor: '99.99' }
        }
      ];

      mockBlingService.makeApiRequest.mockResolvedValue({
        data: { data: mockProducts }
      });

      mockDatabase.first.mockResolvedValue({
        id: 1,
        sku: 'SKU001',
        price: 89.99
      });

      await priceSyncService.syncTenantPrices(1);
      
      expect(mockBlingService.makeApiRequest).toHaveBeenCalled();
      expect(priceSyncService.state.processedCount).toBe(1);
    });

    it('should handle tenant without connection', async () => {
      mockDatabase.where.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null)
        })
      });

      await expect(priceSyncService.syncTenantPrices(1)).resolves.not.toThrow();
    });
  });

  describe('webhook price update', () => {
    it('should process webhook price update', async () => {
      const webhookData = {
        tenantId: 1,
        productId: '123',
        newPrice: 99.99
      };

      mockDatabase.where.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({
            id: 1,
            sku: 'SKU001',
            price: 89.99
          })
        })
      });

      await priceSyncService.handleWebhookPriceUpdate(webhookData);
      
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'product.price.updated',
        expect.objectContaining({
          tenant_id: 1,
          product_id: 1,
          old_price: 89.99,
          new_price: 99.99
        })
      );
    });

    it('should handle invalid webhook data', async () => {
      const webhookData = {
        tenantId: 1
        // Missing productId and newPrice
      };

      await expect(priceSyncService.handleWebhookPriceUpdate(webhookData)).resolves.not.toThrow();
    });
  });

  describe('price history', () => {
    it('should get price history for product', async () => {
      const mockHistory = [
        {
          id: 1,
          bling_product_id: '123',
          old_price: 89.99,
          new_price: 99.99,
          created_at: new Date()
        }
      ];

      mockDatabase.select.mockResolvedValue(mockHistory);

      const history = await priceSyncService.getPriceHistory(1, '123', 10);
      
      expect(history).toEqual(mockHistory);
      expect(mockDatabase.where).toHaveBeenCalledWith('tenant_id', 1);
      expect(mockDatabase.where).toHaveBeenCalledWith('bling_product_id', '123');
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      const stats = priceSyncService.getStats();
      
      expect(stats).toHaveProperty('totalSyncs');
      expect(stats).toHaveProperty('totalPriceUpdates');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('current_state');
      expect(stats).toHaveProperty('config');
    });
  });

  describe('utility functions', () => {
    it('should chunk array correctly', () => {
      const array = [1, 2, 3, 4, 5];
      const chunks = priceSyncService.chunkArray(array, 2);
      
      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should cleanup old price history', async () => {
      mockDatabase.where.mockReturnValue({
        del: jest.fn().mockResolvedValue(5)
      });

      const deleted = await priceSyncService.cleanupOldPriceHistory(30);
      
      expect(deleted).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockBlingService.makeApiRequest.mockRejectedValue(new Error('API Error'));
      
      mockDatabase.where.mockReturnValue({
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({
            tenant_id: 1,
            access_token: 'token'
          })
        })
      });

      await expect(priceSyncService.syncTenantPrices(1)).rejects.toThrow('API Error');
    });

    it('should handle database errors in price update', async () => {
      mockDatabase.where.mockRejectedValue(new Error('Database Error'));

      const blingProduct = {
        id: '123',
        nome: 'Product 1',
        preco: { valor: '99.99' }
      };

      await expect(
        priceSyncService.processSingleProductPrice(1, blingProduct)
      ).rejects.toThrow();
    });
  });
});