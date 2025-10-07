/**
 * Database Indexing Optimization
 * Creates strategic indexes for performance optimization
 */

exports.up = function(knex) {
  return Promise.all([
    // Products table indexes
    knex.schema.table('products', function(table) {
      // Search and filtering indexes
      table.index(['tenant_id', 'is_active'], 'idx_products_tenant_active');
      table.index(['category_id', 'is_active'], 'idx_products_category_active');
      table.index(['tenant_id', 'name'], 'idx_products_tenant_name');
      table.index(['tenant_id', 'sku'], 'idx_products_tenant_sku');
      
      // Price range queries
      table.index(['tenant_id', 'price', 'is_active'], 'idx_products_price_range');
      
      // Sorting and pagination
      table.index(['tenant_id', 'created_at'], 'idx_products_tenant_created');
      table.index(['tenant_id', 'updated_at'], 'idx_products_tenant_updated');
      table.index(['tenant_id', 'views_count'], 'idx_products_popularity');
      
      // Stock management
      table.index(['tenant_id', 'stock_quantity'], 'idx_products_stock');
      
      // Full-text search preparation (if using PostgreSQL)
      if (knex.client.config.client === 'postgresql') {
        // Add GIN index for full-text search on name and description
        knex.raw(`
          CREATE INDEX CONCURRENTLY idx_products_fulltext_search 
          ON products USING gin(to_tsvector('portuguese', name || ' ' || COALESCE(description, '')))
        `);
      }
    }),

    // Categories table indexes  
    knex.schema.table('categories', function(table) {
      table.index(['tenant_id', 'parent_id'], 'idx_categories_hierarchy');
      table.index(['tenant_id', 'is_active', 'sort_order'], 'idx_categories_active_sorted');
      table.index(['tenant_id', 'slug'], 'idx_categories_tenant_slug');
    }),

    // Product variants indexes
    knex.schema.table('product_variants', function(table) {
      table.index(['product_id', 'is_active'], 'idx_variants_product_active');
      table.index(['tenant_id', 'sku'], 'idx_variants_tenant_sku');
      table.index(['tenant_id', 'price'], 'idx_variants_price');
    }),

    // Product images indexes
    knex.schema.table('product_images', function(table) {
      table.index(['product_id', 'is_primary'], 'idx_images_product_primary');
      table.index(['product_id', 'is_active', 'sort_order'], 'idx_images_active_sorted');
      table.index(['processing_status'], 'idx_images_processing');
      table.index(['created_at'], 'idx_images_created');
    }),

    // Stock movements indexes
    knex.schema.table('stock_movements', function(table) {
      table.index(['product_id', 'created_at'], 'idx_stock_product_timeline');
      table.index(['tenant_id', 'movement_type'], 'idx_stock_tenant_type');
      table.index(['created_at'], 'idx_stock_created');
    }),

    // Orders and order items indexes (if tables exist)
    knex.schema.hasTable('orders').then(function(exists) {
      if (exists) {
        return knex.schema.table('orders', function(table) {
          table.index(['tenant_id', 'status'], 'idx_orders_tenant_status');
          table.index(['tenant_id', 'created_at'], 'idx_orders_tenant_created');
          table.index(['customer_email'], 'idx_orders_customer_email');
          table.index(['total_amount'], 'idx_orders_amount');
        });
      }
    }),

    knex.schema.hasTable('order_items').then(function(exists) {
      if (exists) {
        return knex.schema.table('order_items', function(table) {
          table.index(['order_id'], 'idx_order_items_order');
          table.index(['product_id'], 'idx_order_items_product');
          table.index(['product_id', 'created_at'], 'idx_order_items_product_timeline');
        });
      }
    }),

    // Bling integration indexes
    knex.schema.hasTable('bling_sync_log').then(function(exists) {
      if (exists) {
        return knex.schema.table('bling_sync_log', function(table) {
          table.index(['tenant_id', 'sync_type'], 'idx_bling_sync_tenant_type');
          table.index(['status'], 'idx_bling_sync_status');
          table.index(['created_at'], 'idx_bling_sync_created');
        });
      }
    }),

    // Analytics and reporting indexes
    knex.schema.hasTable('analytics_events').then(function(exists) {
      if (exists) {
        return knex.schema.table('analytics_events', function(table) {
          table.index(['tenant_id', 'event_type', 'created_at'], 'idx_analytics_tenant_type_time');
          table.index(['product_id', 'event_type'], 'idx_analytics_product_events');
          table.index(['session_id'], 'idx_analytics_session');
        });
      }
    }),

    // Billing and subscription indexes
    knex.schema.hasTable('subscriptions').then(function(exists) {
      if (exists) {
        return knex.schema.table('subscriptions', function(table) {
          table.index(['tenant_id', 'status'], 'idx_subscriptions_tenant_status');
          table.index(['plan_id'], 'idx_subscriptions_plan');
          table.index(['expires_at'], 'idx_subscriptions_expiry');
        });
      }
    }),

    // User and authentication indexes
    knex.schema.hasTable('users').then(function(exists) {
      if (exists) {
        return knex.schema.table('users', function(table) {
          table.index(['tenant_id', 'is_active'], 'idx_users_tenant_active');
          table.index(['email'], 'idx_users_email');
          table.index(['created_at'], 'idx_users_created');
        });
      }
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    // Drop products indexes
    knex.schema.table('products', function(table) {
      table.dropIndex(['tenant_id', 'is_active'], 'idx_products_tenant_active');
      table.dropIndex(['category_id', 'is_active'], 'idx_products_category_active');
      table.dropIndex(['tenant_id', 'name'], 'idx_products_tenant_name');
      table.dropIndex(['tenant_id', 'sku'], 'idx_products_tenant_sku');
      table.dropIndex(['tenant_id', 'price', 'is_active'], 'idx_products_price_range');
      table.dropIndex(['tenant_id', 'created_at'], 'idx_products_tenant_created');
      table.dropIndex(['tenant_id', 'updated_at'], 'idx_products_tenant_updated');
      table.dropIndex(['tenant_id', 'views_count'], 'idx_products_popularity');
      table.dropIndex(['tenant_id', 'stock_quantity'], 'idx_products_stock');
    }),

    // Drop full-text search index if PostgreSQL
    knex.client.config.client === 'postgresql' ? 
      knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_products_fulltext_search') : 
      Promise.resolve(),

    // Drop categories indexes
    knex.schema.table('categories', function(table) {
      table.dropIndex(['tenant_id', 'parent_id'], 'idx_categories_hierarchy');
      table.dropIndex(['tenant_id', 'is_active', 'sort_order'], 'idx_categories_active_sorted');
      table.dropIndex(['tenant_id', 'slug'], 'idx_categories_tenant_slug');
    }),

    // Drop variants indexes
    knex.schema.table('product_variants', function(table) {
      table.dropIndex(['product_id', 'is_active'], 'idx_variants_product_active');
      table.dropIndex(['tenant_id', 'sku'], 'idx_variants_tenant_sku');
      table.dropIndex(['tenant_id', 'price'], 'idx_variants_price');
    }),

    // Drop images indexes
    knex.schema.table('product_images', function(table) {
      table.dropIndex(['product_id', 'is_primary'], 'idx_images_product_primary');
      table.dropIndex(['product_id', 'is_active', 'sort_order'], 'idx_images_active_sorted');
      table.dropIndex(['processing_status'], 'idx_images_processing');
      table.dropIndex(['created_at'], 'idx_images_created');
    }),

    // Drop stock movements indexes
    knex.schema.table('stock_movements', function(table) {
      table.dropIndex(['product_id', 'created_at'], 'idx_stock_product_timeline');
      table.dropIndex(['tenant_id', 'movement_type'], 'idx_stock_tenant_type');
      table.dropIndex(['created_at'], 'idx_stock_created');
    })

    // Note: Other conditional index drops would need individual handling
  ]);
};