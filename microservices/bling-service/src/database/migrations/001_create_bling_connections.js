/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('bling_connections', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('tenant_id').notNullable();
    table.string('client_id').notNullable();
    table.text('client_secret_encrypted').notNullable();
    table.text('access_token_encrypted').nullable();
    table.text('refresh_token_encrypted').nullable();
    table.timestamp('token_expires_at').nullable();
    table.jsonb('scopes').nullable();
    table.string('status').defaultTo('pending'); // pending, active, expired, revoked
    table.timestamp('last_sync_at').nullable();
    table.jsonb('sync_errors').nullable();
    table.integer('error_count').defaultTo(0);
    table.timestamps(true, true);
    
    // Indexes
    table.index('tenant_id');
    table.index('status');
    table.index('last_sync_at');
    
    // Constraints
    table.unique(['tenant_id', 'client_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('bling_connections');
};