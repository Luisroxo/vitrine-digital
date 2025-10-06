/**
 * Migration: Create Tenants Table
 * 
 * Esta migration cria a tabela base para o sistema multi-tenant.
 * Cada tenant representa um fornecedor com seu próprio domínio white label.
 */

exports.up = function(knex) {
  return knex.schema.createTable('tenants', function(table) {
    // Primary Key
    table.increments('id').primary();
    
    // Identificação única do tenant (slug)
    table.string('slug').unique().notNullable()
      .comment('Identificador único do tenant (ex: distribuidora-abc)');
    
    // Informações básicas
    table.string('name').notNullable()
      .comment('Nome da empresa fornecedora');
    table.string('email').notNullable()
      .comment('Email principal do tenant');
    table.string('phone', 20)
      .comment('Telefone de contato');
    
    // Dados da empresa
    table.string('company_name').notNullable()
      .comment('Razão social da empresa');
    table.string('document', 20)
      .comment('CNPJ/CPF da empresa');
    table.text('address')
      .comment('Endereço completo');
    
    // Status e controle
    table.enu('status', ['active', 'inactive', 'suspended', 'pending'])
      .defaultTo('pending')
      .comment('Status do tenant');
    table.enu('plan', ['starter', 'pro', 'enterprise'])
      .defaultTo('starter')
      .comment('Plano de assinatura');
    
    // Configurações de billing
    table.decimal('monthly_fee', 10, 2)
      .defaultTo(499.00)
      .comment('Valor da mensalidade em R$');
    table.decimal('setup_fee', 10, 2)
      .defaultTo(999.00)
      .comment('Taxa de implantação em R$');
    table.date('next_billing_date')
      .comment('Próxima data de cobrança');
    
    // Limites por plano
    table.integer('max_domains')
      .defaultTo(1)
      .comment('Máximo de domínios permitidos');
    table.integer('max_lojistas')
      .defaultTo(5)
      .comment('Máximo de lojistas conectados');
    table.integer('max_products')
      .defaultTo(500)
      .comment('Máximo de produtos no catálogo');
    
    // Configurações técnicas
    table.json('settings')
      .comment('Configurações diversas em JSON');
    table.json('integrations')
      .comment('Configurações de integrações (Bling, Kommo, etc)');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Soft delete
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index(['status']);
    table.index(['plan']);
    table.index(['slug']);
    table.index(['email']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenants');
};