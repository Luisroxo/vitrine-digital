/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('product_images', function (table) {
    table.increments('id').primary();
    table.integer('product_id').unsigned().notNullable();
    table.string('original_filename').notNullable();
    table.string('filename').notNullable();
    table.string('mime_type').notNullable();
    table.integer('file_size').notNullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.text('alt_text').nullable();
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_primary').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.json('variants').nullable(); // Stores different sizes/formats
    table.json('metadata').nullable(); // EXIF, color profile, etc.
    table.enum('processing_status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
    table.text('processing_error').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['product_id', 'is_primary']);
    table.index(['product_id', 'is_active']);
    table.index(['processing_status']);
    table.index(['created_at']);
    
    // Foreign key constraint
    table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('product_images');
};