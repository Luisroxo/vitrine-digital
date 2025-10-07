const { ValidationSchemas } = require('../../../shared');
const Joi = ValidationSchemas.Joi;

class CategoryService {
  constructor(db, logger, eventPublisher) {
    this.db = db;
    this.logger = logger;
    this.eventPublisher = eventPublisher;
  }

  // Validation schemas
  static schemas = {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(1000).allow(''),
      parent_id: Joi.number().integer().min(1).allow(null),
      sort_order: Joi.number().integer().min(0).default(0),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().allow(null)
    }),

    update: Joi.object({
      name: Joi.string().min(1).max(100),
      description: Joi.string().max(1000).allow(''),
      parent_id: Joi.number().integer().min(1).allow(null),
      sort_order: Joi.number().integer().min(0),
      is_active: Joi.boolean(),
      metadata: Joi.object().allow(null)
    }).min(1),

    query: Joi.object({
      parent_id: Joi.number().integer().allow(null),
      is_active: Joi.boolean(),
      search: Joi.string().max(100),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  };

  async create(tenantId, categoryData) {
    // Validar dados
    const { error, value } = CategoryService.schemas.create.validate(categoryData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid category data',
        details: error.details
      };
    }

    // Verificar se parent_id existe (se fornecido)
    if (value.parent_id) {
      const parent = await this.db('categories')
        .where({ id: value.parent_id, tenant_id: tenantId })
        .first();
      
      if (!parent) {
        throw {
          type: 'validation',
          message: 'Parent category not found'
        };
      }
    }

    // Verificar nome único no tenant/parent
    const existing = await this.db('categories')
      .where({
        tenant_id: tenantId,
        parent_id: value.parent_id || null,
        name: value.name
      })
      .first();

    if (existing) {
      throw {
        type: 'validation',
        message: 'Category name already exists in this level'
      };
    }

    try {
      const [category] = await this.db('categories')
        .insert({
          ...value,
          tenant_id: tenantId
        })
        .returning('*');

      // Publicar evento
      await this.eventPublisher.publish('category.created', {
        tenantId,
        categoryId: category.id,
        category
      });

      this.logger.info('Category created', {
        tenantId,
        categoryId: category.id,
        name: category.name
      });

      return category;
    } catch (error) {
      this.logger.error('Error creating category', {
        tenantId,
        error: error.message,
        categoryData: value
      });
      throw error;
    }
  }

  async findById(tenantId, categoryId) {
    const category = await this.db('categories')
      .where({
        id: categoryId,
        tenant_id: tenantId
      })
      .first();

    if (!category) {
      throw {
        type: 'not_found',
        message: 'Category not found'
      };
    }

    return category;
  }

  async findAll(tenantId, filters = {}) {
    // Validar filtros
    const { error, value } = CategoryService.schemas.query.validate(filters);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid query parameters',
        details: error.details
      };
    }

    let query = this.db('categories')
      .where('tenant_id', tenantId);

    // Aplicar filtros
    if (value.parent_id !== undefined) {
      if (value.parent_id === null) {
        query = query.whereNull('parent_id');
      } else {
        query = query.where('parent_id', value.parent_id);
      }
    }

    if (value.is_active !== undefined) {
      query = query.where('is_active', value.is_active);
    }

    if (value.search) {
      query = query.where('name', 'ilike', `%${value.search}%`);
    }

    // Contar total
    const countQuery = query.clone();
    const totalResult = await countQuery.count('* as count').first();
    const total = parseInt(totalResult.count);

    // Aplicar paginação e ordenação
    const categories = await query
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .limit(value.limit)
      .offset((value.page - 1) * value.limit);

    return {
      data: categories,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        totalPages: Math.ceil(total / value.limit)
      }
    };
  }

  async findTree(tenantId, activeOnly = true) {
    let query = this.db('categories')
      .where('tenant_id', tenantId);

    if (activeOnly) {
      query = query.where('is_active', true);
    }

    const categories = await query
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');

    // Construir árvore
    const categoryMap = new Map();
    const rootCategories = [];

    // Primeiro, criar map de todas as categorias
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Depois, construir hierarquia
    categories.forEach(cat => {
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      } else {
        rootCategories.push(categoryMap.get(cat.id));
      }
    });

    return rootCategories;
  }

  async update(tenantId, categoryId, updateData) {
    // Validar dados
    const { error, value } = CategoryService.schemas.update.validate(updateData);
    if (error) {
      throw {
        type: 'validation',
        message: 'Invalid update data',
        details: error.details
      };
    }

    // Verificar se categoria existe
    const existingCategory = await this.findById(tenantId, categoryId);

    // Verificar se parent_id existe (se fornecido)
    if (value.parent_id) {
      // Não pode ser pai de si mesmo
      if (value.parent_id === categoryId) {
        throw {
          type: 'validation',
          message: 'Category cannot be parent of itself'
        };
      }

      const parent = await this.db('categories')
        .where({ id: value.parent_id, tenant_id: tenantId })
        .first();
      
      if (!parent) {
        throw {
          type: 'validation',
          message: 'Parent category not found'
        };
      }

      // Verificar se não criaria ciclo
      if (await this.wouldCreateCycle(tenantId, categoryId, value.parent_id)) {
        throw {
          type: 'validation',
          message: 'This would create a circular reference'
        };
      }
    }

    // Verificar nome único (se alterando nome)
    if (value.name && value.name !== existingCategory.name) {
      const existing = await this.db('categories')
        .where({
          tenant_id: tenantId,
          parent_id: value.parent_id !== undefined ? value.parent_id : existingCategory.parent_id,
          name: value.name
        })
        .whereNot('id', categoryId)
        .first();

      if (existing) {
        throw {
          type: 'validation',
          message: 'Category name already exists in this level'
        };
      }
    }

    try {
      const [updatedCategory] = await this.db('categories')
        .where({
          id: categoryId,
          tenant_id: tenantId
        })
        .update({
          ...value,
          updated_at: new Date()
        })
        .returning('*');

      // Publicar evento
      await this.eventPublisher.publish('category.updated', {
        tenantId,
        categoryId,
        category: updatedCategory,
        changes: value
      });

      this.logger.info('Category updated', {
        tenantId,
        categoryId,
        changes: Object.keys(value)
      });

      return updatedCategory;
    } catch (error) {
      this.logger.error('Error updating category', {
        tenantId,
        categoryId,
        error: error.message,
        updateData: value
      });
      throw error;
    }
  }

  async delete(tenantId, categoryId) {
    // Verificar se categoria existe
    await this.findById(tenantId, categoryId);

    // Verificar se tem subcategorias
    const hasChildren = await this.db('categories')
      .where({ parent_id: categoryId, tenant_id: tenantId })
      .first();

    if (hasChildren) {
      throw {
        type: 'validation',
        message: 'Cannot delete category with subcategories'
      };
    }

    // Verificar se tem produtos
    const hasProducts = await this.db('products')
      .where({ category_id: categoryId, tenant_id: tenantId })
      .first();

    if (hasProducts) {
      throw {
        type: 'validation',
        message: 'Cannot delete category with products'
      };
    }

    try {
      await this.db('categories')
        .where({
          id: categoryId,
          tenant_id: tenantId
        })
        .del();

      // Publicar evento
      await this.eventPublisher.publish('category.deleted', {
        tenantId,
        categoryId
      });

      this.logger.info('Category deleted', {
        tenantId,
        categoryId
      });

      return true;
    } catch (error) {
      this.logger.error('Error deleting category', {
        tenantId,
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  async wouldCreateCycle(tenantId, categoryId, newParentId) {
    let currentParentId = newParentId;
    const visited = new Set();

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true; // Ciclo detectado
      }

      if (visited.has(currentParentId)) {
        return true; // Ciclo já existente
      }

      visited.add(currentParentId);

      const parent = await this.db('categories')
        .where({ id: currentParentId, tenant_id: tenantId })
        .first();

      currentParentId = parent ? parent.parent_id : null;
    }

    return false;
  }

  async reorder(tenantId, categoryId, newSortOrder) {
    const category = await this.findById(tenantId, categoryId);

    try {
      await this.db('categories')
        .where({
          id: categoryId,
          tenant_id: tenantId
        })
        .update({
          sort_order: newSortOrder,
          updated_at: new Date()
        });

      this.logger.info('Category reordered', {
        tenantId,
        categoryId,
        oldOrder: category.sort_order,
        newOrder: newSortOrder
      });

      return await this.findById(tenantId, categoryId);
    } catch (error) {
      this.logger.error('Error reordering category', {
        tenantId,
        categoryId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CategoryService;