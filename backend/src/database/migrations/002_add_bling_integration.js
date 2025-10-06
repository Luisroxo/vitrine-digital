/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('products', function(table) {
    // Campos de integração com Bling
    table.integer('bling_id').nullable().unique().comment('ID do produto no Bling ERP');
    table.string('codigo').nullable().comment('Código/SKU do produto no Bling');
    table.integer('estoque_bling').defaultTo(0).comment('Quantidade em estoque do Bling');
    table.boolean('bling_sync').defaultTo(false).comment('Se está sincronizado com Bling');
    table.json('bling_data').nullable().comment('Dados completos do Bling (JSON)');
    
    // Campos adicionais específicos do Bling
    table.string('marca').nullable().comment('Marca do produto');
    table.string('gtin').nullable().comment('Código GTIN/EAN do Bling');
    table.timestamp('last_bling_sync').nullable().comment('Última sincronização com Bling');
    
    // Índices para performance
    table.index('bling_id');
    table.index('codigo');
    table.index('bling_sync');
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