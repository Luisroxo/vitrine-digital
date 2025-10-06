/**
 * Migration: Add Tenant ID to Existing Tables
 * 
 * Esta migration adiciona o campo tenant_id às tabelas existentes
 * para suportar a arquitetura multi-tenant.
 */

exports.up = function(knex) {
  return Promise.all([
    // Adicionar tenant_id à tabela de produtos (se existir)
    knex.schema.hasTable('products').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('products', function(table) {
          table.integer('tenant_id').unsigned().nullable()
            .references('id').inTable('tenants').onDelete('CASCADE');
          table.index(['tenant_id']);
        });
      }
    }),

    // Adicionar tenant_id à tabela de configurações do Bling (se existir)
    knex.schema.hasTable('bling_config').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('bling_config', function(table) {
          table.integer('tenant_id').unsigned().nullable()
            .references('id').inTable('tenants').onDelete('CASCADE');
          table.index(['tenant_id']);
        });
      }
    }),

    // Adicionar tenant_id à tabela de usuários (se existir)
    knex.schema.hasTable('users').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('users', function(table) {
          table.integer('tenant_id').unsigned().nullable()
            .references('id').inTable('tenants').onDelete('CASCADE');
          table.enu('role', ['admin', 'owner', 'manager', 'lojista'])
            .defaultTo('lojista');
          table.index(['tenant_id']);
          table.index(['role']);
        });
      }
    }),

    // Criar tabela de relacionamento tenant-lojista
    knex.schema.createTable('tenant_lojistas', function(table) {
      table.increments('id').primary();
      
      // Foreign Keys
      table.integer('tenant_id').unsigned().notNullable()
        .references('id').inTable('tenants').onDelete('CASCADE');
      
      // Informações do lojista
      table.string('lojista_name').notNullable()
        .comment('Nome do lojista');
      table.string('lojista_email').notNullable()
        .comment('Email do lojista');
      table.string('lojista_phone')
        .comment('Telefone do lojista');
      table.string('lojista_document')
        .comment('CPF/CNPJ do lojista');
      
      // Configurações Bling do lojista
      table.string('bling_client_id')
        .comment('Client ID do Bling do lojista');
      table.text('bling_access_token')
        .comment('Token de acesso do Bling (criptografado)');
      table.text('bling_refresh_token')
        .comment('Refresh token do Bling (criptografado)');
      table.timestamp('bling_expires_at')
        .comment('Expiração do token Bling');
      
      // Status da conexão
      table.enu('status', ['pending', 'active', 'suspended', 'disconnected'])
        .defaultTo('pending')
        .comment('Status da conexão com o fornecedor');
      table.timestamp('connected_at')
        .comment('Quando se conectou ao fornecedor');
      table.timestamp('last_sync_at')
        .comment('Última sincronização de produtos');
      
      // Estatísticas
      table.integer('synced_products').defaultTo(0)
        .comment('Quantidade de produtos sincronizados');
      table.integer('total_orders').defaultTo(0)
        .comment('Total de pedidos processados');
      table.decimal('total_revenue', 15, 2).defaultTo(0)
        .comment('Receita total gerada');
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
      
      // Indexes
      table.index(['tenant_id']);
      table.index(['lojista_email']);
      table.index(['status']);
      
      // Unique constraint (lojista pode se conectar a múltiplos fornecedores)
      table.unique(['tenant_id', 'lojista_email']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    // Remover tenant_id das tabelas existentes
    knex.schema.hasTable('products').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('products', function(table) {
          table.dropColumn('tenant_id');
        });
      }
    }),

    knex.schema.hasTable('bling_config').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('bling_config', function(table) {
          table.dropColumn('tenant_id');
        });
      }
    }),

    knex.schema.hasTable('users').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('users', function(table) {
          table.dropColumn('tenant_id');
          table.dropColumn('role');
        });
      }
    }),

    // Dropar tabela de relacionamento
    knex.schema.dropTable('tenant_lojistas')
  ]);
};