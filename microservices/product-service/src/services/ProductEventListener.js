const { EventSubscriber } = require('../../../shared');

class ProductEventListener {
  constructor(db, logger, productService) {
    this.db = db;
    this.logger = logger;
    this.productService = productService;
    this.eventSubscriber = new EventSubscriber();
    this.setupListeners();
  }

  setupListeners() {
    // Eventos do Bling Service
    this.eventSubscriber.subscribe('bling.product.synced', this.handleBlingProductSynced.bind(this));
    this.eventSubscriber.subscribe('bling.product.updated', this.handleBlingProductUpdated.bind(this));
    this.eventSubscriber.subscribe('bling.stock.updated', this.handleBlingStockUpdated.bind(this));
    
    // Eventos do Order Service  
    this.eventSubscriber.subscribe('order.created', this.handleOrderCreated.bind(this));
    this.eventSubscriber.subscribe('order.cancelled', this.handleOrderCancelled.bind(this));
    this.eventSubscriber.subscribe('order.item.returned', this.handleOrderItemReturned.bind(this));

    // Eventos de Auth Service
    this.eventSubscriber.subscribe('tenant.created', this.handleTenantCreated.bind(this));
    this.eventSubscriber.subscribe('tenant.deleted', this.handleTenantDeleted.bind(this));
  }

