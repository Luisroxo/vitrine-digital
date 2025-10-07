/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('credit_balances', (table) => {
    table.string('tenant_id').primary();
    table.integer('balance').defaultTo(0); // In cents
    table.integer('reserved_credits').defaultTo(0); // In cents
    table.integer('lifetime_credits').defaultTo(0); // In cents
    table.datetime('last_updated');
    table.json('metadata');
    table.timestamps(true, true);
    
    table.index(['balance']);
    table.index(['last_updated']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('credit_balances');
};