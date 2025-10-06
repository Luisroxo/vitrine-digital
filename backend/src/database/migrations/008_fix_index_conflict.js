/**
 * Migration corretiva para resolver conflitos de índices
 * Remove todos os índices conflitantes antes da migration 009
 */
exports.up = function(knex) {
  return knex.schema.raw(`
    DROP INDEX IF EXISTS products_tenant_id_bling_integration_id_index;
    DROP INDEX IF EXISTS products_tenant_id_bling_sync_index;
    DROP INDEX IF EXISTS products_tenant_id_category_index;
    DROP INDEX IF EXISTS products_tenant_id_status_index;
    DROP INDEX IF EXISTS products_tenant_id_featured_index;
  `);
};

exports.down = function(knex) {
  // Não precisa reverter - os índices serão recriados na migration 009
  return Promise.resolve();
};