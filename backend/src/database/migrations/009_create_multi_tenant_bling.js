/**
 * Migração para Multi-Tenant Bling Integration
 * Isola completamente as configurações Bling por tenant
 */
exports.up = function(knex) {
  return Promise.all([
    
    // 1. Criar nova tabela bling_integrations (isolada por tenant)
    knex.schema.createTable('bling_integrations', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      
      // Credenciais da aplicação Bling (por tenant)
      table.string('client_id').notNullable().comment('Client ID específico do tenant');
      table.string('client_secret').notNullable().comment('Client Secret específico do tenant');
      
      // Tokens OAuth2
      table.text('access_token').nullable().comment('Token de acesso atual');
      table.text('refresh_token').nullable().comment('Token de renovação');
      table.timestamp('token_expires_at').nullable().comment('Data de expiração do token');
      
      // Dados da empresa no Bling
      table.string('company_name').nullable().comment('Nome da empresa no Bling');
      table.string('company_cnpj').nullable().comment('CNPJ da empresa');
      table.string('company_id').nullable().comment('ID da empresa no Bling');
      
      // Configurações de sincronização
      table.boolean('sync_enabled').defaultTo(true).comment('Sincronização automática habilitada');
      table.timestamp('last_sync_at').nullable().comment('Última sincronização realizada');
      table.json('sync_settings').nullable().comment('Configurações específicas de sync');
      
      // Webhook específico por tenant
      table.string('webhook_url').nullable().comment('URL do webhook configurada no Bling');
      table.string('webhook_key').nullable().comment('Chave de verificação do webhook');
      table.json('webhook_config').nullable().comment('Configurações de webhook');
      
      // Status da integração
      table.enu('status', ['pending', 'active', 'error', 'suspended']).defaultTo('pending');
      table.text('last_error').nullable().comment('Último erro ocorrido');
      table.timestamp('last_error_at').nullable().comment('Data do último erro');
      
      // Estatísticas
      table.integer('products_synced').defaultTo(0).comment('Total de produtos sincronizados');
      table.integer('orders_created').defaultTo(0).comment('Total de pedidos enviados');
      table.timestamp('first_sync_at').nullable().comment('Data da primeira sincronização');
      
      table.timestamps(true, true);
      
      // Foreign key e índices
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.unique(['tenant_id']); // Um Bling por tenant
      table.index(['tenant_id', 'status']);
      table.index(['sync_enabled']);
    }),

    // 2. Criar tabela de logs de sincronização por tenant
    knex.schema.createTable('bling_sync_logs', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.integer('integration_id').unsigned().notNullable();
      
      // Detalhes da operação
      table.enu('operation', ['sync_products', 'create_order', 'update_stock', 'webhook', 'auth']).notNullable();
      table.enu('status', ['success', 'error', 'warning']).notNullable();
      table.text('message').nullable();
      table.json('details').nullable().comment('Detalhes da operação (JSON)');
      
      // Resultados
      table.integer('records_processed').defaultTo(0);
      table.integer('records_success').defaultTo(0);
      table.integer('records_error').defaultTo(0);
      
      // Timing
      table.integer('duration_ms').nullable().comment('Duração em millisegundos');
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();
      
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.foreign('integration_id').references('id').inTable('bling_integrations').onDelete('CASCADE');
      table.index(['tenant_id', 'operation']);
      table.index(['tenant_id', 'status']);
      table.index(['created_at']);
    }),

    // 3. Atualizar tabela products para melhor isolamento
    knex.schema.hasTable('products').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('products', function(table) {
          // Garantir que tenant_id está presente (pode já existir da migração anterior)
          // Adicionar referência à integração específica
          table.integer('bling_integration_id').unsigned().nullable()
            .comment('Referência à integração Bling específica');
          
          // Melhorar campos de sincronização
          table.json('bling_sync_metadata').nullable()
            .comment('Metadata da sincronização (conflitos, warnings, etc)');
          table.timestamp('bling_last_updated').nullable()
            .comment('Data da última atualização no Bling');
          table.boolean('bling_has_conflicts').defaultTo(false)
            .comment('Se há conflitos de sincronização');
        });
      }
    }).then(function() {
      // Criar índices separadamente para evitar conflitos
      return knex.raw(`
        CREATE INDEX IF NOT EXISTS products_tenant_bling_integration_idx ON products (tenant_id, bling_integration_id);
        CREATE INDEX IF NOT EXISTS products_tenant_bling_sync_idx ON products (tenant_id, bling_sync);  
        CREATE INDEX IF NOT EXISTS products_bling_conflicts_idx ON products (bling_has_conflicts);
      `);
    }),

    // 4. Criar tabela de mapeamento de categorias por tenant
    knex.schema.createTable('bling_category_mappings', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.integer('integration_id').unsigned().notNullable();
      
      // Mapeamento Bling → Vitrine
      table.integer('bling_category_id').notNullable();
      table.string('bling_category_name').notNullable();
      table.string('vitrine_category').notNullable().comment('Categoria mapeada na vitrine');
      
      // Configurações
      table.boolean('active').defaultTo(true);
      table.json('mapping_rules').nullable().comment('Regras específicas de mapeamento');
      
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.foreign('integration_id').references('id').inTable('bling_integrations').onDelete('CASCADE');
      table.unique(['tenant_id', 'bling_category_id']); // Categoria única por tenant
      table.index(['tenant_id', 'active']);
    })

  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('bling_category_mappings'),
    knex.schema.dropTableIfExists('bling_sync_logs'),
    knex.schema.hasTable('products').then(function(exists) {
      if (exists) {
        return knex.schema.alterTable('products', function(table) {
          table.dropColumn('bling_integration_id');
          table.dropColumn('bling_sync_metadata');
          table.dropColumn('bling_last_updated');
          table.dropColumn('bling_has_conflicts');
        });
      }
    }),
    knex.schema.dropTableIfExists('bling_integrations')
  ]);
};