/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_sessions', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_jti').unique().notNullable();
    table.string('refresh_token').unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.string('ip_address').nullable();
    table.string('user_agent').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    // Indexes
    table.index('user_id');
    table.index('token_jti');
    table.index('refresh_token');
    table.index('expires_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_sessions');
};