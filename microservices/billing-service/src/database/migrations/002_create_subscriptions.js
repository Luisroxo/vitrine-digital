/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('subscriptions', (table) => {
    table.string('subscription_id').primary();
    table.string('tenant_id').notNullable();
    table.string('plan_id').notNullable();
    table.enum('status', [
      'trialing', 'active', 'past_due', 'canceled', 
      'unpaid', 'cancel_at_period_end', 'paused'
    ]).defaultTo('trialing');
    table.datetime('current_period_start');
    table.datetime('current_period_end');
    table.datetime('trial_start');
    table.datetime('trial_end');
    table.datetime('canceled_at');
    table.boolean('cancel_at_period_end').defaultTo(false);
    table.string('cancellation_reason');
    table.datetime('last_billing_date');
    table.integer('quantity').defaultTo(1);
    table.json('metadata');
    table.timestamps(true, true);
    
    table.foreign('plan_id').references('plan_id').inTable('subscription_plans');
    table.index(['tenant_id']);
    table.index(['status']);
    table.index(['current_period_end']);
    table.index(['trial_end']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('subscriptions');
};