/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('credit_transactions', (table) => {
    table.string('transaction_id').primary();
    table.string('tenant_id').notNullable();
    table.enum('type', [
      'purchase', 'consumption', 'bonus', 'refund', 
      'adjustment', 'subscription_included', 'promotion'
    ]).notNullable();
    table.integer('amount').notNullable(); // In cents (negative for consumption)
    table.integer('balance_before').notNullable(); // In cents
    table.integer('balance_after').notNullable(); // In cents
    table.text('description');
    table.string('reference_id'); // payment_id, subscription_id, etc.
    table.string('reference_type'); // payment, subscription, manual, etc.
    table.json('metadata');
    table.timestamps(true, true);
    
    table.foreign('tenant_id').references('tenant_id').inTable('credit_balances');
    table.index(['tenant_id']);
    table.index(['type']);
    table.index(['reference_id']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('credit_transactions');
};