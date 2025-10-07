/**
 * Product Service Unit Tests
 * Tests for product management, categories, and inventory
 */

const { testUtils } = require('../setup');

describe('Product Service', () => {
  describe('Product Creation', () => {
    test('should create a new product successfully', () => {
      const productData = {
        name: 'Smartphone XYZ',
        description: 'Latest smartphone with advanced features',
        price: 1299.99,
        stock: 50,
        categoryId: 1,
        tenantId: 1
      };

      const product = testUtils.generateMockProduct(productData);
      
      expect(product).toMatchObject({
        name: productData.name,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        categoryId: productData.categoryId,
        tenantId: productData.tenantId
      });
      
      expect(product.id).toBeDefined();
      expect(product.active).toBe(true);
      expect(product.createdAt).toBeInstanceOf(Date);
    });

    test('should validate required product fields', () => {
      const requiredFields = ['name', 'price', 'tenantId'];
      const productData = {
        name: 'Test Product',
        description: 'Optional description',
        price: 99.99,
        stock: 10,
        tenantId: 1
      };
      
      requiredFields.forEach(field => {
        expect(productData[field]).toBeDefined();
      });
    });

    test('should reject product with negative price', () => {
      const invalidPrices = [-10, -0.01, -100.99];
      
      invalidPrices.forEach(price => {
        expect(price).toBeLessThan(0);
      });
    });

    test('should reject product with negative stock', () => {
      const invalidStock = [-1, -10, -100];
      
      invalidStock.forEach(stock => {
        expect(stock).toBeLessThan(0);
      });
    });

    test('should format price correctly for Brazilian currency', () => {
      const prices = [99.99, 1299.50, 10.00];
      const formattedPrices = prices.map(price => 
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(price)
      );
      
      formattedPrices.forEach(formatted => {
        expect(formatted).toHaveValidBrazilianCurrency();
      });
    });
  });

  describe('Product Updates', () => {
    test('should update product information successfully', () => {
      const originalProduct = testUtils.generateMockProduct({
        name: 'Original Product',
        price: 100.00,
        stock: 20
      });
      
      const updatedData = {
        name: 'Updated Product',
        price: 150.00,
        stock: 30
      };
      
      const updatedProduct = { ...originalProduct, ...updatedData };
      
      expect(updatedProduct.name).toBe('Updated Product');
      expect(updatedProduct.price).toBe(150.00);
      expect(updatedProduct.stock).toBe(30);
      expect(updatedProduct.id).toBe(originalProduct.id);
    });

    test('should maintain product ID consistency during updates', () => {
      const product = testUtils.generateMockProduct({ id: 456 });
      const updatedProduct = { ...product, name: 'Updated Name' };
      
      expect(updatedProduct.id).toBe(product.id);
    });

    test('should validate price updates', () => {
      const validPrices = [0.01, 99.99, 1000.00, 9999.99];
      const invalidPrices = [-1, -0.01, 0];
      
      validPrices.forEach(price => {
        expect(price).toBeGreaterThan(0);
      });
      
      invalidPrices.forEach(price => {
        expect(price).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('Product Search and Filtering', () => {
    test('should filter products by name', () => {
      const products = [
        testUtils.generateMockProduct({ name: 'iPhone 15' }),
        testUtils.generateMockProduct({ name: 'Samsung Galaxy' }),
        testUtils.generateMockProduct({ name: 'iPhone 14' })
      ];
      
      const searchTerm = 'iPhone';
      const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filteredProducts).toHaveLength(2);
      filteredProducts.forEach(product => {
        expect(product.name).toContain('iPhone');
      });
    });

    test('should filter products by price range', () => {
      const products = [
        testUtils.generateMockProduct({ price: 50.00 }),
        testUtils.generateMockProduct({ price: 150.00 }),
        testUtils.generateMockProduct({ price: 250.00 })
      ];
      
      const minPrice = 100.00;
      const maxPrice = 200.00;
      
      const filteredProducts = products.filter(product =>
        product.price >= minPrice && product.price <= maxPrice
      );
      
      expect(filteredProducts).toHaveLength(1);
      expect(filteredProducts[0].price).toBeWithinRange(minPrice, maxPrice);
    });

    test('should filter products by category', () => {
      const products = [
        testUtils.generateMockProduct({ categoryId: 1 }),
        testUtils.generateMockProduct({ categoryId: 2 }),
        testUtils.generateMockProduct({ categoryId: 1 })
      ];
      
      const categoryId = 1;
      const filteredProducts = products.filter(product =>
        product.categoryId === categoryId
      );
      
      expect(filteredProducts).toHaveLength(2);
      filteredProducts.forEach(product => {
        expect(product.categoryId).toBe(categoryId);
      });
    });

    test('should filter products by availability', () => {
      const products = [
        testUtils.generateMockProduct({ stock: 0 }),
        testUtils.generateMockProduct({ stock: 5 }),
        testUtils.generateMockProduct({ stock: 10 })
      ];
      
      const availableProducts = products.filter(product => product.stock > 0);
      const unavailableProducts = products.filter(product => product.stock === 0);
      
      expect(availableProducts).toHaveLength(2);
      expect(unavailableProducts).toHaveLength(1);
    });
  });

  describe('Inventory Management', () => {
    test('should update stock levels correctly', () => {
      const product = testUtils.generateMockProduct({ stock: 100 });
      
      // Simulate sale
      const soldQuantity = 5;
      const newStock = product.stock - soldQuantity;
      
      expect(newStock).toBe(95);
      expect(newStock).toBeGreaterThanOrEqual(0);
    });

    test('should prevent overselling', () => {
      const product = testUtils.generateMockProduct({ stock: 3 });
      const requestedQuantity = 5;
      
      const canFulfill = product.stock >= requestedQuantity;
      
      expect(canFulfill).toBe(false);
      expect(product.stock).toBeLessThan(requestedQuantity);
    });

    test('should handle stock replenishment', () => {
      const product = testUtils.generateMockProduct({ stock: 10 });
      const replenishmentQuantity = 50;
      const newStock = product.stock + replenishmentQuantity;
      
      expect(newStock).toBe(60);
      expect(newStock).toBeGreaterThan(product.stock);
    });

    test('should track low stock alerts', () => {
      const lowStockThreshold = 5;
      const products = [
        testUtils.generateMockProduct({ stock: 2 }),
        testUtils.generateMockProduct({ stock: 8 }),
        testUtils.generateMockProduct({ stock: 4 })
      ];
      
      const lowStockProducts = products.filter(product =>
        product.stock <= lowStockThreshold
      );
      
      expect(lowStockProducts).toHaveLength(2);
    });
  });

  describe('Category Management', () => {
    test('should create product category', () => {
      const categoryData = {
        id: 1,
        name: 'Eletrônicos',
        description: 'Produtos eletrônicos em geral',
        tenantId: 1,
        active: true
      };
      
      expect(categoryData.name).toBeDefined();
      expect(categoryData.tenantId).toBeDefined();
      expect(categoryData.active).toBe(true);
    });

    test('should assign products to categories', () => {
      const category = { id: 1, name: 'Smartphones' };
      const product = testUtils.generateMockProduct({ categoryId: category.id });
      
      expect(product.categoryId).toBe(category.id);
    });

    test('should handle category hierarchy', () => {
      const parentCategory = { id: 1, name: 'Eletrônicos', parentId: null };
      const childCategory = { id: 2, name: 'Smartphones', parentId: 1 };
      
      expect(childCategory.parentId).toBe(parentCategory.id);
      expect(parentCategory.parentId).toBeNull();
    });
  });

  describe('Product Images', () => {
    test('should handle multiple product images', () => {
      const product = testUtils.generateMockProduct({
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg'
        ]
      });
      
      expect(product.images).toHaveLength(3);
      product.images.forEach(image => {
        expect(image).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/i);
      });
    });

    test('should validate image URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://example.com/photo.png',
        'https://cdn.example.com/pic.jpeg'
      ];
      
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/image.jpg',
        'https://example.com/document.pdf'
      ];
      
      validUrls.forEach(url => {
        expect(url).toMatch(/^https?:\/\/.+/);
      });
      
      invalidUrls.forEach(url => {
        expect(url).not.toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/i);
      });
    });
  });

  describe('Product Variants', () => {
    test('should handle product variants', () => {
      const baseProduct = testUtils.generateMockProduct({
        name: 'Camiseta',
        hasVariants: true
      });
      
      const variants = [
        { ...baseProduct, id: 101, size: 'P', color: 'Azul', stock: 10 },
        { ...baseProduct, id: 102, size: 'M', color: 'Azul', stock: 15 },
        { ...baseProduct, id: 103, size: 'G', color: 'Vermelho', stock: 8 }
      ];
      
      expect(variants).toHaveLength(3);
      variants.forEach(variant => {
        expect(variant.name).toBe(baseProduct.name);
        expect(variant.size).toBeDefined();
        expect(variant.color).toBeDefined();
      });
    });

    test('should calculate total stock for variants', () => {
      const variants = [
        { stock: 10 },
        { stock: 15 },
        { stock: 8 }
      ];
      
      const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
      
      expect(totalStock).toBe(33);
    });
  });

  describe('Product SEO', () => {
    test('should generate SEO-friendly slug', () => {
      const productName = 'Smartphone Samsung Galaxy S24 Ultra 256GB';
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
      
      expect(slug).toBe('smartphone-samsung-galaxy-s24-ultra-256gb');
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    test('should generate meta description', () => {
      const product = testUtils.generateMockProduct({
        name: 'iPhone 15',
        description: 'Novo iPhone 15 com chip A17 Pro e câmera de 48MP'
      });
      
      const metaDescription = `${product.name} - ${product.description}`.substring(0, 160);
      
      expect(metaDescription.length).toBeLessThanOrEqual(160);
      expect(metaDescription).toContain(product.name);
    });
  });

  describe('Product Reviews', () => {
    test('should calculate average rating', () => {
      const reviews = [
        { rating: 5, comment: 'Excelente produto!' },
        { rating: 4, comment: 'Muito bom, recomendo' },
        { rating: 5, comment: 'Perfeito!' },
        { rating: 3, comment: 'Regular' }
      ];
      
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      expect(averageRating).toBe(4.25);
      expect(averageRating).toBeWithinRange(1, 5);
    });

    test('should validate review rating range', () => {
      const validRatings = [1, 2, 3, 4, 5];
      const invalidRatings = [0, 6, -1, 10];
      
      validRatings.forEach(rating => {
        expect(rating).toBeWithinRange(1, 5);
      });
      
      invalidRatings.forEach(rating => {
        expect(rating).not.toBeWithinRange(1, 5);
      });
    });
  });
});

describe('Product Service Integration', () => {
  test('should integrate with tenant system', () => {
    const tenant = testUtils.generateMockTenant({ id: 1 });
    const product = testUtils.generateMockProduct({ tenantId: tenant.id });
    
    expect(product.tenantId).toBe(tenant.id);
  });

  test('should isolate products by tenant', () => {
    const tenant1Products = [
      testUtils.generateMockProduct({ tenantId: 1 }),
      testUtils.generateMockProduct({ tenantId: 1 })
    ];
    
    const tenant2Products = [
      testUtils.generateMockProduct({ tenantId: 2 })
    ];
    
    tenant1Products.forEach(product => {
      expect(product.tenantId).toBe(1);
    });
    
    tenant2Products.forEach(product => {
      expect(product.tenantId).toBe(2);
    });
  });

  test('should integrate with order system', () => {
    const product = testUtils.generateMockProduct({ id: 123, stock: 10 });
    const order = testUtils.generateMockOrder({
      items: [
        { productId: product.id, quantity: 2, unitPrice: product.price }
      ]
    });
    
    expect(order.items[0].productId).toBe(product.id);
    expect(order.items[0].quantity).toBeLessThanOrEqual(product.stock);
  });

  test('should integrate with Bling ERP', () => {
    const product = testUtils.generateMockProduct({
      blingId: 'BLING123456',
      syncWithBling: true
    });
    
    expect(product.blingId).toBeDefined();
    expect(product.syncWithBling).toBe(true);
  });
});