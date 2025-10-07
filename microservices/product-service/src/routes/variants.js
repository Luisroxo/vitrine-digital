const express = require('express');
const router = express.Router();
const { ValidationSchemas } = require('../../../shared');
const Joi = ValidationSchemas.Joi;

// Middleware para extrair tenant_id
router.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing tenant ID',
      message: 'x-tenant-id header is required'
    });
  }

  req.tenantId = parseInt(tenantId);
  next();
});

// Validation schemas
const variantSchemas = {
  create: Joi.object({
    product_id: Joi.number().integer().min(1).required(),
    name: Joi.string().min(1).max(100).required(),
    sku: Joi.string().max(100).allow(null),
    price: Joi.number().min(0).allow(null), // Se null, usa preço do produto pai
    compare_price: Joi.number().min(0).allow(null),
    stock_quantity: Joi.number().integer().min(0).default(0),
    weight: Joi.number().min(0).allow(null),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0)
    }).allow(null),
    attributes: Joi.object().allow(null), // Ex: { "color": "red", "size": "M" }
    images: Joi.array().items(Joi.string().uri()).max(10).default([]),
    is_active: Joi.boolean().default(true)
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(100),
    sku: Joi.string().max(100).allow(null),
    price: Joi.number().min(0).allow(null),
    compare_price: Joi.number().min(0).allow(null),
    stock_quantity: Joi.number().integer().min(0),
    weight: Joi.number().min(0).allow(null),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0)
    }).allow(null),
    attributes: Joi.object().allow(null),
    images: Joi.array().items(Joi.string().uri()).max(10),
    is_active: Joi.boolean()
  }).min(1)
};

