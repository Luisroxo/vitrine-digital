/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('categories', table => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.text('description').nullable();
    table.string('image_url').nullable();
    table.integer('parent_id').unsigned().nullable();
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.integer('tenant_id').nullable();
    table.timestamps(true, true);

    // Foreign key and indexes
    table.foreign('parent_id').references('id').inTable('categories').onDelete('SET NULL');
    table.index('slug');
    table.index('tenant_id');
    table.index('parent_id');
    table.index('is_active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('categories');
};