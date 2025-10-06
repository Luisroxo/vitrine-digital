/**
 * Migração para sistema completo de temas (White Label)
 * Cria tabelas para personalização visual avançada
 */
exports.up = function(knex) {
  return Promise.all([
    
    // Tabela principal de temas
    knex.schema.createTable('themes', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.json('theme_config').notNullable(); // Configuração completa do tema
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Foreign key
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      
      // Índices
      table.unique(['tenant_id']); // Um tema por tenant
      table.index(['tenant_id']);
    }),

    // Tabela de assets (imagens, logos, etc)
    knex.schema.createTable('theme_assets', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('asset_type', 50).notNullable(); // logo, background, icon, banner
      table.string('file_name', 255).notNullable();
      table.string('original_name', 255).notNullable();
      table.string('file_path', 500).notNullable();
      table.string('mime_type', 100).notNullable();
      table.integer('file_size').unsigned().notNullable(); // em bytes
      table.integer('width').unsigned(); // para imagens
      table.integer('height').unsigned(); // para imagens
      table.json('metadata'); // metadata adicional
      table.boolean('active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Foreign key
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      
      // Índices
      table.index(['tenant_id', 'asset_type']);
      table.index(['tenant_id', 'active']);
      table.unique(['tenant_id', 'asset_type', 'file_name']); // Evita duplicatas
    }),

    // Tabela de versões de tema (histórico)
    knex.schema.createTable('theme_versions', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.integer('theme_id').unsigned().notNullable();
      table.integer('version_number').unsigned().notNullable().defaultTo(1);
      table.json('theme_config').notNullable();
      table.text('changelog'); // descrição das mudanças
      table.string('created_by', 100); // usuário que criou
      table.boolean('is_published').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Foreign keys
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.foreign('theme_id').references('id').inTable('themes').onDelete('CASCADE');
      
      // Índices
      table.index(['tenant_id', 'theme_id']);
      table.index(['tenant_id', 'is_published']);
      table.unique(['theme_id', 'version_number']); // Versões únicas por tema
    }),

    // Tabela de templates disponíveis
    knex.schema.createTable('theme_templates', function(table) {
      table.increments('id').primary();
      table.string('template_id', 50).unique().notNullable();
      table.string('name', 100).notNullable();
      table.text('description');
      table.string('category', 50).notNullable(); // basic, ecommerce, minimal, premium
      table.json('default_config').notNullable(); // configuração padrão
      table.string('preview_image', 500); // URL da imagem de preview
      table.json('features'); // lista de recursos do template
      table.boolean('is_premium').defaultTo(false);
      table.decimal('price', 10, 2); // preço se premium
      table.boolean('active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Índices
      table.index(['category', 'active']);
      table.index(['is_premium', 'active']);
    })

  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('theme_templates'),
    knex.schema.dropTableIfExists('theme_versions'),
    knex.schema.dropTableIfExists('theme_assets'),
    knex.schema.dropTableIfExists('themes')
  ]);
};