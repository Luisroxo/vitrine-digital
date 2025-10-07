/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Criar índices compostos para performance
    knex.schema.table('products', table => {
      table.index(['tenant_id', 'category_id', 'is_active'], 'products_tenant_category_active_idx');
      table.index(['tenant_id', 'is_featured', 'is_active'], 'products_tenant_featured_active_idx');
      table.index(['price', 'is_active'], 'products_price_active_idx');
      table.index(['stock_quantity', 'manage_stock'], 'products_stock_management_idx');
      table.index(['created_at', 'is_active'], 'products_created_active_idx');
    }),

    knex.schema.table('categories', table => {
      table.index(['tenant_id', 'parent_id', 'is_active'], 'categories_tenant_parent_active_idx');
      table.index(['sort_order', 'is_active'], 'categories_sort_active_idx');
    }),

    knex.schema.table('product_variants', table => {
      table.index(['product_id', 'is_active'], 'variants_product_active_idx');
      table.index(['stock_quantity'], 'variants_stock_idx');
    }),

    // Criar tabela para logs de alterações de estoque
    knex.schema.createTable('stock_movements', table => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().nullable();
      table.integer('variant_id').unsigned().nullable();
      table.integer('tenant_id').notNullable();
      table.enum('type', ['in', 'out', 'adjustment', 'sync']).notNullable();
      table.integer('quantity').notNullable(); // Pode ser negativo para saídas
      table.integer('previous_stock').notNullable();
      table.integer('new_stock').notNullable();
      table.string('reason').nullable(); // 'sale', 'purchase', 'adjustment', 'bling_sync'
      table.string('reference_id').nullable(); // ID do pedido, compra, etc.
      table.json('metadata').nullable(); // Dados adicionais
      table.timestamps(true, true);

      // Foreign keys
      table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.foreign('variant_id').references('id').inTable('product_variants').onDelete('CASCADE');

      // Indexes
      table.index('tenant_id');
      table.index('product_id');
      table.index('variant_id');
      table.index('type');
      table.index('created_at');
      table.index(['tenant_id', 'created_at']);
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('stock_movements'),
    
    knex.schema.table('product_variants', table => {
      table.dropIndex(['product_id', 'is_active'], 'variants_product_active_idx');
      table.dropIndex(['stock_quantity'], 'variants_stock_idx');
    }),

    knex.schema.table('categories', table => {
      table.dropIndex(['tenant_id', 'parent_id', 'is_active'], 'categories_tenant_parent_active_idx');
      table.dropIndex(['sort_order', 'is_active'], 'categories_sort_active_idx');
    }),

    knex.schema.table('products', table => {
      table.dropIndex(['tenant_id', 'category_id', 'is_active'], 'products_tenant_category_active_idx');
      table.dropIndex(['tenant_id', 'is_featured', 'is_active'], 'products_tenant_featured_active_idx');
      table.dropIndex(['price', 'is_active'], 'products_price_active_idx');
      table.dropIndex(['stock_quantity', 'manage_stock'], 'products_stock_management_idx');
      table.dropIndex(['created_at', 'is_active'], 'products_created_active_idx');
    })
  ]);
};