// GET /api/variants - Listar variantes (opcionalmente por produto)
router.get('/', async (req, res, next) => {
  try {
    const { product_id, is_active, page = 1, limit = 20 } = req.query;

    let query = req.db('product_variants')
      .where('tenant_id', req.tenantId);

    if (product_id) {
      query = query.where('product_id', parseInt(product_id));
    }

    if (is_active !== undefined) {
      query = query.where('is_active', is_active === 'true');
    }

    // Contar total
    const totalResult = await query.clone().count('* as count').first();
    const total = parseInt(totalResult.count);

    // Buscar variantes com dados do produto
    const variants = await query
      .select('product_variants.*', 'products.name as product_name')
      .leftJoin('products', 'product_variants.product_id', 'products.id')
      .orderBy('product_variants.created_at', 'desc')
      .limit(parseInt(limit))
      .offset((parseInt(page) - 1) * parseInt(limit));

    const parsedVariants = variants.map(variant => ({
      ...variant,
      attributes: variant.attributes ? JSON.parse(variant.attributes) : null,
      images: variant.images ? JSON.parse(variant.images) : [],
      dimensions: variant.dimensions ? JSON.parse(variant.dimensions) : null
    }));

    res.json({
      data: parsedVariants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/variants/:id - Buscar variante por ID
router.get('/:id', async (req, res, next) => {
  try {
    const variantId = parseInt(req.params.id);
    
    const variant = await req.db('product_variants')
      .select('product_variants.*', 'products.name as product_name', 'products.price as product_price')
      .leftJoin('products', 'product_variants.product_id', 'products.id')
      .where({
        'product_variants.id': variantId,
        'product_variants.tenant_id': req.tenantId
      })
      .first();

    if (!variant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Variant not found'
      });
    }

    const parsedVariant = {
      ...variant,
      attributes: variant.attributes ? JSON.parse(variant.attributes) : null,
      images: variant.images ? JSON.parse(variant.images) : [],
      dimensions: variant.dimensions ? JSON.parse(variant.dimensions) : null
    };

    res.json(parsedVariant);
  } catch (error) {
    next(error);
  }
});

// POST /api/variants - Criar variante
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = variantSchemas.create.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid variant data',
        details: error.details
      });
    }

    // Verificar se produto existe e pertence ao tenant
    const product = await req.db('products')
      .where({ id: value.product_id, tenant_id: req.tenantId })
      .first();

    if (!product) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Product not found'
      });
    }

    // Verificar SKU único (se fornecido)
    if (value.sku) {
      const existingVariant = await req.db('product_variants')
        .where({ tenant_id: req.tenantId, sku: value.sku })
        .first();

      const existingProduct = await req.db('products')
        .where({ tenant_id: req.tenantId, sku: value.sku })
        .first();

      if (existingVariant || existingProduct) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'SKU already exists'
        });
      }
    }

    const trx = await req.db.transaction();

    try {
      // Criar variante
      const [variant] = await trx('product_variants')
        .insert({
          ...value,
          tenant_id: req.tenantId,
          attributes: value.attributes ? JSON.stringify(value.attributes) : null,
          images: JSON.stringify(value.images),
          dimensions: value.dimensions ? JSON.stringify(value.dimensions) : null
        })
        .returning('*');

      // Registrar movimento de estoque inicial (se quantidade > 0)
      if (value.stock_quantity > 0) {
        await trx('stock_movements').insert({
          variant_id: variant.id,
          tenant_id: req.tenantId,
          type: 'in',
          quantity: value.stock_quantity,
          previous_stock: 0,
          new_stock: value.stock_quantity,
          reason: 'initial',
          metadata: JSON.stringify({ source: 'variant_creation' })
        });
      }

      await trx.commit();

      const parsedVariant = {
        ...variant,
        attributes: variant.attributes ? JSON.parse(variant.attributes) : null,
        images: variant.images ? JSON.parse(variant.images) : [],
        dimensions: variant.dimensions ? JSON.parse(variant.dimensions) : null
      };

      req.logger.info('Product variant created', {
        tenantId: req.tenantId,
        variantId: variant.id,
        productId: value.product_id,
        name: variant.name
      });

      res.status(201).json(parsedVariant);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// PUT /api/variants/:id - Atualizar variante
router.put('/:id', async (req, res, next) => {
  try {
    const variantId = parseInt(req.params.id);
    
    const { error, value } = variantSchemas.update.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid update data',
        details: error.details
      });
    }

    // Verificar se variante existe
    const existingVariant = await req.db('product_variants')
      .where({ id: variantId, tenant_id: req.tenantId })
      .first();

    if (!existingVariant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Variant not found'
      });
    }

    // Verificar SKU único (se alterando)
    if (value.sku && value.sku !== existingVariant.sku) {
      const existingVariantSku = await req.db('product_variants')
        .where({ tenant_id: req.tenantId, sku: value.sku })
        .whereNot('id', variantId)
        .first();

      const existingProductSku = await req.db('products')
        .where({ tenant_id: req.tenantId, sku: value.sku })
        .first();

      if (existingVariantSku || existingProductSku) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'SKU already exists'
        });
      }
    }

    const trx = await req.db.transaction();

    try {
      // Preparar dados para update
      const updateFields = { ...value };
      
      if (value.attributes) updateFields.attributes = JSON.stringify(value.attributes);
      if (value.images) updateFields.images = JSON.stringify(value.images);
      if (value.dimensions) updateFields.dimensions = JSON.stringify(value.dimensions);
      
      updateFields.updated_at = new Date();

      // Atualizar variante
      const [updatedVariant] = await trx('product_variants')
        .where({ id: variantId, tenant_id: req.tenantId })
        .update(updateFields)
        .returning('*');

      // Se estoque foi alterado, registrar movimento
      if (value.stock_quantity !== undefined && value.stock_quantity !== existingVariant.stock_quantity) {
        const difference = value.stock_quantity - existingVariant.stock_quantity;
        
        await trx('stock_movements').insert({
          variant_id: variantId,
          tenant_id: req.tenantId,
          type: difference > 0 ? 'in' : 'out',
          quantity: Math.abs(difference),
          previous_stock: existingVariant.stock_quantity,
          new_stock: value.stock_quantity,
          reason: 'adjustment',
          metadata: JSON.stringify({ source: 'variant_update' })
        });
      }

      await trx.commit();

      const parsedVariant = {
        ...updatedVariant,
        attributes: updatedVariant.attributes ? JSON.parse(updatedVariant.attributes) : null,
        images: updatedVariant.images ? JSON.parse(updatedVariant.images) : [],
        dimensions: updatedVariant.dimensions ? JSON.parse(updatedVariant.dimensions) : null
      };

      req.logger.info('Product variant updated', {
        tenantId: req.tenantId,
        variantId,
        changes: Object.keys(value)
      });

      res.json(parsedVariant);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/variants/:id - Desativar variante
router.delete('/:id', async (req, res, next) => {
  try {
    const variantId = parseInt(req.params.id);
    
    const result = await req.db('product_variants')
      .where({ id: variantId, tenant_id: req.tenantId })
      .update({
        is_active: false,
        updated_at: new Date()
      });

    if (result === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Variant not found'
      });
    }

    req.logger.info('Product variant deleted', {
      tenantId: req.tenantId,
      variantId
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// PATCH /api/variants/:id/stock - Atualizar estoque da variante
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const variantId = parseInt(req.params.id);
    const { quantity, type = 'set', reason = 'manual', reference_id } = req.body;

    if (typeof quantity !== 'number') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'quantity must be a number'
      });
    }

    // Verificar se variante existe
    const variant = await req.db('product_variants')
      .where({ id: variantId, tenant_id: req.tenantId })
      .first();

    if (!variant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Variant not found'
      });
    }

    // Calcular novo estoque
    let newStock;
    switch (type) {
      case 'set':
        newStock = quantity;
        break;
      case 'add':
        newStock = variant.stock_quantity + quantity;
        break;
      case 'subtract':
        newStock = variant.stock_quantity - quantity;
        break;
      default:
        return res.status(400).json({
          error: 'Validation Error',
          message: 'type must be one of: set, add, subtract'
        });
    }

    if (newStock < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Stock cannot be negative'
      });
    }

    const trx = await req.db.transaction();

    try {
      // Atualizar estoque da variante
      await trx('product_variants')
        .where({ id: variantId, tenant_id: req.tenantId })
        .update({
          stock_quantity: newStock,
          updated_at: new Date()
        });

      // Registrar movimento de estoque
      const movementType = newStock > variant.stock_quantity ? 'in' : 
                          newStock < variant.stock_quantity ? 'out' : 'adjustment';
      
      const movementQuantity = Math.abs(newStock - variant.stock_quantity);

      if (movementQuantity > 0) {
        await trx('stock_movements').insert({
          variant_id: variantId,
          tenant_id: req.tenantId,
          type: movementType,
          quantity: movementQuantity,
          previous_stock: variant.stock_quantity,
          new_stock: newStock,
          reason,
          reference_id,
          metadata: JSON.stringify({
            update_type: type,
            original_quantity: quantity
          })
        });
      }

      await trx.commit();

      // Buscar variante atualizada
      const updatedVariant = await req.db('product_variants')
        .where({ id: variantId, tenant_id: req.tenantId })
        .first();

      req.logger.info('Variant stock updated', {
        tenantId: req.tenantId,
        variantId,
        previousStock: variant.stock_quantity,
        newStock,
        type,
        reason
      });

      const parsedVariant = {
        ...updatedVariant,
        attributes: updatedVariant.attributes ? JSON.parse(updatedVariant.attributes) : null,
        images: updatedVariant.images ? JSON.parse(updatedVariant.images) : [],
        dimensions: updatedVariant.dimensions ? JSON.parse(updatedVariant.dimensions) : null
      };

      res.json(parsedVariant);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;