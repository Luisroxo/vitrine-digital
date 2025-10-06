/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('bling_config', function(table) {
    table.increments('id');
    table.string('client_id').notNullable().comment('Client ID da aplicação Bling');
    table.string('client_secret').notNullable().comment('Client Secret da aplicação Bling');
    table.text('access_token').nullable().comment('Token de acesso atual');
    table.text('refresh_token').nullable().comment('Token de renovação');
    table.timestamp('token_expires_at').nullable().comment('Data de expiração do token');
    table.string('company_name').nullable().comment('Nome da empresa no Bling');
    table.string('company_cnpj').nullable().comment('CNPJ da empresa');
    table.json('webhook_config').nullable().comment('Configurações de webhook');
    table.boolean('sync_enabled').defaultTo(false).comment('Sincronização automática habilitada');
    table.timestamp('last_sync_at').nullable().comment('Última sincronização realizada');
    table.json('sync_settings').nullable().comment('Configurações de sincronização');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('bling_config');
};