  /**
   * Produto sincronizado do Bling
   */
  async handleBlingProductSynced(event) {
    try {
      const { tenantId, blingProductId, productData } = event;

      this.logger.info('Processing Bling product sync', {
        tenantId,
        blingProductId,
        productName: productData.name
      });

      // Verificar se produto já existe
      const existingProduct = await this.db('products')
        .where({ tenant_id: tenantId, bling_id: blingProductId })
        .first();

      if (existingProduct) {
        // Atualizar produto existente
        await this.productService.update(tenantId, existingProduct.id, {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          cost_price: productData.cost_price,
          stock_quantity: productData.stock_quantity,
          images: productData.images || []
        });

        this.logger.info('Product updated from Bling sync', {
          tenantId,
          productId: existingProduct.id,
          blingProductId
        });
      } else {
        // Criar novo produto
        await this.productService.create(tenantId, {
          ...productData,
          bling_id: blingProductId,
          category_id: await this.getOrCreateCategory(tenantId, productData.category_name)
        });

        this.logger.info('Product created from Bling sync', {
          tenantId,
          blingProductId,
          productName: productData.name
        });
      }
    } catch (error) {
      this.logger.error('Failed to process Bling product sync', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Produto atualizado no Bling
   */
  async handleBlingProductUpdated(event) {
    try {
      const { tenantId, blingProductId, changes } = event;

      // Buscar produto local
      const product = await this.db('products')
        .where({ tenant_id: tenantId, bling_id: blingProductId })
        .first();

      if (!product) {
        this.logger.warn('Product not found for Bling update', {
          tenantId,
          blingProductId
        });
        return;
      }

      // Atualizar produto
      await this.productService.update(tenantId, product.id, changes);

      this.logger.info('Product updated from Bling webhook', {
        tenantId,
        productId: product.id,
        blingProductId,
        changes: Object.keys(changes)
      });
    } catch (error) {
      this.logger.error('Failed to process Bling product update', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Estoque atualizado no Bling
   */
  async handleBlingStockUpdated(event) {
    try {
      const { tenantId, blingProductId, newStock, previousStock } = event;

      // Buscar produto local
      const product = await this.db('products')
        .where({ tenant_id: tenantId, bling_id: blingProductId })
        .first();

      if (!product) {
        this.logger.warn('Product not found for Bling stock update', {
          tenantId,
          blingProductId
        });
        return;
      }

      // Atualizar estoque
      await this.productService.updateStock(tenantId, product.id, {
        quantity: newStock,
        type: 'set',
        reason: 'bling_sync',
        reference_id: `bling_${blingProductId}`
      });

      this.logger.info('Stock updated from Bling webhook', {
        tenantId,
        productId: product.id,
        blingProductId,
        previousStock,
        newStock
      });
    } catch (error) {
      this.logger.error('Failed to process Bling stock update', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Pedido criado - decrementar estoque
   */
  async handleOrderCreated(event) {
    try {
      const { tenantId, orderId, items } = event;

      this.logger.info('Processing order created event', {
        tenantId,
        orderId,
        itemsCount: items.length
      });

      // Decrementar estoque para cada item
      for (const item of items) {
        const { product_id, quantity } = item;

        try {
          await this.productService.updateStock(tenantId, product_id, {
            quantity: quantity,
            type: 'subtract',
            reason: 'order_created',
            reference_id: `order_${orderId}`
          });

          this.logger.info('Stock decremented for order', {
            tenantId,
            orderId,
            productId: product_id,
            quantity
          });
        } catch (error) {
          this.logger.error('Failed to decrement stock for order item', {
            tenantId,
            orderId,
            productId: product_id,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to process order created event', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Pedido cancelado - devolver estoque
   */
  async handleOrderCancelled(event) {
    try {
      const { tenantId, orderId, items } = event;

      this.logger.info('Processing order cancelled event', {
        tenantId,
        orderId,
        itemsCount: items.length
      });

      // Devolver estoque para cada item
      for (const item of items) {
        const { product_id, quantity } = item;

        try {
          await this.productService.updateStock(tenantId, product_id, {
            quantity: quantity,
            type: 'add',
            reason: 'order_cancelled',
            reference_id: `order_cancel_${orderId}`
          });

          this.logger.info('Stock restored for cancelled order', {
            tenantId,
            orderId,
            productId: product_id,
            quantity
          });
        } catch (error) {
          this.logger.error('Failed to restore stock for cancelled order item', {
            tenantId,
            orderId,
            productId: product_id,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to process order cancelled event', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Item de pedido devolvido
   */
  async handleOrderItemReturned(event) {
    try {
      const { tenantId, orderId, productId, quantity } = event;

      await this.productService.updateStock(tenantId, productId, {
        quantity: quantity,
        type: 'add',
        reason: 'item_returned',
        reference_id: `return_${orderId}_${productId}`
      });

      this.logger.info('Stock restored for returned item', {
        tenantId,
        orderId,
        productId,
        quantity
      });
    } catch (error) {
      this.logger.error('Failed to process item returned event', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Tenant criado - setup inicial
   */
  async handleTenantCreated(event) {
    try {
      const { tenantId, tenantData } = event;

      // Criar categorias padrão para o novo tenant
      const defaultCategories = [
        { name: 'Geral', description: 'Categoria geral', is_active: true },
        { name: 'Promoções', description: 'Produtos em promoção', is_active: true },
        { name: 'Lançamentos', description: 'Novos produtos', is_active: true }
      ];

      for (const categoryData of defaultCategories) {
        await this.db('categories').insert({
          ...categoryData,
          tenant_id: tenantId
        });
      }

      this.logger.info('Default categories created for new tenant', {
        tenantId,
        categoriesCount: defaultCategories.length
      });
    } catch (error) {
      this.logger.error('Failed to setup tenant products', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Tenant deletado - cleanup
   */
  async handleTenantDeleted(event) {
    try {
      const { tenantId } = event;

      // Remover todos os dados relacionados ao tenant
      const trx = await this.db.transaction();

      try {
        // Remover em ordem (FKs)
        await trx('product_views').where('tenant_id', tenantId).del();
        await trx('search_queries').where('tenant_id', tenantId).del();
        await trx('stock_movements').where('tenant_id', tenantId).del();
        await trx('product_variants').where('tenant_id', tenantId).del();
        await trx('products').where('tenant_id', tenantId).del();
        await trx('categories').where('tenant_id', tenantId).del();

        await trx.commit();

        this.logger.info('Tenant product data cleaned up', { tenantId });
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error('Failed to cleanup tenant product data', {
        error: error.message,
        event
      });
    }
  }

  /**
   * Buscar ou criar categoria por nome
   */
  async getOrCreateCategory(tenantId, categoryName) {
    if (!categoryName) {
      // Retornar categoria "Geral" padrão
      const general = await this.db('categories')
        .where({ tenant_id: tenantId, name: 'Geral' })
        .first();
      return general ? general.id : 1;
    }

    // Buscar categoria existente
    let category = await this.db('categories')
      .where({ tenant_id: tenantId, name: categoryName })
      .first();

    if (!category) {
      // Criar nova categoria
      [category] = await this.db('categories')
        .insert({
          name: categoryName,
          description: `Categoria ${categoryName}`,
          tenant_id: tenantId,
          is_active: true
        })
        .returning('*');
    }

    return category.id;
  }

  /**
   * Iniciar event listener
   */
  async start() {
    try {
      await this.eventSubscriber.connect();
      this.logger.info('Product event listener started');
    } catch (error) {
      this.logger.error('Failed to start product event listener', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parar event listener
   */
  async stop() {
    try {
      await this.eventSubscriber.disconnect();
      this.logger.info('Product event listener stopped');
    } catch (error) {
      this.logger.error('Failed to stop product event listener', {
        error: error.message
      });
    }
  }
}

module.exports = ProductEventListener;