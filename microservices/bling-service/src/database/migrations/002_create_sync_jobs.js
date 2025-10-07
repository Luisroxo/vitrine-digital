/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('sync_jobs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('tenant_id').notNullable();
    table.uuid('connection_id').references('id').inTable('bling_connections').onDelete('CASCADE');
    table.string('job_type').notNullable(); // products, orders, contacts, inventory
    table.string('direction').notNullable(); // import, export, bidirectional
    table.string('status').defaultTo('pending'); // pending, processing, completed, failed, cancelled
    table.jsonb('config').nullable(); // Job-specific configuration
    table.jsonb('progress').nullable(); // Progress tracking
    table.jsonb('results').nullable(); // Job results and statistics
    table.text('error_message').nullable();
    table.timestamp('started_at').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    table.timestamp('next_retry_at').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index('tenant_id');
    table.index('connection_id');
    table.index('job_type');
    table.index('status');
    table.index('started_at');
    table.index(['tenant_id', 'job_type', 'status']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('sync_jobs');
};