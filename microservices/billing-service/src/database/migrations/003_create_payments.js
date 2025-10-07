/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('payments', (table) => {
    table.string('payment_id').primary();
    table.string('tenant_id').notNullable();
    table.integer('amount').notNullable(); // In cents
    table.string('currency', 3).defaultTo('BRL');
    table.enum('method', ['pix', 'credit_card', 'debit_card', 'bank_transfer']).notNullable();
    table.enum('status', ['pending', 'completed', 'failed', 'canceled', 'expired']).defaultTo('pending');
    table.text('description');
    table.string('provider_payment_id');
    table.json('customer_data');
    table.json('provider_data');
    table.datetime('completed_at');
    table.datetime('failed_at');
    table.datetime('expired_at');
    table.text('error_message');
    table.json('metadata');
    table.timestamps(true, true);
    
    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['method']);
    table.index(['provider_payment_id']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('payments');
};