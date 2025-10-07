/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('permissions', table => {
    table.increments('id').primary();
    table.string('name').unique().notNullable();
    table.string('description').nullable();
    table.string('resource').notNullable(); // e.g., 'products', 'orders', 'billing'
    table.enum('action', ['create', 'read', 'update', 'delete', 'manage']).notNullable();
    table.timestamps(true, true);

    // Composite index for resource + action
    table.index(['resource', 'action']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('permissions');
};