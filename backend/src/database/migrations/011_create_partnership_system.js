/**
 * Migration 011: Partnership System
 * Cria sistema de parcerias 1:1 entre fornecedores e lojistas
 */

exports.up = function(knex) {
  return knex.schema
    // Tabela de convites de parceria
    .createTable('partnership_invitations', table => {
      table.increments('id').primary();
      table.integer('tenant_id').notNullable(); // Fornecedor que convida
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
      
      table.string('invitation_token').notNullable().unique();
      table.string('lojista_name').notNullable();
      table.string('lojista_email').notNullable();
      table.string('lojista_phone');
      table.string('lojista_document');
      table.text('message'); // Mensagem personalizada do fornecedor
      
      table.enu('status', ['pending', 'accepted', 'rejected', 'expired']).defaultTo('pending');
      table.timestamp('expires_at').notNullable();
      table.timestamp('accepted_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index(['tenant_id', 'status']);
      table.index('invitation_token');
      table.index(['lojista_email', 'status']);
    })
    
    // Tabela de parcerias ativas (1:1)
    .createTable('partnerships', table => {
      table.increments('id').primary();
      table.integer('supplier_tenant_id').notNullable(); // Fornecedor
      table.foreign('supplier_tenant_id').references('tenants.id').onDelete('CASCADE');
      
      table.string('lojista_name').notNullable();
      table.string('lojista_email').notNullable().unique(); // 1 lojista = 1 fornecedor
      table.string('lojista_phone');
      table.string('lojista_document');
      table.string('lojista_company');
      
      // Configuração Bling do lojista
      table.text('lojista_bling_client_id');
      table.text('lojista_bling_client_secret');
      table.text('lojista_bling_access_token');
      table.text('lojista_bling_refresh_token');
      table.timestamp('lojista_bling_token_expires_at');
      
      // Configurações da parceria
      table.decimal('commission_percentage', 5, 2).defaultTo(0); // % comissão para o fornecedor
      table.json('sync_settings').defaultTo('{}'); // Configurações de sincronização
      table.string('return_address'); // Endereço único para devoluções
      table.json('partnership_terms'); // Termos específicos da parceria
      
      // Status e controle
      table.enu('status', ['active', 'suspended', 'terminated']).defaultTo('active');
      table.timestamp('last_sync_at');
      table.integer('products_synced').defaultTo(0);
      table.decimal('total_orders_value', 12, 2).defaultTo(0);
      table.integer('total_orders').defaultTo(0);
      
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.index('supplier_tenant_id');
      table.index(['lojista_email', 'status']);
      table.index('status');
    })
    
    // Tabela de sincronização de produtos (Bling para Bling)
    .createTable('partnership_sync_logs', table => {
      table.increments('id').primary();
      table.integer('partnership_id').notNullable();
      table.foreign('partnership_id').references('partnerships.id').onDelete('CASCADE');
      
      table.enu('sync_type', ['products', 'inventory', 'orders', 'full']).notNullable();
      table.enu('direction', ['supplier_to_lojista', 'lojista_to_supplier']).notNullable();
      table.enu('status', ['running', 'completed', 'failed', 'partial']).notNullable();
      
      table.integer('total_items').defaultTo(0);
      table.integer('processed_items').defaultTo(0);
      table.integer('success_items').defaultTo(0);
      table.integer('failed_items').defaultTo(0);
      
      table.json('sync_details'); // Detalhes do processo
      table.text('error_log'); // Log de erros se houver
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at');
      
      table.index(['partnership_id', 'sync_type']);
      table.index(['partnership_id', 'status']);
      table.index('started_at');
    })
    
    // Tabela de comunicação entre parceiros
    .createTable('partnership_messages', table => {
      table.increments('id').primary();
      table.integer('partnership_id').notNullable();
      table.foreign('partnership_id').references('partnerships.id').onDelete('CASCADE');
      
      table.enu('sender_type', ['supplier', 'lojista']).notNullable();
      table.string('sender_name').notNullable();
      table.text('message').notNullable();
      table.enu('message_type', ['general', 'order_related', 'sync_issue', 'support']).defaultTo('general');
      table.integer('related_order_id'); // Se relacionado a um pedido
      
      table.boolean('is_read').defaultTo(false);
      table.timestamp('read_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index(['partnership_id', 'is_read']);
      table.index(['partnership_id', 'message_type']);
      table.index('created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('partnership_messages')
    .dropTableIfExists('partnership_sync_logs')
    .dropTableIfExists('partnerships')
    .dropTableIfExists('partnership_invitations');
};