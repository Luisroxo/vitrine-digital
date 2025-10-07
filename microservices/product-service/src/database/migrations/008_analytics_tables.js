exports.up = function(knex) {
  return knex.schema
    // Tabela de visualizações de produtos
    .createTable('product_views', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').notNullable().index();
      table.integer('product_id').notNullable();
      table.integer('user_id').nullable();
      table.string('session_id', 100).notNullable().index();
      table.string('user_agent', 500).defaultTo('');
      table.inet('ip_address').nullable();
      table.string('referrer', 500).defaultTo('');
      table.string('source', 50).defaultTo('web');
      table.timestamp('viewed_at').notNullable().defaultTo(knex.fn.now());
      
      table.index(['tenant_id', 'product_id']);
      table.index(['tenant_id', 'viewed_at']);
      table.index(['tenant_id', 'user_id']);
      
      table.foreign(['tenant_id', 'product_id'])
        .references(['tenant_id', 'id'])
        .inTable('products')
        .onDelete('CASCADE');
    })
    
    // Tabela de consultas de busca
    .createTable('search_queries', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').notNullable().index();
      table.string('query', 200).notNullable();
      table.integer('results_count').notNullable().defaultTo(0);
      table.integer('user_id').nullable();
      table.string('session_id', 100).notNullable();
      table.json('filters').nullable();
      table.timestamp('searched_at').notNullable().defaultTo(knex.fn.now());
      
      table.index(['tenant_id', 'query']);
      table.index(['tenant_id', 'searched_at']);
      table.index(['tenant_id', 'user_id']);
    })

    // Adicionar contador de visualizações na tabela products
    .alterTable('products', function(table) {
      table.integer('view_count').defaultTo(0);
      table.timestamp('last_viewed_at').nullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('products', function(table) {
      table.dropColumn('view_count');
      table.dropColumn('last_viewed_at');
    })
    .dropTableIfExists('search_queries')
    .dropTableIfExists('product_views');
};