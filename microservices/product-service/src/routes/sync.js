const express = require('express');
const router = express.Router();
const { EventPublisher } = require('../../../shared');

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

// POST /api/sync/products/bulk - Sincronização em lote de produtos do Bling
router.post('/products/bulk', async (req, res, next) => {
  try {
    const { products, source = 'bling', sync_id } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'products array is required and cannot be empty'
      });
    }

    const results = [];
    const errors = [];
    const eventPublisher = new EventPublisher();

    const trx = await req.db.transaction();

    try {
      for (const productData of products) {
        try {
          const {
            bling_id,
            name,
            description,
            short_description,
            category_name,
            sku,
            price,
            cost_price,
            stock_quantity,
            weight,
            dimensions,
            images,
            tags,
            is_active = true
          } = productData;

          // Validações básicas
          if (!bling_id || !name) {
            throw new Error('bling_id and name are required');
          }

          // Buscar ou criar categoria
          let category;
          if (category_name) {
            category = await trx('categories')
              .where({ tenant_id: req.tenantId, name: category_name })
              .first();

            if (!category) {
              // Criar categoria automaticamente
              [category] = await trx('categories')
                .insert({
                  tenant_id: req.tenantId,
                  name: category_name,
                  description: `Category created automatically during sync from ${source}`,
                  is_active: true,
                  sort_order: 0
                })
                .returning('*');
            }
          }

          // Verificar se produto já existe por bling_id
          let existingProduct = await trx('products')
            .where({ tenant_id: req.tenantId, bling_id })
            .first();

          let product;
          if (existingProduct) {
            // Atualizar produto existente
            const updateData = {
              name,
              description: description || '',
              short_description: short_description || '',
              category_id: category ? category.id : existingProduct.category_id,
              sku,
              price: price || 0,
              cost_price,
              weight,
              dimensions: dimensions ? JSON.stringify(dimensions) : null,
              images: images ? JSON.stringify(images) : JSON.stringify([]),
              tags: tags ? JSON.stringify(tags) : JSON.stringify([]),
              is_active,
              updated_at: new Date(),
              metadata: JSON.stringify({
                last_sync: new Date(),
                sync_source: source,
                sync_id
              })
            };

            await trx('products')
              .where({ id: existingProduct.id, tenant_id: req.tenantId })
              .update(updateData);

            product = { ...existingProduct, ...updateData };

            // Atualizar estoque se fornecido e diferente
            if (stock_quantity !== undefined && stock_quantity !== existingProduct.stock_quantity) {
              await trx('products')
                .where({ id: existingProduct.id, tenant_id: req.tenantId })
                .update({ stock_quantity });

              // Registrar movimento de estoque
              if (stock_quantity !== existingProduct.stock_quantity) {
                const difference = stock_quantity - existingProduct.stock_quantity;
                
                await trx('stock_movements').insert({
                  product_id: existingProduct.id,
                  tenant_id: req.tenantId,
                  type: 'sync',
                  quantity: Math.abs(difference),
                  previous_stock: existingProduct.stock_quantity,
                  new_stock: stock_quantity,
                  reason: 'bling_sync',
                  reference_id: sync_id,
                  metadata: JSON.stringify({
                    source,
                    bling_id,
                    sync_direction: difference > 0 ? 'increase' : 'decrease'
                  })
                });
              }
            }

            results.push({
              action: 'updated',
              product_id: existingProduct.id,
              bling_id,
              name,
              success: true
            });

          } else {
            // Criar novo produto
            const newProductData = {
              tenant_id: req.tenantId,
              bling_id,
              name,
              description: description || '',
              short_description: short_description || '',
              category_id: category ? category.id : null,
              sku,
              price: price || 0,
              cost_price,
              stock_quantity: stock_quantity || 0,
              min_stock: 0,
              manage_stock: true,
              weight,
              dimensions: dimensions ? JSON.stringify(dimensions) : null,
              images: images ? JSON.stringify(images) : JSON.stringify([]),
              tags: tags ? JSON.stringify(tags) : JSON.stringify([]),
              is_active,
              is_featured: false,
              metadata: JSON.stringify({
                created_via_sync: true,
                sync_source: source,
                sync_id,
                first_sync: new Date()
              })
            };

            [product] = await trx('products')
              .insert(newProductData)
              .returning('*');

            // Registrar estoque inicial
            if (stock_quantity > 0) {
              await trx('stock_movements').insert({
                product_id: product.id,
                tenant_id: req.tenantId,
                type: 'sync',
                quantity: stock_quantity,
                previous_stock: 0,
                new_stock: stock_quantity,
                reason: 'initial_sync',
                reference_id: sync_id,
                metadata: JSON.stringify({
                  source,
                  bling_id,
                  sync_type: 'initial'
                })
              });
            }

            results.push({
              action: 'created',
              product_id: product.id,
              bling_id,
              name,
              success: true
            });
          }

        } catch (error) {
          errors.push({
            bling_id: productData.bling_id || 'unknown',
            name: productData.name || 'unknown',
            success: false,
            error: error.message,
            product_data: productData
          });
        }
      }

      await trx.commit();

      // Publicar evento de sincronização
      await eventPublisher.publish('products.bulk.synced', {
        tenantId: req.tenantId,
        source,
        sync_id,
        total: products.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      });

      req.logger.info('Bulk product sync completed', {
        tenantId: req.tenantId,
        source,
        sync_id,
        total: products.length,
        successful: results.length,
        failed: errors.length
      });

      res.json({
        message: 'Bulk sync completed',
        source,
        sync_id,
        total: products.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/sync/stock/bulk - Sincronização em lote de estoques
router.post('/stock/bulk', async (req, res, next) => {
  try {
    const { stock_updates, source = 'bling', sync_id } = req.body;

    if (!Array.isArray(stock_updates) || stock_updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'stock_updates array is required and cannot be empty'
      });
    }

    const results = [];
    const errors = [];
    const eventPublisher = new EventPublisher();

    const trx = await req.db.transaction();

    try {
      for (const stockUpdate of stock_updates) {
        try {
          const { bling_id, sku, stock_quantity } = stockUpdate;

          if ((!bling_id && !sku) || stock_quantity === undefined) {
            throw new Error('Either bling_id or sku is required, and stock_quantity is required');
          }

          // Buscar produto por bling_id ou SKU
          let query = trx('products')
            .where('tenant_id', req.tenantId);

          if (bling_id) {
            query = query.where('bling_id', bling_id);
          } else {
            query = query.where('sku', sku);
          }

          const product = await query.first();

          if (!product) {
            throw new Error(`Product not found with ${bling_id ? 'bling_id' : 'sku'}: ${bling_id || sku}`);
          }

          // Atualizar estoque se diferente
          if (stock_quantity !== product.stock_quantity) {
            await trx('products')
              .where({ id: product.id, tenant_id: req.tenantId })
              .update({
                stock_quantity,
                updated_at: new Date()
              });

            // Registrar movimento
            const difference = stock_quantity - product.stock_quantity;
            
            await trx('stock_movements').insert({
              product_id: product.id,
              tenant_id: req.tenantId,
              type: 'sync',
              quantity: Math.abs(difference),
              previous_stock: product.stock_quantity,
              new_stock: stock_quantity,
              reason: 'stock_sync',
              reference_id: sync_id,
              metadata: JSON.stringify({
                source,
                bling_id: product.bling_id,
                sku: product.sku,
                sync_direction: difference > 0 ? 'increase' : 'decrease'
              })
            });
          }

          results.push({
            product_id: product.id,
            bling_id: product.bling_id,
            sku: product.sku,
            previous_stock: product.stock_quantity,
            new_stock: stock_quantity,
            updated: stock_quantity !== product.stock_quantity,
            success: true
          });

        } catch (error) {
          errors.push({
            bling_id: stockUpdate.bling_id || null,
            sku: stockUpdate.sku || null,
            success: false,
            error: error.message,
            update_data: stockUpdate
          });
        }
      }

      await trx.commit();

      // Publicar evento de sincronização
      await eventPublisher.publish('stock.bulk.synced', {
        tenantId: req.tenantId,
        source,
        sync_id,
        total: stock_updates.length,
        successful: results.length,
        failed: errors.length,
        updated: results.filter(r => r.updated).length,
        results,
        errors
      });

      req.logger.info('Bulk stock sync completed', {
        tenantId: req.tenantId,
        source,
        sync_id,
        total: stock_updates.length,
        successful: results.length,
        failed: errors.length,
        updated: results.filter(r => r.updated).length
      });

      res.json({
        message: 'Bulk stock sync completed',
        source,
        sync_id,
        total: stock_updates.length,
        successful: results.length,
        failed: errors.length,
        updated: results.filter(r => r.updated).length,
        results,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      await trx.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/sync/status/:sync_id - Status de uma sincronização
router.get('/status/:sync_id', async (req, res, next) => {
  try {
    const { sync_id } = req.params;

    // Buscar movimentações relacionadas à sincronização
    const movements = await req.db('stock_movements')
      .select('type', req.db.raw('COUNT(*) as count'), req.db.raw('SUM(quantity) as total_quantity'))
      .where('tenant_id', req.tenantId)
      .where('reference_id', sync_id)
      .groupBy('type');

    // Buscar produtos sincronizados
    const syncedProducts = await req.db('products')
      .select('id', 'name', 'sku', 'bling_id', 'updated_at')
      .where('tenant_id', req.tenantId)
      .whereRaw("metadata::text LIKE ?", [`%"sync_id":"${sync_id}"%`])
      .orderBy('updated_at', 'desc')
      .limit(10);

    if (movements.length === 0 && syncedProducts.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Sync ID not found'
      });
    }

    res.json({
      sync_id,
      status: 'completed',
      movements: movements.map(m => ({
        type: m.type,
        count: parseInt(m.count),
        total_quantity: parseInt(m.total_quantity)
      })),
      recent_synced_products: syncedProducts,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sync/cleanup - Limpeza de dados de sincronização antigos
router.post('/cleanup', async (req, res, next) => {
  try {
    const { days_old = 30, dry_run = false } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days_old));

    // Contar registros que seriam removidos
    const oldMovements = await req.db('stock_movements')
      .where('tenant_id', req.tenantId)
      .where('reason', 'like', '%sync%')
      .where('created_at', '<', cutoffDate)
      .count('* as count')
      .first();

    if (dry_run) {
      res.json({
        dry_run: true,
        days_old: parseInt(days_old),
        cutoff_date: cutoffDate.toISOString(),
        movements_to_delete: parseInt(oldMovements.count),
        message: 'This is a dry run. No data was deleted.'
      });
    } else {
      // Realizar limpeza
      const deleted = await req.db('stock_movements')
        .where('tenant_id', req.tenantId)
        .where('reason', 'like', '%sync%')
        .where('created_at', '<', cutoffDate)
        .del();

      req.logger.info('Sync data cleanup completed', {
        tenantId: req.tenantId,
        days_old: parseInt(days_old),
        cutoff_date: cutoffDate.toISOString(),
        movements_deleted: deleted
      });

      res.json({
        dry_run: false,
        days_old: parseInt(days_old),
        cutoff_date: cutoffDate.toISOString(),
        movements_deleted: deleted,
        message: 'Cleanup completed successfully'
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;