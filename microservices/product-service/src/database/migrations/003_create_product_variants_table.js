/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('product_variants', table => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().notNullable();
    table.string('name').notNullable(); // Ex: "Vermelho - P", "Azul - M"
    table.string('sku').nullable();
    table.string('bling_id').nullable();
    table.decimal('price', 10, 2).nullable(); // Se null, usa preço do produto pai
    table.decimal('cost_price', 10, 2).nullable();
    table.integer('stock_quantity').defaultTo(0);
    table.json('attributes').nullable(); // Ex: {"cor": "vermelho", "tamanho": "P"}
    table.string('image_url').nullable(); // Imagem específica da variação
    table.decimal('weight', 8, 3).nullable();
    table.string('dimensions').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');

    // Indexes
    table.index('product_id');
    table.index('sku');
    table.index('bling_id');
    table.index('is_active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('product_variants');
};