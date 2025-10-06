/**
 * Migration: Create Products Table
 * 
 * Esta migration cria a tabela básica de produtos que será usada
 * pelo sistema multi-tenant.
 */

exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    // Primary Key
    table.increments('id').primary();
    
    // Informações básicas do produto
    table.string('name').notNullable()
      .comment('Nome do produto');
    table.text('description')
      .comment('Descrição detalhada do produto');
    table.string('sku')
      .comment('Código SKU do produto');
    table.string('ean')
      .comment('Código EAN/Barras');
    
    // Categoria
    table.string('category')
      .comment('Categoria do produto');
    
    // Preços
    table.decimal('price', 10, 2).notNullable()
      .comment('Preço de venda');
    table.decimal('cost_price', 10, 2)
      .comment('Preço de custo');
    table.decimal('promotional_price', 10, 2)
      .comment('Preço promocional');
    table.boolean('has_promotion').defaultTo(false)
      .comment('Se o produto está em promoção');
    
    // Estoque
    table.integer('stock_quantity').defaultTo(0)
      .comment('Quantidade em estoque');
    table.integer('min_stock').defaultTo(0)
      .comment('Estoque mínimo');
    table.boolean('track_stock').defaultTo(true)
      .comment('Se deve controlar estoque');
    
    // Dimensões e peso
    table.decimal('weight', 8, 3)
      .comment('Peso em kg');
    table.decimal('length', 8, 2)
      .comment('Comprimento em cm');
    table.decimal('width', 8, 2)
      .comment('Largura em cm');
    table.decimal('height', 8, 2)
      .comment('Altura em cm');
    
    // Imagens
    table.string('image_url')
      .comment('URL da imagem principal');
    table.json('images')
      .comment('Array de URLs de imagens adicionais');
    
    // Status
    table.boolean('active').defaultTo(true)
      .comment('Se o produto está ativo');
    table.boolean('featured').defaultTo(false)
      .comment('Se o produto é destaque');
    
    // Estatísticas
    table.integer('views').defaultTo(0)
      .comment('Visualizações do produto');
    table.integer('sales_count').defaultTo(0)
      .comment('Quantidade vendida');
    table.decimal('rating', 3, 2).defaultTo(0)
      .comment('Avaliação média (0-5)');
    table.integer('reviews_count').defaultTo(0)
      .comment('Número de avaliações');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index(['sku']);
    table.index(['category']);
    table.index(['active']);
    table.index(['featured']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};