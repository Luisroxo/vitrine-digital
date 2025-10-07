const Joi = require('joi');

/**
 * Validation Schemas for Microservices
 * Standardized validation across all services
 */
class ValidationSchemas {
  
  // User/Auth Schemas
  static get user() {
    return {
      register: Joi.object({
        email: Joi.string().email().required().messages({
          'string.email': 'Email deve ter um formato válido',
          'any.required': 'Email é obrigatório'
        }),
        password: Joi.string().min(6).required().messages({
          'string.min': 'Senha deve ter pelo menos 6 caracteres',
          'any.required': 'Senha é obrigatória'
        }),
        role: Joi.string().valid('admin', 'lojista', 'user').default('user'),
        tenant_id: Joi.number().integer().optional()
      }),

      login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      }),

      resetPassword: Joi.object({
        email: Joi.string().email().required()
      }),

      changePassword: Joi.object({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required()
      })
    };
  }

  // Product Schemas
  static get product() {
    return {
      create: Joi.object({
        name: Joi.string().min(1).max(255).required().messages({
          'string.min': 'Nome do produto é obrigatório',
          'string.max': 'Nome do produto não pode ter mais de 255 caracteres'
        }),
        description: Joi.string().allow('').optional(),
        price: Joi.number().precision(2).min(0).required().messages({
          'number.min': 'Preço deve ser maior ou igual a zero'
        }),
        bling_id: Joi.string().optional(),
        images: Joi.array().items(Joi.string().uri()).optional(),
        stock_quantity: Joi.number().integer().min(0).default(0),
        category_id: Joi.number().integer().optional(),
        tenant_id: Joi.number().integer().required()
      }),

      update: Joi.object({
        name: Joi.string().min(1).max(255).optional(),
        description: Joi.string().allow('').optional(),
        price: Joi.number().precision(2).min(0).optional(),
        images: Joi.array().items(Joi.string().uri()).optional(),
        stock_quantity: Joi.number().integer().min(0).optional(),
        category_id: Joi.number().integer().optional()
      }),

      query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        search: Joi.string().optional(),
        category_id: Joi.number().integer().optional(),
        min_price: Joi.number().precision(2).min(0).optional(),
        max_price: Joi.number().precision(2).min(0).optional(),
        sort: Joi.string().valid('name', 'price', 'created_at').default('created_at'),
        order: Joi.string().valid('asc', 'desc').default('desc')
      })
    };
  }

  // Order Schemas
  static get order() {
    return {
      create: Joi.object({
        customer: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
          phone: Joi.string().optional(),
          document: Joi.string().optional()
        }).required(),
        items: Joi.array().items(
          Joi.object({
            product_id: Joi.number().integer().required(),
            quantity: Joi.number().integer().min(1).required(),
            price: Joi.number().precision(2).min(0).required()
          })
        ).min(1).required(),
        shipping: Joi.object({
          address: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().required(),
          zip_code: Joi.string().required(),
          cost: Joi.number().precision(2).min(0).default(0)
        }).required(),
        payment_method: Joi.string().valid('pix', 'credit_card', 'boleto').required(),
        tenant_id: Joi.number().integer().required()
      }),

      update: Joi.object({
        status: Joi.string().valid(
          'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
        ).optional(),
        tracking_code: Joi.string().optional(),
        notes: Joi.string().optional()
      })
    };
  }

  // Billing Schemas
  static get billing() {
    return {
      createTransaction: Joi.object({
        lojista_id: Joi.number().integer().required(),
        type: Joi.string().valid('purchase', 'refund', 'credit').required(),
        amount: Joi.number().precision(2).min(0).required(),
        credits: Joi.number().integer().min(0).required(),
        description: Joi.string().required(),
        payment_method: Joi.string().valid('pix', 'credit_card').optional()
      }),

      purchaseCredits: Joi.object({
        lojista_id: Joi.number().integer().required(),
        credits: Joi.number().integer().min(1).required(),
        payment_method: Joi.string().valid('pix', 'credit_card').required()
      }),

      useCredits: Joi.object({
        lojista_id: Joi.number().integer().required(),
        credits: Joi.number().integer().min(1).required(),
        description: Joi.string().required(),
        order_id: Joi.number().integer().optional()
      })
    };
  }

  // Bling Integration Schemas
  static get bling() {
    return {
      authConfig: Joi.object({
        tenant_id: Joi.number().integer().required(),
        client_id: Joi.string().required(),
        client_secret: Joi.string().required(),
        redirect_uri: Joi.string().uri().required()
      }),

      syncConfig: Joi.object({
        tenant_id: Joi.number().integer().required(),
        sync_products: Joi.boolean().default(true),
        sync_stock: Joi.boolean().default(true),
        sync_orders: Joi.boolean().default(true),
        webhook_url: Joi.string().uri().optional()
      })
    };
  }

  // Common Schemas
  static get common() {
    return {
      pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
      }),

      id: Joi.object({
        id: Joi.number().integer().positive().required()
      }),

      tenantId: Joi.object({
        tenant_id: Joi.number().integer().positive().required()
      })
    };
  }

  /**
   * Validate request data against schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Joi schema
   * @returns {Object} Validation result
   */
  static validate(data, schema) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return {
        isValid: false,
        error: 'Validation failed',
        details
      };
    }

    return {
      isValid: true,
      data: value
    };
  }

  /**
   * Create validation middleware
   * @param {Object} schema - Joi schema
   * @param {string} source - Source of data ('body', 'query', 'params')
   */
  static createMiddleware(schema, source = 'body') {
    return (req, res, next) => {
      const data = req[source];
      const result = ValidationSchemas.validate(data, schema);

      if (!result.isValid) {
        return res.status(400).json({
          error: result.error,
          code: 'VALIDATION_ERROR',
          details: result.details
        });
      }

      req.validated = req.validated || {};
      req.validated[source] = result.data;
      next();
    };
  }
}

module.exports = ValidationSchemas;