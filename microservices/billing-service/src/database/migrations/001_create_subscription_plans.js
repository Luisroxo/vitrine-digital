/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('subscription_plans', (table) => {
    table.string('plan_id').primary();
    table.string('name').notNullable();
    table.text('description');
    table.integer('price').notNullable(); // In cents
    table.string('currency', 3).defaultTo('BRL');
    table.enum('interval', ['daily', 'weekly', 'monthly', 'yearly']).defaultTo('monthly');
    table.integer('credits_included').defaultTo(0);
    table.json('features');
    table.json('limits');
    table.integer('trial_days').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.json('metadata');
    table.timestamps(true, true);
    
    table.index(['is_active']);
    table.index(['price']);
    table.index(['interval']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('subscription_plans');
};