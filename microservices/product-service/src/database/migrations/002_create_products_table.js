/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('products', table => {
    table.increments('id').primary();
    table.integer('tenant_id').notNullable();
    table.string('name').notNullable();
    table.string('slug').notNullable();
    table.text('description').nullable();
    table.text('short_description').nullable();
    table.string('sku').nullable();
    table.string('bling_id').nullable(); // ID do produto no Bling ERP
    table.decimal('price', 10, 2).notNullable().defaultTo(0);
    table.decimal('cost_price', 10, 2).nullable();
    table.decimal('promotional_price', 10, 2).nullable();
    table.integer('stock_quantity').defaultTo(0);
    table.integer('min_stock').defaultTo(0);
    table.boolean('manage_stock').defaultTo(true);
    table.boolean('in_stock').defaultTo(true);
    table.enum('stock_status', ['in_stock', 'out_of_stock', 'on_backorder']).defaultTo('in_stock');
    table.json('images').nullable(); // Array de URLs de imagens
    table.json('attributes').nullable(); // Atributos personalizados (cor, tamanho, etc.)
    table.decimal('weight', 8, 3).nullable();
    table.string('dimensions').nullable(); // "LxWxH"
    table.integer('category_id').unsigned().nullable();
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_featured').defaultTo(false);
    table.datetime('published_at').nullable();
    table.integer('view_count').defaultTo(0);
    table.decimal('rating', 3, 2).nullable();
    table.integer('rating_count').defaultTo(0);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL');

    // Indexes
    table.index('tenant_id');
    table.index('slug');
    table.index('sku');
    table.index('bling_id');
    table.index('category_id');
    table.index('is_active');
    table.index('is_featured');
    table.index('stock_status');
    table.index(['tenant_id', 'slug']);
    table.index(['tenant_id', 'is_active']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('products');
};