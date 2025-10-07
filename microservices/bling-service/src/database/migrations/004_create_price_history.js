/**
 * Migration: Add Bling Price History Table
 * 
 * This migration creates a table to track price changes from Bling ERP
 * enabling price history tracking and audit trails.
 */

exports.up = function(knex) {
  return knex.schema.createTable('bling_price_history', function(table) {
    // Primary key
    table.increments('id').primary();
    
    // Tenant and product identification
    table.integer('tenant_id').notNullable();
    table.string('bling_product_id').notNullable();
    table.string('product_sku').nullable();
    table.integer('local_product_id').nullable(); // Reference to local products table
    
    // Price information
    table.decimal('old_price', 10, 2).nullable();
    table.decimal('new_price', 10, 2).notNullable();
    table.decimal('price_change_percent', 5, 2).nullable();
    table.decimal('price_difference', 10, 2).nullable();
    
    // Sync metadata
    table.string('sync_source').defaultTo('automatic'); // automatic, webhook, manual
    table.string('sync_type').nullable(); // full_sync, incremental, webhook_update
    table.string('sync_job_id').nullable(); // Reference to sync job if applicable
    table.boolean('sync_successful').defaultTo(true);
    table.text('sync_error').nullable();
    
    // Additional context
    table.json('metadata').nullable(); // Store additional sync information
    table.json('bling_response').nullable(); // Store original Bling API response
    table.string('correlation_id').nullable(); // For tracking requests
    
    // Audit fields
    table.integer('created_by').nullable(); // User ID who triggered manual sync
    table.timestamps(true, true);
    
    // Indexes for performance
    table.index(['tenant_id', 'bling_product_id'], 'idx_price_history_tenant_product');
    table.index(['tenant_id', 'created_at'], 'idx_price_history_tenant_date');
    table.index(['tenant_id', 'local_product_id'], 'idx_price_history_tenant_local_product');
    table.index('sync_source', 'idx_price_history_sync_source');
    table.index('sync_job_id', 'idx_price_history_sync_job');
    table.index('created_at', 'idx_price_history_created_at');
    
    // Composite index for efficient price history queries
    table.index(['tenant_id', 'bling_product_id', 'created_at'], 'idx_price_history_product_timeline');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('bling_price_history');
};