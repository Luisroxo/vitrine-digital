/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('role_permissions', table => {
    table.increments('id').primary();
    table.enum('role', ['admin', 'lojista', 'user']).notNullable();
    table.integer('permission_id').unsigned().references('id').inTable('permissions').onDelete('CASCADE');
    table.timestamps(true, true);

    // Composite unique index to prevent duplicate role-permission pairs
    table.unique(['role', 'permission_id']);
    table.index('role');
    table.index('permission_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('role_permissions');
};