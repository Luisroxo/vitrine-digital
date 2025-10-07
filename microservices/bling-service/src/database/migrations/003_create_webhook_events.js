/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('webhook_events', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('tenant_id').notNullable();
    table.uuid('connection_id').references('id').inTable('bling_connections').onDelete('CASCADE');
    table.string('event_type').notNullable(); // product.created, order.updated, etc.
    table.string('bling_event_id').nullable(); // ID do evento no Bling
    table.jsonb('payload').notNullable(); // Dados do webhook
    table.string('status').defaultTo('pending'); // pending, processed, failed, ignored
    table.text('processing_error').nullable();
    table.integer('retry_count').defaultTo(0);
    table.timestamp('processed_at').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index('tenant_id');
    table.index('connection_id');
    table.index('event_type');
    table.index('status');
    table.index('bling_event_id');
    table.index('created_at');
    
    // Constraint para evitar duplicatas
    table.unique(['connection_id', 'bling_event_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('webhook_events');
};