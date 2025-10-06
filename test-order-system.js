const db = require('./backend/src/database/connection');

async function testOrderSystem() {
  try {
    console.log('🔍 Verificando configuração multi-tenant...\n');
    
    // Verificar tenants
    const tenants = await db('tenants').select();
    console.log(`✅ ${tenants.length} tenants encontrados:`);
    tenants.forEach(tenant => {
      console.log(`   - ${tenant.name} (${tenant.slug}) - Status: ${tenant.status}`);
    });
    console.log();
    
    // Verificar domínios
    const domains = await db('domains')
      .select('domains.*', 'tenants.name as tenant_name')
      .join('tenants', 'domains.tenant_id', 'tenants.id');
    
    console.log(`🌐 ${domains.length} domínios configurados:`);
    domains.forEach(domain => {
      console.log(`   - ${domain.domain} → ${domain.tenant_name} (${domain.status})`);
    });
    console.log();
    
    // Verificar se as tabelas de pedidos existem
    const tables = await db.raw(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%order%'
      ORDER BY name
    `);
    
    console.log('📋 Tabelas de pedidos encontradas:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    console.log();
    
    // Teste de criação de pedido para o primeiro tenant
    if (tenants.length > 0) {
      const tenant = tenants[0];
      console.log(`🧪 Testando criação de pedido para: ${tenant.name}\n`);
      
      const orderData = {
        tenant_id: tenant.id,
        customer_name: 'João Silva - Teste',
        customer_email: 'joao.silva@teste.com',
        customer_phone: '(11) 99999-9999',
        customer_document: '12345678901',
        shipping_address: JSON.stringify({
          street: 'Rua das Flores, 123',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipcode: '01000-000'
        }),
        subtotal: 30000, // R$ 300,00
        shipping_cost: 1500, // R$ 15,00
        discount: 0,
        total: 31500, // R$ 315,00
        payment_method: 'credit_card',
        status: 'pending',
        payment_status: 'pending',
        notes: 'Pedido criado automaticamente para teste do sistema',
        order_number: `ORD-${Date.now()}`,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Inserir pedido
      const [orderId] = await db('orders').insert(orderData);
      console.log(`✅ Pedido criado com ID: ${orderId}`);
      console.log(`📄 Número do pedido: ${orderData.order_number}`);
      console.log(`💰 Total: R$ ${(orderData.total / 100).toFixed(2)}`);
      
      // Inserir itens do pedido
      const orderItems = [
        {
          order_id: orderId,
          tenant_id: tenant.id,
          product_id: 1,
          product_name: 'Produto Teste 1',
          quantity: 2,
          unit_price: 15000, // R$ 150,00
          total: 30000, // R$ 300,00
          created_at: new Date()
        }
      ];
      
      await db('order_items').insert(orderItems);
      console.log(`✅ ${orderItems.length} item(s) adicionado(s) ao pedido`);
      
      // Inserir histórico de status
      await db('order_status_history').insert({
        order_id: orderId,
        tenant_id: tenant.id,
        status: 'pending',
        comment: 'Pedido criado automaticamente para teste',
        changed_by: 'system',
        created_at: new Date()
      });
      
      console.log('✅ Histórico de status criado');
      console.log();
      
      // Verificar pedido criado
      const createdOrder = await db('orders')
        .where('id', orderId)
        .first();
      
      console.log('📊 Resumo do pedido criado:');
      console.log(`   - ID: ${createdOrder.id}`);
      console.log(`   - Número: ${createdOrder.order_number}`);
      console.log(`   - Cliente: ${createdOrder.customer_name}`);
      console.log(`   - Email: ${createdOrder.customer_email}`);
      console.log(`   - Status: ${createdOrder.status}`);
      console.log(`   - Total: R$ ${(createdOrder.total / 100).toFixed(2)}`);
      console.log(`   - Tenant: ${tenant.name}`);
      console.log();
      
      console.log('🎉 Sistema de pedidos multi-tenant funcionando perfeitamente!');
      console.log('🔗 Acesse http://localhost:3000/admin para ver a interface administrativa');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await db.destroy();
  }
}

testOrderSystem();