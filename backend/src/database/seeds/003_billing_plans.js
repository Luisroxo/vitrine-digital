/**
 * Seed 003 - Planos de Billing Simplificados
 * Apenas 2 planos: STARTER (fornecedor) e STANDARD (lojista)
 */
exports.seed = async function(knex) {
  // Limpar dados existentes
  await knex('billing_plans').del();

  // Inserir os 2 planos únicos
  await knex('billing_plans').insert([
    {
      id: 1,
      name: 'STARTER',
      target_type: 'supplier',
      price_cents: 49900, // R$ 499,00
      setup_fee_cents: 99900, // R$ 999,00
      features: JSON.stringify({
        white_label: true,
        custom_domain: 1,
        unlimited_retailers: true,
        bling_integration: true,
        order_management: true,
        partnership_system: true,
        basic_support: true,
        analytics: 'basic'
      }),
      limits: JSON.stringify({
        domains: 1,
        retailers: -1, // ilimitado
        products: -1, // ilimitado
        orders_per_month: -1, // ilimitado
        storage_gb: 10
      }),
      description: 'Plano completo para fornecedores com lojistas ilimitados',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      name: 'STANDARD',
      target_type: 'retailer',
      price_cents: 9900, // R$ 99,00
      setup_fee_cents: 0, // Grátis
      features: JSON.stringify({
        bling_sync: true,
        product_sync: true,
        inventory_sync: true,
        order_sync: true,
        partnership_chat: true,
        basic_dashboard: true,
        email_support: true
      }),
      limits: JSON.stringify({
        partnership: 1, // apenas 1 fornecedor
        products: -1, // ilimitado (vem do fornecedor)
        orders_per_month: -1, // ilimitado
        api_calls: 10000 // 10k calls/mês
      }),
      description: 'Plano para lojistas com sincronização Bling completa',
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  console.log('✅ Planos de billing criados:');
  console.log('   - STARTER (Fornecedor): R$ 499/mês + R$ 999 setup');
  console.log('   - STANDARD (Lojista): R$ 99/mês');
};