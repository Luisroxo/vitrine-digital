/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('products', function(table) {
    // Campos de integração com Bling
    table.integer('bling_id').nullable().unique().comment('ID do produto no Bling ERP');
    table.string('codigo').nullable().comment('Código/SKU do produto');
    table.integer('estoque').defaultTo(0).comment('Quantidade em estoque');
    table.boolean('ativo').defaultTo(true).comment('Produto ativo/inativo');
    table.json('bling_data').nullable().comment('Dados completos do Bling (JSON)');
    
    // Campos adicionais para e-commerce
    table.decimal('preco_promocional', 10, 2).nullable().comment('Preço promocional');
    table.string('categoria').nullable().comment('Categoria do produto');
    table.text('descricao_completa').nullable().comment('Descrição detalhada');
    table.string('marca').nullable().comment('Marca do produto');
    table.decimal('peso', 8, 3).nullable().comment('Peso em kg');
    table.string('gtin').nullable().comment('Código GTIN/EAN');
    
    // Timestamps para controle
    table.timestamps(true, true);
    
    // Índices para performance
    table.index('bling_id');
    table.index('codigo');
    table.index('categoria');
    table.index('ativo');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('products', function(table) {
    // Remove campos adicionados
    table.dropColumn('bling_id');
    table.dropColumn('codigo');
    table.dropColumn('estoque');
    table.dropColumn('ativo');
    table.dropColumn('bling_data');
    table.dropColumn('preco_promocional');
    table.dropColumn('categoria');
    table.dropColumn('descricao_completa');
    table.dropColumn('marca');
    table.dropColumn('peso');
    table.dropColumn('gtin');
    table.dropTimestamps();
  });
};