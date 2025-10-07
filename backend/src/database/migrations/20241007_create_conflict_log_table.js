/**
 * Migration para tabela de log de conflitos de dados
 * Armazena histórico de conflitos entre sistemas (Bling, Local, etc.)
 */

exports.up = function(knex) {
  return knex.schema.createTable('conflict_log', function(table) {
    table.increments('id').primary();
    
    // Identificação do conflito
    table.string('conflict_id', 255).notNullable().unique();
    table.string('type', 100).notNullable(); // product_data, price_minor, stock_major, etc.
    table.enum('severity', ['low', 'medium', 'high']).notNullable();
    table.enum('status', ['pending', 'resolved', 'ignored']).notNullable();
    
    // Entidade afetada
    table.string('entity_type', 50).notNullable(); // product, order, etc.
    table.integer('entity_id').notNullable();
    table.string('bling_id', 100).nullable();
    table.integer('tenant_id').notNullable();
    
    // Dados em conflito
    table.json('local_data').nullable();
    table.json('bling_data').nullable();
    table.json('differences').nullable(); // array de diferenças específicas
    table.json('metadata').nullable(); // dados adicionais (percentual diferença, etc.)
    
    // Resolução
    table.json('resolution').nullable(); // estratégia e dados da resolução
    table.string('resolved_by', 100).nullable(); // user_id ou 'auto'
    table.enum('resolution_type', ['auto', 'manual']).nullable();
    table.text('resolution_reason').nullable();
    
    // Timestamps
    table.timestamp('detected_at').notNullable();
    table.timestamp('resolved_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Índices para performance
    table.index(['tenant_id', 'status']);
    table.index(['type', 'severity']);
    table.index(['entity_type', 'entity_id']);
    table.index(['detected_at']);
    table.index(['status', 'detected_at']);
    
    // Foreign key para tenant
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('conflict_log');
};