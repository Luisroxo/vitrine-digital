/**
 * Migration para tabela de dados de sincronização do Bling
 * Armazena snapshot dos dados do Bling para comparação e detecção de conflitos
 */

exports.up = function(knex) {
  return knex.schema.createTable('bling_sync_data', function(table) {
    table.increments('id').primary();
    
    // Identificação
    table.string('bling_product_id', 100).notNullable();
    table.integer('tenant_id').notNullable();
    
    // Dados do produto no Bling
    table.string('name', 500).nullable();
    table.text('description').nullable();
    table.decimal('price', 10, 2).nullable();
    table.integer('stock_quantity').nullable();
    table.string('sku', 100).nullable();
    table.string('barcode', 50).nullable();
    table.json('images').nullable();
    table.json('variations').nullable();
    table.json('categories').nullable();
    
    // Status e controle
    table.boolean('active').defaultTo(true);
    table.string('status', 50).nullable();
    table.json('raw_data').nullable(); // dados completos da API Bling
    
    // Controle de sincronização
    table.timestamp('last_sync_at').defaultTo(knex.fn.now());
    table.timestamp('bling_updated_at').nullable(); // timestamp do Bling
    table.string('sync_version', 50).nullable();
    table.json('sync_metadata').nullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Índices para performance
    table.index(['tenant_id', 'bling_product_id']);
    table.index(['tenant_id', 'active']);
    table.index(['last_sync_at']);
    table.index(['bling_updated_at']);
    table.unique(['bling_product_id', 'tenant_id']);
    
    // Foreign key para tenant
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('bling_sync_data');
};