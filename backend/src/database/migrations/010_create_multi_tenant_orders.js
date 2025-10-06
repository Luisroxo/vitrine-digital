/**
 * Migration: Sistema de Pedidos Multi-Tenant
 * Cria estrutura completa de pedidos isolada por tenant
 */
exports.up = function(knex) {
  return knex.schema
    // Tabela de pedidos principal
    .createTable('orders', table => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      table.string('order_number').notNullable();
      table.string('external_id').nullable(); // ID no sistema externo (Bling, etc)
      
      // Status do pedido
      table.enum('status', [
        'pending',           // Aguardando pagamento
        'confirmed',         // Confirmado
        'processing',        // Processando
        'shipped',           // Enviado
        'delivered',         // Entregue
        'cancelled',         // Cancelado
        'refunded'           // Reembolsado
      ]).defaultTo('pending');
      
      // Informações do cliente
      table.string('customer_name').notNullable();
      table.string('customer_email').notNullable();
      table.string('customer_phone').nullable();
      table.string('customer_document').nullable();
      
      // Endereço de entrega
      table.json('shipping_address').notNullable();
      
      // Valores
      table.decimal('subtotal', 10, 2).notNullable();
      table.decimal('shipping_cost', 10, 2).defaultTo(0);
      table.decimal('discount', 10, 2).defaultTo(0);
      table.decimal('total', 10, 2).notNullable();
      
      // Pagamento
      table.enum('payment_method', [
        'credit_card', 'debit_card', 'pix', 'bank_slip', 'paypal', 'other'
      ]).nullable();
      table.enum('payment_status', [
        'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'
      ]).defaultTo('pending');
      table.string('payment_id').nullable(); // ID do pagamento no gateway
      table.json('payment_data').nullable(); // Dados adicionais do pagamento
      
      // Rastreamento
      table.string('tracking_code').nullable();
      table.string('shipping_company').nullable();
      table.datetime('shipped_at').nullable();
      table.datetime('delivered_at').nullable();
      
      // Observações
      table.text('notes').nullable();
      table.json('metadata').nullable(); // Dados adicionais
      
      // Timestamps
      table.timestamps(true, true);
      
      // Índices
      table.index(['tenant_id', 'status']);
      table.index(['tenant_id', 'customer_email']);
      table.index(['tenant_id', 'created_at']);
      table.index('order_number');
      table.unique(['tenant_id', 'order_number']);
      
      // Foreign keys
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
    })
    
    // Itens dos pedidos
    .createTable('order_items', table => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable();
      table.integer('product_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      
      // Informações do produto (snapshot no momento da compra)
      table.string('product_name').notNullable();
      table.string('product_sku').nullable();
      table.string('product_image').nullable();
      table.json('product_data').nullable(); // Dados completos do produto
      
      // Quantidades e valores
      table.integer('quantity').notNullable();
      table.decimal('unit_price', 10, 2).notNullable();
      table.decimal('total_price', 10, 2).notNullable();
      
      // Timestamps
      table.timestamps(true, true);
      
      // Índices
      table.index(['order_id']);
      table.index(['product_id']);
      table.index(['tenant_id']);
      
      // Foreign keys
      table.foreign('order_id').references('orders.id').onDelete('CASCADE');
      table.foreign('product_id').references('products.id').onDelete('RESTRICT');
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
    })
    
    // Histórico de status dos pedidos
    .createTable('order_status_history', table => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      
      table.string('status').notNullable();
      table.string('previous_status').nullable();
      table.text('comment').nullable();
      table.string('updated_by').nullable(); // Sistema, usuário, webhook, etc
      table.json('metadata').nullable();
      
      table.timestamps(true, true);
      
      // Índices
      table.index(['order_id', 'created_at']);
      table.index(['tenant_id', 'created_at']);
      
      // Foreign keys
      table.foreign('order_id').references('orders.id').onDelete('CASCADE');
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
    })
    
    // Configurações de pedidos por tenant
    .createTable('order_settings', table => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().notNullable();
      
      // Configurações gerais
      table.string('order_prefix').defaultTo('PED'); // Prefixo do número do pedido
      table.integer('next_order_number').defaultTo(1);
      table.boolean('auto_confirm').defaultTo(false);
      table.boolean('auto_process').defaultTo(false);
      
      // Configurações de pagamento
      table.json('payment_gateways').nullable(); // Gateways habilitados
      table.json('payment_settings').nullable(); // Configurações específicas
      
      // Configurações de envio
      table.decimal('default_shipping_cost', 10, 2).defaultTo(0);
      table.json('shipping_options').nullable();
      table.boolean('calculate_shipping').defaultTo(false);
      
      // Notificações
      table.boolean('notify_customer').defaultTo(true);
      table.boolean('notify_admin').defaultTo(true);
      table.json('email_templates').nullable();
      
      // Integração externa
      table.boolean('send_to_bling').defaultTo(false);
      table.json('bling_settings').nullable();
      
      table.timestamps(true, true);
      
      // Foreign key
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
      table.unique('tenant_id');
    })
    
    // Notificações de pedidos
    .createTable('order_notifications', table => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().notNullable();
      table.integer('tenant_id').unsigned().notNullable();
      
      table.enum('type', [
        'order_created', 'payment_confirmed', 'order_shipped', 
        'order_delivered', 'order_cancelled', 'payment_failed'
      ]).notNullable();
      
      table.enum('channel', ['email', 'sms', 'webhook', 'system']).notNullable();
      table.string('recipient').notNullable(); // Email, phone, URL, etc
      table.enum('status', ['pending', 'sent', 'failed', 'delivered']).defaultTo('pending');
      
      table.text('subject').nullable();
      table.text('message').nullable();
      table.json('data').nullable(); // Dados da notificação
      table.text('error_message').nullable();
      table.datetime('sent_at').nullable();
      
      table.timestamps(true, true);
      
      // Índices
      table.index(['order_id']);
      table.index(['tenant_id', 'status']);
      table.index(['type', 'channel']);
      
      // Foreign keys
      table.foreign('order_id').references('orders.id').onDelete('CASCADE');
      table.foreign('tenant_id').references('tenants.id').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('order_notifications')
    .dropTableIfExists('order_settings')
    .dropTableIfExists('order_status_history')
    .dropTableIfExists('order_items')
    .dropTableIfExists('orders');
};