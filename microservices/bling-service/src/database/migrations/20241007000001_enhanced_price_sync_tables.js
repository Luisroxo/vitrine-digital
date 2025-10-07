/**
 * Migration: Enhanced Price Sync Tables
 * 
 * Cria tabelas necessárias para o sistema avançado de sincronização de preços
 * incluindo histórico, políticas, conflitos e cache.
 */

exports.up = function(knex) {
  return knex.schema
    // Atualizar tabela de produtos para suportar mais campos de preço
    .alterTable('products', table => {
      table.decimal('cost_price', 10, 2).nullable();
      table.decimal('sale_price', 10, 2).nullable();
      table.decimal('promotional_price', 10, 2).nullable();
      table.decimal('wholesale_price', 10, 2).nullable();
      table.decimal('margin_percent', 5, 2).nullable();
      table.decimal('markup_percent', 5, 2).nullable();
      table.timestamp('price_updated_at').nullable();
      table.timestamp('last_bling_sync').nullable();
      table.string('price_sync_status').defaultTo('pending');
      table.text('sync_notes').nullable();
    })
    
    // Tabela de histórico de preços
    .createTable('price_history', table => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      table.decimal('old_price', 10, 2).nullable();
      table.decimal('new_price', 10, 2).nullable();
      table.decimal('old_cost_price', 10, 2).nullable();
      table.decimal('new_cost_price', 10, 2).nullable();
      table.decimal('old_sale_price', 10, 2).nullable();
      table.decimal('new_sale_price', 10, 2).nullable();
      table.string('change_source').notNullable(); // 'bling_sync', 'manual', 'policy', 'webhook'
      table.string('change_reason').nullable();
      table.text('change_details').nullable();
      table.integer('changed_by').unsigned().nullable(); // user_id
      table.timestamps(true, true);
      
      table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.index(['product_id', 'created_at']);
      table.index(['tenant_id', 'created_at']);
      table.index('change_source');
    })
    
    // Tabela de políticas de preço
    .createTable('product_price_policies', table => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().nullable();
      table.integer('category_id').unsigned().nullable();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('type').notNullable(); // 'markup', 'discount', 'fixed_margin', 'minimum_price', 'maximum_price'
      table.decimal('value', 10, 2).notNullable();
      table.text('description').nullable();
      table.boolean('active').defaultTo(true);
      table.integer('priority').defaultTo(0); // Para ordenação de aplicação
      table.json('conditions').nullable(); // Condições adicionais
      table.integer('created_by').unsigned().nullable();
      table.timestamps(true, true);
      
      table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.index(['product_id', 'active']);
      table.index(['category_id', 'active']);
      table.index(['tenant_id', 'active']);
      table.index('type');
    })
    
    // Tabela de conflitos de preço
    .createTable('price_conflicts', table => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      table.decimal('bling_price', 10, 2).notNullable();
      table.decimal('local_price', 10, 2).notNullable();
      table.decimal('difference', 10, 2).notNullable();
      table.decimal('difference_percent', 5, 2).notNullable();
      table.string('conflict_type').notNullable(); // 'concurrent_modification', 'policy_mismatch', 'data_inconsistency'
      table.text('conflict_details').nullable();
      table.boolean('resolved').defaultTo(false);
      table.string('resolution_type').nullable(); // 'bling', 'local', 'custom'
      table.decimal('resolution_price', 10, 2).nullable();
      table.integer('resolved_by').unsigned().nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamps(true, true);
      
      table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.index(['product_id', 'resolved']);
      table.index(['tenant_id', 'resolved']);
      table.index('conflict_type');
      table.index('created_at');
    })
    
    // Tabela de cache de preços
    .createTable('price_cache', table => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('cache_key').notNullable().unique();
      table.json('price_data').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamps(true, true);
      
      table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.index('cache_key');
      table.index('expires_at');
      table.index(['tenant_id', 'expires_at']);
    })
    
    // Tabela de métricas de sincronização
    .createTable('sync_metrics', table => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().nullable();
      table.string('metric_type').notNullable(); // 'sync_duration', 'products_synced', 'errors', 'cache_hits'
      table.decimal('metric_value', 15, 4).notNullable();
      table.string('metric_unit').nullable(); // 'ms', 'count', 'percent'
      table.json('metadata').nullable();
      table.timestamp('measured_at').notNullable();
      table.timestamps(true, true);
      
      table.index(['metric_type', 'measured_at']);
      table.index(['tenant_id', 'metric_type', 'measured_at']);
    })
    
    // Tabela de logs de sincronização
    .createTable('sync_logs', table => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().nullable();
      table.string('sync_type').notNullable(); // 'manual', 'automatic', 'webhook', 'bulk'
      table.string('status').notNullable(); // 'started', 'completed', 'failed', 'partial'
      table.integer('products_total').defaultTo(0);
      table.integer('products_synced').defaultTo(0);
      table.integer('products_updated').defaultTo(0);
      table.integer('products_failed').defaultTo(0);
      table.integer('duration_ms').nullable();
      table.text('error_message').nullable();
      table.json('sync_details').nullable();
      table.integer('initiated_by').unsigned().nullable(); // user_id
      table.timestamps(true, true);
      
      table.index(['tenant_id', 'created_at']);
      table.index(['sync_type', 'status']);
      table.index('created_at');
    })
    
    // Tabela de configurações de sincronização por tenant
    .createTable('sync_configurations', table => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable().unique();
      table.integer('batch_size').defaultTo(50);
      table.integer('sync_interval_ms').defaultTo(900000); // 15 minutos
      table.boolean('enable_cache').defaultTo(true);
      table.boolean('enable_notifications').defaultTo(true);
      table.boolean('enable_auto_sync').defaultTo(true);
      table.string('conflict_resolution').defaultTo('bling_wins');
      table.decimal('price_tolerance_percent', 5, 2).defaultTo(0.5);
      table.boolean('auto_markup').defaultTo(false);
      table.decimal('markup_percentage', 5, 2).defaultTo(0);
      table.json('notification_settings').nullable();
      table.json('custom_policies').nullable();
      table.timestamps(true, true);
      
      table.index('tenant_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('sync_configurations')
    .dropTableIfExists('sync_logs')
    .dropTableIfExists('sync_metrics')
    .dropTableIfExists('price_cache')
    .dropTableIfExists('price_conflicts')
    .dropTableIfExists('product_price_policies')
    .dropTableIfExists('price_history')
    .alterTable('products', table => {
      table.dropColumn('cost_price');
      table.dropColumn('sale_price');
      table.dropColumn('promotional_price');
      table.dropColumn('wholesale_price');
      table.dropColumn('margin_percent');
      table.dropColumn('markup_percent');
      table.dropColumn('price_updated_at');
      table.dropColumn('last_bling_sync');
      table.dropColumn('price_sync_status');
      table.dropColumn('sync_notes');
    });
};