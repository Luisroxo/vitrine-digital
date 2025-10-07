const express = require('express');
const router = express.Router();
const CategoryService = require('../services/CategoryService');
const { EventPublisher } = require('../../../shared');

// Middleware para inicializar serviços
router.use(async (req, res, next) => {
  const eventPublisher = new EventPublisher();
  req.categoryService = new CategoryService(req.db, req.logger, eventPublisher);
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

// GET /api/categories - Listar categorias
router.get('/', async (req, res, next) => {
  try {
    const result = await req.categoryService.findAll(req.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/tree - Árvore de categorias
router.get('/tree', async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only !== 'false';
    const tree = await req.categoryService.findTree(req.tenantId, activeOnly);
    res.json(tree);
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - Buscar categoria por ID
router.get('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await req.categoryService.findById(req.tenantId, categoryId);
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// POST /api/categories - Criar categoria
router.post('/', async (req, res, next) => {
  try {
    const category = await req.categoryService.create(req.tenantId, req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:id - Atualizar categoria
router.put('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await req.categoryService.update(req.tenantId, categoryId, req.body);
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/categories/:id/reorder - Reordenar categoria
router.patch('/:id/reorder', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { sort_order } = req.body;

    if (typeof sort_order !== 'number') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'sort_order must be a number'
      });
    }

    const category = await req.categoryService.reorder(req.tenantId, categoryId, sort_order);
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id - Excluir categoria
router.delete('/:id', async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.id);
    await req.categoryService.delete(req.tenantId, categoryId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;