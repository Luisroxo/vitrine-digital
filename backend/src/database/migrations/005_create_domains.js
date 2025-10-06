/**
 * Migration: Create Domains Table
 * 
 * Esta migration gerencia os domínios personalizados de cada tenant.
 * Suporta múltiplos domínios por tenant (planos enterprise).
 */

exports.up = function(knex) {
  return knex.schema.createTable('domains', function(table) {
    // Primary Key
    table.increments('id').primary();
    
    // Foreign Key para tenant
    table.integer('tenant_id').unsigned().notNullable()
      .references('id').inTable('tenants').onDelete('CASCADE');
    
    // Configuração do domínio
    table.string('domain').unique().notNullable()
      .comment('Domínio completo (ex: fornecedor.com.br)');
    table.string('subdomain')
      .comment('Subdomínio se aplicável (ex: loja.fornecedor.com.br)');
    
    // Status DNS e SSL
    table.enu('dns_status', ['pending', 'active', 'error'])
      .defaultTo('pending')
      .comment('Status da configuração DNS');
    table.enu('ssl_status', ['pending', 'issued', 'expired', 'error'])
      .defaultTo('pending')
      .comment('Status do certificado SSL');
    
    // Configuração técnica
    table.string('cname_target')
      .defaultTo('engine.vitrine360.com.br')
      .comment('Alvo do CNAME para apontar');
    table.text('ssl_certificate')
      .comment('Certificado SSL em formato PEM');
    table.text('ssl_private_key')
      .comment('Chave privada do certificado SSL');
    table.date('ssl_expires_at')
      .comment('Data de expiração do SSL');
    
    // Configurações de verificação
    table.string('verification_token')
      .comment('Token para verificação de propriedade do domínio');
    table.timestamp('verified_at')
      .comment('Quando o domínio foi verificado');
    table.timestamp('last_check_at')
      .comment('Última verificação de DNS/SSL');
    
    // Domínio principal
    table.boolean('is_primary')
      .defaultTo(false)
      .comment('Se é o domínio principal do tenant');
    
    // Status geral
    table.enu('status', ['active', 'inactive', 'setup', 'error'])
      .defaultTo('setup')
      .comment('Status geral do domínio');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index(['tenant_id']);
    table.index(['domain']);
    table.index(['dns_status']);
    table.index(['ssl_status']);
    table.index(['status']);
    table.index(['is_primary']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('domains');
};