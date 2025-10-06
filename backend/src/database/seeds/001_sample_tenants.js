/**
 * Seed: Create Sample Tenants
 * 
 * Este seed cria tenants de exemplo para testar o sistema multi-tenant
 */

const crypto = require('crypto');

exports.seed = async function(knex) {
  // Limpar dados existentes
  await knex('tenant_lojistas').del();
  await knex('domains').del();
  await knex('tenant_configs').del();
  await knex('tenants').del();

  // Tenants de exemplo
  const tenants = [
    {
      id: 1,
      slug: 'distribuidora-abc',
      name: 'João Silva',
      email: 'joao@distribuidora-abc.com.br',
      phone: '(11) 98765-4321',
      company_name: 'Distribuidora ABC Ltda',
      document: '12.345.678/0001-90',
      address: 'Rua das Flores, 123 - São Paulo/SP',
      status: 'active',
      plan: 'pro',
      monthly_fee: 799.00,
      setup_fee: 1499.00,
      max_domains: 3,
      max_lojistas: -1,
      max_products: -1,
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
      settings: JSON.stringify({
        notifications: true,
        auto_sync: true,
        backup_enabled: true
      }),
      integrations: JSON.stringify({
        bling: {
          client_id: 'test_client_id_abc',
          active: false
        },
        kommo: {
          account_id: null,
          active: false
        }
      })
    },
    {
      id: 2,
      slug: 'cosmeticos-premium',
      name: 'Maria Oliveira',
      email: 'maria@cosmeticospremium.com.br',
      phone: '(21) 99888-7777',
      company_name: 'Cosméticos Premium Ltda',
      document: '98.765.432/0001-10',
      address: 'Av. Copacabana, 456 - Rio de Janeiro/RJ',
      status: 'active',
      plan: 'enterprise',
      monthly_fee: 1299.00,
      setup_fee: 2499.00,
      max_domains: -1,
      max_lojistas: -1,
      max_products: -1,
      next_billing_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // +25 dias
      settings: JSON.stringify({
        notifications: true,
        auto_sync: true,
        backup_enabled: true,
        analytics: true
      }),
      integrations: JSON.stringify({
        bling: {
          client_id: 'test_client_id_premium',
          active: false
        },
        kommo: {
          account_id: 'premium_kommo_123',
          active: true
        }
      })
    },
    {
      id: 3,
      slug: 'tech-store',
      name: 'Carlos Santos',
      email: 'carlos@techstore.com.br',
      phone: '(31) 97777-6666',
      company_name: 'Tech Store Eletrônicos ME',
      document: '11.222.333/0001-44',
      address: 'Rua da Tecnologia, 789 - Belo Horizonte/MG',
      status: 'pending',
      plan: 'starter',
      monthly_fee: 499.00,
      setup_fee: 999.00,
      max_domains: 1,
      max_lojistas: 5,
      max_products: 500,
      next_billing_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // +35 dias
      settings: JSON.stringify({
        notifications: false,
        auto_sync: false,
        backup_enabled: false
      }),
      integrations: JSON.stringify({
        bling: {
          client_id: null,
          active: false
        },
        kommo: {
          account_id: null,
          active: false
        }
      })
    }
  ];

  // Inserir tenants
  await knex('tenants').insert(tenants);

  // Configurações de branding para cada tenant
  const configs = [
    {
      tenant_id: 1,
      brand_name: 'Distribuidora ABC',
      brand_slogan: 'Qualidade em Distribuição',
      brand_description: 'A Distribuidora ABC oferece os melhores produtos para revenda com preços competitivos e qualidade garantida.',
      logo_url: 'https://via.placeholder.com/200x80/3B82F6/FFFFFF?text=ABC',
      primary_color: '#3B82F6',
      secondary_color: '#10B981',
      accent_color: '#F59E0B',
      background_color: '#FFFFFF',
      font_family: 'Inter',
      meta_title: 'Distribuidora ABC - Produtos para Revenda',
      meta_description: 'Encontre os melhores produtos para revenda na Distribuidora ABC. Qualidade garantida e preços competitivos.',
      meta_keywords: 'distribuidora, revenda, produtos, atacado, abc',
      contact_email: 'contato@distribuidora-abc.com.br',
      contact_phone: '(11) 98765-4321',
      contact_whatsapp: '5511987654321',
      social_instagram: '@distribuidoraabc',
      about_company: 'A Distribuidora ABC atua há mais de 15 anos no mercado oferecendo produtos de qualidade para lojistas de todo Brasil.',
      is_published: true,
      published_at: knex.fn.now()
    },
    {
      tenant_id: 2,
      brand_name: 'Cosméticos Premium',
      brand_slogan: 'Beleza que Transforma',
      brand_description: 'Cosméticos Premium oferece produtos de alta qualidade para realçar sua beleza natural.',
      logo_url: 'https://via.placeholder.com/200x80/EC4899/FFFFFF?text=Premium',
      primary_color: '#EC4899',
      secondary_color: '#8B5CF6',
      accent_color: '#F59E0B',
      background_color: '#FDF2F8',
      font_family: 'Poppins',
      meta_title: 'Cosméticos Premium - Beleza que Transforma',
      meta_description: 'Descubra nossa linha completa de cosméticos premium para todos os tipos de pele.',
      meta_keywords: 'cosméticos, beleza, premium, maquiagem, skincare',
      contact_email: 'contato@cosmeticospremium.com.br',
      contact_phone: '(21) 99888-7777',
      contact_whatsapp: '5521998887777',
      social_instagram: '@cosmeticospremium',
      social_facebook: 'https://facebook.com/cosmeticospremium',
      about_company: 'Cosméticos Premium é referência em beleza, oferecendo produtos inovadores e de alta qualidade há mais de 10 anos.',
      is_published: true,
      published_at: knex.fn.now()
    },
    {
      tenant_id: 3,
      brand_name: 'Tech Store',
      brand_slogan: 'Tecnologia ao seu Alcance',
      brand_description: 'Tech Store oferece os melhores produtos eletrônicos com preços acessíveis.',
      logo_url: 'https://via.placeholder.com/200x80/1F2937/FFFFFF?text=TechStore',
      primary_color: '#1F2937',
      secondary_color: '#3B82F6',
      accent_color: '#10B981',
      background_color: '#F9FAFB',
      font_family: 'Roboto',
      meta_title: 'Tech Store - Eletrônicos e Tecnologia',
      meta_description: 'Encontre smartphones, notebooks, tablets e muito mais na Tech Store.',
      meta_keywords: 'eletrônicos, tecnologia, smartphones, notebooks, tablets',
      contact_email: 'contato@techstore.com.br',
      contact_phone: '(31) 97777-6666',
      about_company: 'Tech Store é sua loja de confiança para produtos eletrônicos de qualidade.',
      is_published: false
    }
  ];

  // Inserir configurações
  await knex('tenant_configs').insert(configs);

  // Domínios para os tenants
  const domains = [
    {
      tenant_id: 1,
      domain: 'distribuidora-abc.com.br',
      dns_status: 'active',
      ssl_status: 'issued',
      cname_target: 'engine.vitrine360.com.br',
      verification_token: crypto.randomBytes(32).toString('hex'),
      is_primary: true,
      status: 'active',
      verified_at: knex.fn.now(),
      last_check_at: knex.fn.now(),
      ssl_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // +90 dias
    },
    {
      tenant_id: 2,
      domain: 'cosmeticospremium.com.br',
      dns_status: 'active',
      ssl_status: 'issued',
      cname_target: 'engine.vitrine360.com.br',
      verification_token: crypto.randomBytes(32).toString('hex'),
      is_primary: true,
      status: 'active',
      verified_at: knex.fn.now(),
      last_check_at: knex.fn.now(),
      ssl_expires_at: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000) // +85 dias
    },
    {
      tenant_id: 2,
      domain: 'loja.cosmeticospremium.com.br',
      dns_status: 'pending',
      ssl_status: 'pending',
      cname_target: 'engine.vitrine360.com.br',
      verification_token: crypto.randomBytes(32).toString('hex'),
      is_primary: false,
      status: 'setup'
    },
    {
      tenant_id: 3,
      domain: 'techstore.com.br',
      dns_status: 'pending',
      ssl_status: 'pending',
      cname_target: 'engine.vitrine360.com.br',
      verification_token: crypto.randomBytes(32).toString('hex'),
      is_primary: true,
      status: 'setup'
    }
  ];

  // Inserir domínios
  await knex('domains').insert(domains);

  // Lojistas conectados
  const lojistas = [
    {
      tenant_id: 1,
      lojista_name: 'Ana Costa',
      lojista_email: 'ana@lojadaana.com.br',
      lojista_phone: '(11) 95555-4444',
      lojista_document: '123.456.789-01',
      status: 'active',
      connected_at: knex.fn.now(),
      last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // -2 horas
      synced_products: 45,
      total_orders: 12,
      total_revenue: 2350.80
    },
    {
      tenant_id: 1,
      lojista_name: 'Pedro Souza',
      lojista_email: 'pedro@vendasonline.com',
      lojista_phone: '(11) 94444-3333',
      lojista_document: '987.654.321-09',
      status: 'active',
      connected_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // -7 dias
      last_sync_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // -1 hora
      synced_products: 32,
      total_orders: 8,
      total_revenue: 1680.50
    },
    {
      tenant_id: 2,
      lojista_name: 'Juliana Lima',
      lojista_email: 'juliana@belezastore.com',
      lojista_phone: '(21) 93333-2222',
      lojista_document: '456.789.123-45',
      status: 'active',
      connected_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // -3 dias
      last_sync_at: new Date(Date.now() - 30 * 60 * 1000), // -30 min
      synced_products: 68,
      total_orders: 25,
      total_revenue: 4890.30
    },
    {
      tenant_id: 3,
      lojista_name: 'Rafael Tech',
      lojista_email: 'rafael@techvendas.com',
      lojista_phone: '(31) 92222-1111',
      lojista_document: '789.123.456-78',
      status: 'pending',
      connected_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // -1 dia
      synced_products: 0,
      total_orders: 0,
      total_revenue: 0
    }
  ];

  // Inserir lojistas
  await knex('tenant_lojistas').insert(lojistas);

  console.log('✅ Seeds executados com sucesso!');
  console.log('📊 Dados criados:');
  console.log('   - 3 Tenants (Distribuidora ABC, Cosméticos Premium, Tech Store)');
  console.log('   - 4 Domínios configurados');
  console.log('   - 4 Lojistas conectados');
  console.log('   - Configurações de branding completas');
};