const { ValidationSchemas } = require('../../../shared');
const Joi = ValidationSchemas.Joi;

class ProductService {
  constructor(db, logger, eventPublisher) {
    this.db = db;
    this.logger = logger;
    this.eventPublisher = eventPublisher;
  }

  // Validation schemas
  static schemas = {
    create: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      description: Joi.string().max(5000).allow(''),
      short_description: Joi.string().max(500).allow(''),
      category_id: Joi.number().integer().min(1).required(),
      sku: Joi.string().max(100).allow(null),
      bling_id: Joi.string().max(50).allow(null),
      price: Joi.number().min(0).required(),
      compare_price: Joi.number().min(0).allow(null),
      cost_price: Joi.number().min(0).allow(null),
      weight: Joi.number().min(0).allow(null),
      dimensions: Joi.object({
        length: Joi.number().min(0),
        width: Joi.number().min(0),
        height: Joi.number().min(0)
      }).allow(null),
      stock_quantity: Joi.number().integer().min(0).default(0),
      min_stock: Joi.number().integer().min(0).default(0),
      manage_stock: Joi.boolean().default(true),
      is_active: Joi.boolean().default(true),
      is_featured: Joi.boolean().default(false),
      images: Joi.array().items(Joi.string().uri()).max(10).default([]),
      tags: Joi.array().items(Joi.string().max(50)).max(20).default([]),
      seo: Joi.object({
        title: Joi.string().max(200),
        description: Joi.string().max(300),
        keywords: Joi.array().items(Joi.string().max(50))
      }).allow(null),
      metadata: Joi.object().allow(null)
    }),

    update: Joi.object({
      name: Joi.string().min(1).max(200),
      description: Joi.string().max(5000).allow(''),
      short_description: Joi.string().max(500).allow(''),
      category_id: Joi.number().integer().min(1),
      sku: Joi.string().max(100).allow(null),
      bling_id: Joi.string().max(50).allow(null),
      price: Joi.number().min(0),
      compare_price: Joi.number().min(0).allow(null),
      cost_price: Joi.number().min(0).allow(null),
      weight: Joi.number().min(0).allow(null),
      dimensions: Joi.object({
        length: Joi.number().min(0),
        width: Joi.number().min(0),
        height: Joi.number().min(0)
      }).allow(null),
      stock_quantity: Joi.number().integer().min(0),
      min_stock: Joi.number().integer().min(0),
      manage_stock: Joi.boolean(),
      is_active: Joi.boolean(),
      is_featured: Joi.boolean(),
      images: Joi.array().items(Joi.string().uri()).max(10),
      tags: Joi.array().items(Joi.string().max(50)).max(20),
      seo: Joi.object({
        title: Joi.string().max(200),
        description: Joi.string().max(300),
        keywords: Joi.array().items(Joi.string().max(50))
      }).allow(null),
      metadata: Joi.object().allow(null)
    }).min(1),

    query: Joi.object({
      category_id: Joi.number().integer().min(1),
      is_active: Joi.boolean(),
      is_featured: Joi.boolean(),
      manage_stock: Joi.boolean(),
      min_price: Joi.number().min(0),
      max_price: Joi.number().min(0),
      search: Joi.string().max(100),
      tags: Joi.array().items(Joi.string().max(50)),
      low_stock: Joi.boolean(), // Produtos com estoque baixo
      out_of_stock: Joi.boolean(), // Produtos sem estoque
      sort_by: Joi.string().valid('name', 'price', 'created_at', 'updated_at', 'stock_quantity').default('created_at'),
      sort_order: Joi.string().valid('asc', 'desc').default('desc'),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    }),

    stockUpdate: Joi.object({
      quantity: Joi.number().integer().required(),
      type: Joi.string().valid('set', 'add', 'subtract').default('set'),
      reason: Joi.string().max(100).default('manual'),
      reference_id: Joi.string().max(50).allow(null)
    })
  };

  async create(tenantId, productData) {
    // Validar dados
    const { error, value } = ProductService.schemas.create.validate(productData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid product data',
        details: error.details
      };
    }

    // Verificar se categoria existe
    const category = await this.db('categories')
      .where({ id: value.category_id, tenant_id: tenantId, is_active: true })
      .first();
    
    if (!category) {
      throw {
        type: 'validation',
        message: 'Category not found or inactive'
      };
    }

    // Verificar SKU único (se fornecido)
    if (value.sku) {
      const existing = await this.db('products')
        .where({ tenant_id: tenantId, sku: value.sku })
        .first();

      if (existing) {
        throw {
          type: 'validation',
          message: 'SKU already exists'
        };
      }
    }

    // Verificar Bling ID único (se fornecido)
    if (value.bling_id) {
      const existing = await this.db('products')
        .where({ tenant_id: tenantId, bling_id: value.bling_id })
        .first();

      if (existing) {
        throw {
          type: 'validation',
          message: 'Bling ID already exists'
        };
      }
    }

    const trx = await this.db.transaction();
    
    try {
      // Criar produto
      const [product] = await trx('products')
        .insert({
          ...value,
          tenant_id: tenantId,
          images: JSON.stringify(value.images),
          tags: JSON.stringify(value.tags),
          seo: value.seo ? JSON.stringify(value.seo) : null,
          dimensions: value.dimensions ? JSON.stringify(value.dimensions) : null,
          metadata: value.metadata ? JSON.stringify(value.metadata) : null
        })
        .returning('*');

      // Registrar movimento de estoque inicial (se quantidade > 0)
      if (value.stock_quantity > 0) {
        await trx('stock_movements').insert({
          product_id: product.id,
          tenant_id: tenantId,
          type: 'in',
          quantity: value.stock_quantity,
          previous_stock: 0,
          new_stock: value.stock_quantity,
          reason: 'initial',
          metadata: JSON.stringify({ source: 'product_creation' })
        });
      }

      await trx.commit();

      // Converter campos JSON de volta
      const productWithParsedFields = this.parseProductFields(product);

      // Publicar evento
      await this.eventPublisher.publish('product.created', {
        tenantId,
        productId: product.id,
        product: productWithParsedFields
      });

      this.logger.info('Product created', {
        tenantId,
        productId: product.id,
        name: product.name,
        sku: product.sku
      });

      return productWithParsedFields;
    } catch (error) {
      await trx.rollback();
      this.logger.error('Error creating product', {
        tenantId,
        error: error.message,
        productData: value
      });
      throw error;
    }
  }

  async findById(tenantId, productId) {
    const product = await this.db('products')
      .select('products.*', 'categories.name as category_name')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where({
        'products.id': productId,
        'products.tenant_id': tenantId
      })
      .first();

    if (!product) {
      throw {
        type: 'not_found',
        message: 'Product not found'
      };
    }

    return this.parseProductFields(product);
  }

  async findAll(tenantId, filters = {}) {
    // Validar filtros
    const { error, value } = ProductService.schemas.query.validate(filters);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid query parameters',
        details: error.details
      };
    }

    let query = this.db('products')
      .select('products.*', 'categories.name as category_name')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.tenant_id', tenantId);

    // Aplicar filtros
    if (value.category_id) {
      query = query.where('products.category_id', value.category_id);
    }

    if (value.is_active !== undefined) {
      query = query.where('products.is_active', value.is_active);
    }

    if (value.is_featured !== undefined) {
      query = query.where('products.is_featured', value.is_featured);
    }

    if (value.manage_stock !== undefined) {
      query = query.where('products.manage_stock', value.manage_stock);
    }

    if (value.min_price !== undefined) {
      query = query.where('products.price', '>=', value.min_price);
    }

    if (value.max_price !== undefined) {
      query = query.where('products.price', '<=', value.max_price);
    }

    if (value.search) {
      query = query.where(builder => {
        builder
          .where('products.name', 'ilike', `%${value.search}%`)
          .orWhere('products.description', 'ilike', `%${value.search}%`)
          .orWhere('products.sku', 'ilike', `%${value.search}%`);
      });
    }

    if (value.tags && value.tags.length > 0) {
      // Buscar produtos que contenham pelo menos uma das tags
      query = query.where(builder => {
        value.tags.forEach(tag => {
          builder.orWhereRaw("products.tags::text ILIKE ?", [`%"${tag}"%`]);
        });
      });
    }

    if (value.low_stock) {
      query = query.whereRaw('products.stock_quantity <= products.min_stock AND products.manage_stock = true');
    }

    if (value.out_of_stock) {
      query = query.where('products.stock_quantity', 0).where('products.manage_stock', true);
    }

    // Contar total
    const countQuery = query.clone();
    const totalResult = await countQuery.count('products.id as count').first();
    const total = parseInt(totalResult.count);

    // Aplicar ordenação e paginação
    query = query
      .orderBy(`products.${value.sort_by}`, value.sort_order)
      .limit(value.limit)
      .offset((value.page - 1) * value.limit);

    const products = await query;

    return {
      data: products.map(product => this.parseProductFields(product)),
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        totalPages: Math.ceil(total / value.limit)
      }
    };
  }

  async update(tenantId, productId, updateData) {
    // Validar dados
    const { error, value } = ProductService.schemas.update.validate(updateData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid update data',
        details: error.details
      };
    }

    // Verificar se produto existe
    const existingProduct = await this.findById(tenantId, productId);

    // Verificar categoria (se alterando)
    if (value.category_id && value.category_id !== existingProduct.category_id) {
      const category = await this.db('categories')
        .where({ id: value.category_id, tenant_id: tenantId, is_active: true })
        .first();
      
      if (!category) {
        throw {
          type: 'validation',
          message: 'Category not found or inactive'
        };
      }
    }

    // Verificar SKU único (se alterando)
    if (value.sku && value.sku !== existingProduct.sku) {
      const existing = await this.db('products')
        .where({ tenant_id: tenantId, sku: value.sku })
        .whereNot('id', productId)
        .first();

      if (existing) {
        throw {
          type: 'validation',
          message: 'SKU already exists'
        };
      }
    }

    // Verificar Bling ID único (se alterando)
    if (value.bling_id && value.bling_id !== existingProduct.bling_id) {
      const existing = await this.db('products')
        .where({ tenant_id: tenantId, bling_id: value.bling_id })
        .whereNot('id', productId)
        .first();

      if (existing) {
        throw {
          type: 'validation',
          message: 'Bling ID already exists'
        };
      }
    }

    const trx = await this.db.transaction();

    try {
      // Preparar dados para update
      const updateFields = { ...value };
      
      if (value.images) updateFields.images = JSON.stringify(value.images);
      if (value.tags) updateFields.tags = JSON.stringify(value.tags);
      if (value.seo) updateFields.seo = JSON.stringify(value.seo);
      if (value.dimensions) updateFields.dimensions = JSON.stringify(value.dimensions);
      if (value.metadata) updateFields.metadata = JSON.stringify(value.metadata);
      
      updateFields.updated_at = new Date();

      // Atualizar produto
      const [updatedProduct] = await trx('products')
        .where({
          id: productId,
          tenant_id: tenantId
        })
        .update(updateFields)
        .returning('*');

      // Se estoque foi alterado, registrar movimento
      if (value.stock_quantity !== undefined && value.stock_quantity !== existingProduct.stock_quantity) {
        const difference = value.stock_quantity - existingProduct.stock_quantity;
        
        await trx('stock_movements').insert({
          product_id: productId,
          tenant_id: tenantId,
          type: difference > 0 ? 'in' : 'out',
          quantity: Math.abs(difference),
          previous_stock: existingProduct.stock_quantity,
          new_stock: value.stock_quantity,
          reason: 'adjustment',
          metadata: JSON.stringify({ source: 'product_update' })
        });
      }

      await trx.commit();

      const productWithParsedFields = this.parseProductFields(updatedProduct);

      // Publicar evento
      await this.eventPublisher.publish('product.updated', {
        tenantId,
        productId,
        product: productWithParsedFields,
        changes: Object.keys(value)
      });

      this.logger.info('Product updated', {
        tenantId,
        productId,
        changes: Object.keys(value)
      });

      return productWithParsedFields;
    } catch (error) {
      await trx.rollback();
      this.logger.error('Error updating product', {
        tenantId,
        productId,
        error: error.message,
        updateData: value
      });
      throw error;
    }
  }

  async updateStock(tenantId, productId, stockData) {
    // Validar dados
    const { error, value } = ProductService.schemas.stockUpdate.validate(stockData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid stock update data',
        details: error.details
      };
    }

    // Verificar se produto existe e gerencia estoque
    const product = await this.findById(tenantId, productId);
    
    if (!product.manage_stock) {
      throw {
        type: 'validation',
        message: 'Product does not manage stock'
      };
    }

    // Calcular novo estoque
    let newStock;
    switch (value.type) {
      case 'set':
        newStock = value.quantity;
        break;
      case 'add':
        newStock = product.stock_quantity + value.quantity;
        break;
      case 'subtract':
        newStock = product.stock_quantity - value.quantity;
        break;
    }

    if (newStock < 0) {
      throw {
        type: 'validation',
        message: 'Stock cannot be negative'
      };
    }

    const trx = await this.db.transaction();

    try {
      // Atualizar estoque do produto
      await trx('products')
        .where({ id: productId, tenant_id: tenantId })
        .update({
          stock_quantity: newStock,
          updated_at: new Date()
        });

      // Registrar movimento de estoque
      const movementType = newStock > product.stock_quantity ? 'in' : 
                          newStock < product.stock_quantity ? 'out' : 'adjustment';
      
      const quantity = Math.abs(newStock - product.stock_quantity);

      await trx('stock_movements').insert({
        product_id: productId,
        tenant_id: tenantId,
        type: movementType,
        quantity,
        previous_stock: product.stock_quantity,
        new_stock: newStock,
        reason: value.reason,
        reference_id: value.reference_id,
        metadata: JSON.stringify({
          update_type: value.type,
          original_quantity: value.quantity
        })
      });

      await trx.commit();

      // Publicar evento
      await this.eventPublisher.publish('product.stock.updated', {
        tenantId,
        productId,
        previousStock: product.stock_quantity,
        newStock,
        difference: newStock - product.stock_quantity,
        reason: value.reason
      });

      this.logger.info('Product stock updated', {
        tenantId,
        productId,
        previousStock: product.stock_quantity,
        newStock,
        type: value.type,
        reason: value.reason
      });

      return await this.findById(tenantId, productId);
    } catch (error) {
      await trx.rollback();
      this.logger.error('Error updating stock', {
        tenantId,
        productId,
        error: error.message,
        stockData: value
      });
      throw error;
    }
  }

  async delete(tenantId, productId) {
    // Verificar se produto existe
    await this.findById(tenantId, productId);

    // TODO: Verificar se produto está em pedidos pendentes
    // TODO: Verificar se produto tem variantes

    const trx = await this.db.transaction();

    try {
      // Marcar como inativo ao invés de deletar fisicamente
      await trx('products')
        .where({
          id: productId,
          tenant_id: tenantId
        })
        .update({
          is_active: false,
          updated_at: new Date()
        });

      await trx.commit();

      // Publicar evento
      await this.eventPublisher.publish('product.deleted', {
        tenantId,
        productId
      });

      this.logger.info('Product deleted', {
        tenantId,
        productId
      });

      return true;
    } catch (error) {
      await trx.rollback();
      this.logger.error('Error deleting product', {
        tenantId,
        productId,
        error: error.message
      });
      throw error;
    }
  }

  async getStockMovements(tenantId, productId, filters = {}) {
    const product = await this.findById(tenantId, productId);

    let query = this.db('stock_movements')
      .where({
        product_id: productId,
        tenant_id: tenantId
      });

    if (filters.type) {
      query = query.where('type', filters.type);
    }

    if (filters.reason) {
      query = query.where('reason', filters.reason);
    }

    if (filters.from_date) {
      query = query.where('created_at', '>=', filters.from_date);
    }

    if (filters.to_date) {
      query = query.where('created_at', '<=', filters.to_date);
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;

    const total = await query.clone().count('* as count').first();
    const movements = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data: movements.map(movement => ({
        ...movement,
        metadata: movement.metadata ? JSON.parse(movement.metadata) : null
      })),
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit)
      }
    };
  }

  parseProductFields(product) {
    if (!product) return product;

    return {
      ...product,
      images: product.images ? JSON.parse(product.images) : [],
      tags: product.tags ? JSON.parse(product.tags) : [],
      seo: product.seo ? JSON.parse(product.seo) : null,
      dimensions: product.dimensions ? JSON.parse(product.dimensions) : null,
      metadata: product.metadata ? JSON.parse(product.metadata) : null
    };
  }
}

module.exports = ProductService;