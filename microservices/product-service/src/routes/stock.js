const express = require('express');
const router = express.Router();

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

// GET /api/stock/summary - Resumo geral do estoque
router.get('/summary', async (req, res, next) => {
  try {
    const { category_id, low_stock_only } = req.query;

    // Query base para produtos
    let productQuery = req.db('products')
      .where('products.tenant_id', req.tenantId)
      .where('products.is_active', true)
      .where('products.manage_stock', true);

    if (category_id) {
      productQuery = productQuery.where('products.category_id', parseInt(category_id));
    }

    // Estatísticas gerais
    const totalProducts = await productQuery.clone().count('* as count').first();
    
    const lowStockProducts = await productQuery.clone()
      .whereRaw('products.stock_quantity <= products.min_stock')
      .count('* as count')
      .first();

    const outOfStockProducts = await productQuery.clone()
      .where('products.stock_quantity', 0)
      .count('* as count')
      .first();

    const totalStockValue = await productQuery.clone()
      .sum(req.db.raw('products.stock_quantity * COALESCE(products.cost_price, products.price) as total_value'))
      .first();

    // Produtos com estoque baixo (se solicitado)
    let lowStockItems = [];
    if (low_stock_only === 'true') {
      const lowStockQuery = productQuery.clone()
        .select('products.*', 'categories.name as category_name')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .whereRaw('products.stock_quantity <= products.min_stock')
        .orderBy('products.stock_quantity', 'asc')
        .limit(50);

      lowStockItems = await lowStockQuery;
    }

    res.json({
      summary: {
        total_products: parseInt(totalProducts.count),
        low_stock_products: parseInt(lowStockProducts.count),
        out_of_stock_products: parseInt(outOfStockProducts.count),
        total_stock_value: parseFloat(totalStockValue.sum) || 0
      },
      low_stock_items: low_stock_only === 'true' ? lowStockItems : null
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/movements - Histórico de movimentações
router.get('/movements', async (req, res, next) => {
  try {
    const {
      product_id,
      variant_id,
      type,
      reason,
      from_date,
      to_date,
      page = 1,
      limit = 20
    } = req.query;

    let query = req.db('stock_movements')
      .where('tenant_id', req.tenantId);

    // Aplicar filtros
    if (product_id) {
      query = query.where('product_id', parseInt(product_id));
    }

    if (variant_id) {
      query = query.where('variant_id', parseInt(variant_id));
    }

    if (type) {
      query = query.where('type', type);
    }

    if (reason) {
      query = query.where('reason', reason);
    }

    if (from_date) {
      query = query.where('created_at', '>=', from_date);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date);
    }

    // Contar total
    const totalResult = await query.clone().count('* as count').first();
    const total = parseInt(totalResult.count);

    // Buscar movimentações com informações dos produtos
    const movements = await query
      .select(
        'stock_movements.*',
        'products.name as product_name',
        'products.sku as product_sku',
        'product_variants.name as variant_name',
        'product_variants.sku as variant_sku'
      )
      .leftJoin('products', 'stock_movements.product_id', 'products.id')
      .leftJoin('product_variants', 'stock_movements.variant_id', 'product_variants.id')
      .orderBy('stock_movements.created_at', 'desc')
      .limit(parseInt(limit))
      .offset((parseInt(page) - 1) * parseInt(limit));

    const parsedMovements = movements.map(movement => ({
      ...movement,
      metadata: movement.metadata ? JSON.parse(movement.metadata) : null
    }));

    res.json({
      data: parsedMovements,
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

// GET /api/stock/low-stock - Produtos com estoque baixo
router.get('/low-stock', async (req, res, next) => {
  try {
    const { category_id, page = 1, limit = 20 } = req.query;

    let query = req.db('products')
      .select('products.*', 'categories.name as category_name')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.tenant_id', req.tenantId)
      .where('products.is_active', true)
      .where('products.manage_stock', true)
      .whereRaw('products.stock_quantity <= products.min_stock');

    if (category_id) {
      query = query.where('products.category_id', parseInt(category_id));
    }

    // Contar total
    const totalResult = await query.clone().count('products.id as count').first();
    const total = parseInt(totalResult.count);

    // Buscar produtos
    const products = await query
      .orderBy('products.stock_quantity', 'asc')
      .orderBy('products.name', 'asc')
      .limit(parseInt(limit))
      .offset((parseInt(page) - 1) * parseInt(limit));

    res.json({
      data: products,
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

// GET /api/stock/out-of-stock - Produtos sem estoque
router.get('/out-of-stock', async (req, res, next) => {
  try {
    const { category_id, page = 1, limit = 20 } = req.query;

    let query = req.db('products')
      .select('products.*', 'categories.name as category_name')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.tenant_id', req.tenantId)
      .where('products.is_active', true)
      .where('products.manage_stock', true)
      .where('products.stock_quantity', 0);

    if (category_id) {
      query = query.where('products.category_id', parseInt(category_id));
    }

    // Contar total
    const totalResult = await query.clone().count('products.id as count').first();
    const total = parseInt(totalResult.count);

    // Buscar produtos
    const products = await query
      .orderBy('products.updated_at', 'desc')
      .limit(parseInt(limit))
      .offset((parseInt(page) - 1) * parseInt(limit));

    res.json({
      data: products,
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

// POST /api/stock/bulk-update - Atualização em lote do estoque
router.post('/bulk-update', async (req, res, next) => {
  try {
    const { updates, reason = 'bulk_update' } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'updates array is required and cannot be empty'
      });
    }

    const results = [];
    const errors = [];

    const trx = await req.db.transaction();

    try {
      for (const update of updates) {
        try {
          const { product_id, variant_id, quantity, type = 'set' } = update;

          if (!product_id && !variant_id) {
            throw new Error('Either product_id or variant_id is required');
          }

          if (typeof quantity !== 'number') {
            throw new Error('quantity must be a number');
          }

          let currentItem, newStock, tableName, idField;

          if (product_id) {
            // Atualizar produto
            currentItem = await trx('products')
              .where({ id: product_id, tenant_id: req.tenantId, manage_stock: true })
              .first();
            
            if (!currentItem) {
              throw new Error('Product not found or does not manage stock');
            }

            tableName = 'products';
            idField = 'product_id';
          } else {
            // Atualizar variante
            currentItem = await trx('product_variants')
              .where({ id: variant_id, tenant_id: req.tenantId })
              .first();
            
            if (!currentItem) {
              throw new Error('Variant not found');
            }

            tableName = 'product_variants';
            idField = 'variant_id';
          }

          // Calcular novo estoque
          switch (type) {
            case 'set':
              newStock = quantity;
              break;
            case 'add':
              newStock = currentItem.stock_quantity + quantity;
              break;
            case 'subtract':
              newStock = currentItem.stock_quantity - quantity;
              break;
            default:
              throw new Error('type must be one of: set, add, subtract');
          }

          if (newStock < 0) {
            throw new Error('Stock cannot be negative');
          }

          // Atualizar estoque
          await trx(tableName)
            .where({ id: product_id || variant_id, tenant_id: req.tenantId })
            .update({
              stock_quantity: newStock,
              updated_at: new Date()
            });

          // Registrar movimento
          if (newStock !== currentItem.stock_quantity) {
            const difference = newStock - currentItem.stock_quantity;
            const movementType = difference > 0 ? 'in' : 'out';

            await trx('stock_movements').insert({
              [idField]: product_id || variant_id,
              tenant_id: req.tenantId,
              type: movementType,
              quantity: Math.abs(difference),
              previous_stock: currentItem.stock_quantity,
              new_stock: newStock,
              reason,
              metadata: JSON.stringify({
                source: 'bulk_update',
                update_type: type,
                original_quantity: quantity
              })
            });
          }

          results.push({
            [product_id ? 'product_id' : 'variant_id']: product_id || variant_id,
            success: true,
            previous_stock: currentItem.stock_quantity,
            new_stock: newStock,
            difference: newStock - currentItem.stock_quantity
          });

        } catch (error) {
          errors.push({
            [update.product_id ? 'product_id' : 'variant_id']: update.product_id || update.variant_id,
            success: false,
            error: error.message,
            update_data: update
          });
        }
      }

      await trx.commit();

      req.logger.info('Bulk stock update completed', {
        tenantId: req.tenantId,
        total_updates: updates.length,
        successful: results.length,
        failed: errors.length,
        reason
      });

      res.json({
        message: 'Bulk stock update completed',
        total: updates.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      });

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/stock/analytics - Análises do estoque
router.get('/analytics', async (req, res, next) => {
  try {
    const { from_date, to_date, group_by = 'day' } = req.query;

    // Validar group_by
    if (!['day', 'week', 'month'].includes(group_by)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'group_by must be one of: day, week, month'
      });
    }

    let dateFormat;
    switch (group_by) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    let query = req.db('stock_movements')
      .select(
        req.db.raw(`to_char(created_at, '${dateFormat}') as period`),
        'type',
        req.db.raw('SUM(quantity) as total_quantity'),
        req.db.raw('COUNT(*) as movement_count')
      )
      .where('tenant_id', req.tenantId)
      .groupBy(
        req.db.raw(`to_char(created_at, '${dateFormat}')`),
        'type'
      )
      .orderBy('period', 'desc');

    if (from_date) {
      query = query.where('created_at', '>=', from_date);
    }

    if (to_date) {
      query = query.where('created_at', '<=', to_date);
    }

    const movements = await query;

    // Agrupar por período
    const analytics = movements.reduce((acc, movement) => {
      const period = movement.period;
      
      if (!acc[period]) {
        acc[period] = {
          period,
          in: { quantity: 0, movements: 0 },
          out: { quantity: 0, movements: 0 },
          adjustment: { quantity: 0, movements: 0 },
          sync: { quantity: 0, movements: 0 }
        };
      }

      acc[period][movement.type] = {
        quantity: parseInt(movement.total_quantity),
        movements: parseInt(movement.movement_count)
      };

      return acc;
    }, {});

    res.json({
      group_by,
      from_date,
      to_date,
      data: Object.values(analytics)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;