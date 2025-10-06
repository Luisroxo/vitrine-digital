/**
 * Migration 012 - Sistema de Billing Simplificado
 * Implementa cobrança mensal sem comissões
 * Modelo: Fornecedor STARTER + Lojista STANDARD
 */
exports.up = function(knex) {
  return Promise.all([
    
    // 1. Tabela de Planos (Apenas 2 planos)
    knex.schema.createTable('billing_plans', function(table) {
      table.increments('id').primary();
      table.string('name', 50).notNullable().unique(); // 'STARTER' ou 'STANDARD'
      table.enu('target_type', ['supplier', 'retailer']).notNullable();
      table.integer('price_cents').notNullable(); // Preço em centavos
      table.integer('setup_fee_cents').defaultTo(0); // Setup fee em centavos
      table.json('features').nullable(); // Features do plano em JSON
      table.json('limits').nullable(); // Limites do plano
      table.boolean('active').defaultTo(true);
      table.text('description').nullable();
      table.timestamps(true, true);
      
      table.index(['target_type', 'active']);
    }),

    // 2. Tabela de Assinaturas por Tenant
    knex.schema.createTable('billing_subscriptions', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.integer('plan_id').unsigned().notNullable();
      table.string('stripe_subscription_id').nullable(); // ID no Stripe
      table.string('stripe_customer_id').nullable(); // Customer no Stripe
      table.enu('status', ['trial', 'active', 'past_due', 'canceled', 'suspended']).defaultTo('trial');
      table.date('trial_ends_at').nullable();
      table.date('current_period_start').nullable();
      table.date('current_period_end').nullable();
      table.date('canceled_at').nullable();
      table.text('cancellation_reason').nullable();
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.foreign('plan_id').references('id').inTable('billing_plans');
      table.unique(['tenant_id']); // Um tenant = uma assinatura
      table.index(['status']);
      table.index(['current_period_end']);
    }),

    // 3. Tabela de Faturas
    knex.schema.createTable('billing_invoices', function(table) {
      table.increments('id').primary();
      table.integer('subscription_id').unsigned().notNullable();
      table.string('stripe_invoice_id').nullable();
      table.string('invoice_number').notNullable(); // Número sequencial
      table.integer('amount_cents').notNullable();
      table.integer('tax_cents').defaultTo(0); // ISS, PIS/COFINS
      table.integer('total_cents').notNullable();
      table.enu('status', ['draft', 'open', 'paid', 'void', 'uncollectible']).defaultTo('draft');
      table.date('due_date').notNullable();
      table.date('paid_at').nullable();
      table.json('line_items').nullable(); // Detalhes da cobrança
      table.text('notes').nullable();
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('subscription_id').references('id').inTable('billing_subscriptions').onDelete('CASCADE');
      table.unique(['invoice_number']);
      table.index(['status', 'due_date']);
      table.index(['subscription_id']);
    }),

    // 4. Tabela de Pagamentos
    knex.schema.createTable('billing_payments', function(table) {
      table.increments('id').primary();
      table.integer('invoice_id').unsigned().notNullable();
      table.string('stripe_payment_intent_id').nullable();
      table.integer('amount_cents').notNullable();
      table.enu('method', ['card', 'pix', 'boleto', 'bank_transfer']).notNullable();
      table.enu('status', ['pending', 'processing', 'succeeded', 'failed', 'canceled']).defaultTo('pending');
      table.string('gateway').defaultTo('stripe'); // stripe, pagarme, etc
      table.json('gateway_response').nullable(); // Resposta completa do gateway
      table.text('failure_reason').nullable();
      table.date('processed_at').nullable();
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('invoice_id').references('id').inTable('billing_invoices').onDelete('CASCADE');
      table.index(['status']);
      table.index(['method']);
      table.index(['processed_at']);
    }),

    // 5. Tabela de Uso/Métricas (para futuras cobranças por uso)
    knex.schema.createTable('billing_usage', function(table) {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('metric_name', 100).notNullable(); // 'retailers', 'orders', 'products'
      table.integer('quantity').notNullable();
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.json('metadata').nullable(); // Dados extras
      table.timestamps(true, true);
      
      // Foreign keys e índices
      table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
      table.index(['tenant_id', 'metric_name', 'period_start']);
      table.index(['period_start', 'period_end']);
    })

  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('billing_usage'),
    knex.schema.dropTableIfExists('billing_payments'),
    knex.schema.dropTableIfExists('billing_invoices'),
    knex.schema.dropTableIfExists('billing_subscriptions'),
    knex.schema.dropTableIfExists('billing_plans')
  ]);
};