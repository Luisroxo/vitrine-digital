const express = require('express');
const router = express.Router();
const ProductService = require('../services/ProductService');
const { EventPublisher } = require('../../../shared');

// Middleware para inicializar serviços
router.use(async (req, res, next) => {
  const eventPublisher = new EventPublisher();
  req.productService = new ProductService(req.db, req.logger, eventPublisher);
  next();
});

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

// GET /api/products - Listar produtos com filtros
router.get('/', async (req, res, next) => {
  try {
    const result = await req.productService.findAll(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Buscar produto por ID
router.get('/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await req.productService.findById(req.tenantId, productId);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Criar produto
router.post('/', async (req, res, next) => {
  try {
    const product = await req.productService.create(req.tenantId, req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Atualizar produto
router.put('/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await req.productService.update(req.tenantId, productId, req.body);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/products/:id/stock - Atualizar estoque
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await req.productService.updateStock(req.tenantId, productId, req.body);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id/stock/movements - Histórico de movimentações
router.get('/:id/stock/movements', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const result = await req.productService.getStockMovements(req.tenantId, productId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Desativar produto
router.delete('/:id', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    await req.productService.delete(req.tenantId, productId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/products/bulk - Operações em lote
router.post('/bulk', async (req, res, next) => {
  try {
    const { action, product_ids, data } = req.body;

    if (!action || !product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({
        error: 'Invalid bulk operation',
        message: 'action and product_ids array are required'
      });
    }

    const results = [];
    const errors = [];

    for (const productId of product_ids) {
      try {
        let result;
        switch (action) {
          case 'activate':
            result = await req.productService.update(req.tenantId, productId, { is_active: true });
            break;
          case 'deactivate':
            result = await req.productService.update(req.tenantId, productId, { is_active: false });
            break;
          case 'feature':
            result = await req.productService.update(req.tenantId, productId, { is_featured: true });
            break;
          case 'unfeature':
            result = await req.productService.update(req.tenantId, productId, { is_featured: false });
            break;
          case 'update_category':
            if (!data || !data.category_id) {
              throw new Error('category_id is required for update_category action');
            }
            result = await req.productService.update(req.tenantId, productId, { category_id: data.category_id });
            break;
          case 'adjust_stock':
            if (!data || typeof data.quantity !== 'number') {
              throw new Error('quantity is required for adjust_stock action');
            }
            result = await req.productService.updateStock(req.tenantId, productId, {
              quantity: data.quantity,
              type: data.type || 'set',
              reason: data.reason || 'bulk_operation'
            });
            break;
          case 'delete':
            result = await req.productService.delete(req.tenantId, productId);
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }
        
        results.push({
          product_id: productId,
          success: true,
          result
        });
      } catch (error) {
        errors.push({
          product_id: productId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      action,
      total: product_ids.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;