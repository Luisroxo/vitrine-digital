/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Limpar tabelas existentes
  await knex('stock_movements').del();
  await knex('product_variants').del();
  await knex('products').del();
  await knex('categories').del();

  // Inserir categorias de exemplo
  const categories = await knex('categories').insert([
    {
      id: 1,
      tenant_id: 1,
      name: 'Eletrônicos',
      description: 'Produtos eletrônicos em geral',
      parent_id: null,
      sort_order: 1,
      is_active: true
    },
    {
      id: 2,
      tenant_id: 1,
      name: 'Smartphones',
      description: 'Telefones celulares e smartphones',
      parent_id: 1,
      sort_order: 1,
      is_active: true
    },
    {
      id: 3,
      tenant_id: 1,
      name: 'Laptops',
      description: 'Notebooks e laptops',
      parent_id: 1,
      sort_order: 2,
      is_active: true
    },
    {
      id: 4,
      tenant_id: 1,
      name: 'Roupas',
      description: 'Vestuário em geral',
      parent_id: null,
      sort_order: 2,
      is_active: true
    },
    {
      id: 5,
      tenant_id: 1,
      name: 'Camisetas',
      description: 'Camisetas e blusas',
      parent_id: 4,
      sort_order: 1,
      is_active: true
    }
  ]).returning('id');

  // Inserir produtos de exemplo
  const products = await knex('products').insert([
    {
      id: 1,
      tenant_id: 1,
      category_id: 2,
      name: 'iPhone 15 Pro',
      description: 'Apple iPhone 15 Pro com 128GB de armazenamento, tela Super Retina XDR de 6.1", câmera tripla de 48MP e chip A17 Pro.',
      short_description: 'iPhone 15 Pro 128GB - Titânio Natural',
      sku: 'IPH15P-128-TN',
      bling_id: 'B001',
      price: 7999.00,
      compare_price: 8999.00,
      cost_price: 6500.00,
      stock_quantity: 15,
      min_stock: 5,
      manage_stock: true,
      is_active: true,
      is_featured: true,
      weight: 187,
      dimensions: JSON.stringify({
        length: 146.6,
        width: 70.6,
        height: 8.25
      }),
      images: JSON.stringify([
        'https://example.com/iphone15pro-1.jpg',
        'https://example.com/iphone15pro-2.jpg'
      ]),
      tags: JSON.stringify(['apple', 'iphone', 'smartphone', 'premium']),
      seo: JSON.stringify({
        title: 'iPhone 15 Pro 128GB Titânio Natural - Loja Online',
        description: 'Compre o iPhone 15 Pro com melhor preço. Câmera profissional, performance excepcional.',
        keywords: ['iphone 15 pro', 'apple', 'smartphone', 'titânio']
      })
    },
    {
      id: 2,
      tenant_id: 1,
      category_id: 2,
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Samsung Galaxy S24 Ultra com 256GB, tela Dynamic AMOLED 2X de 6.8", câmera de 200MP e S Pen integrada.',
      short_description: 'Galaxy S24 Ultra 256GB - Preto Titânio',
      sku: 'SGS24U-256-PT',
      bling_id: 'B002',
      price: 6999.00,
      compare_price: 7999.00,
      cost_price: 5800.00,
      stock_quantity: 8,
      min_stock: 3,
      manage_stock: true,
      is_active: true,
      is_featured: true,
      weight: 232,
      dimensions: JSON.stringify({
        length: 162.3,
        width: 79.0,
        height: 8.6
      }),
      images: JSON.stringify([
        'https://example.com/galaxy-s24-ultra-1.jpg',
        'https://example.com/galaxy-s24-ultra-2.jpg'
      ]),
      tags: JSON.stringify(['samsung', 'galaxy', 'smartphone', 's-pen'])
    },
    {
      id: 3,
      tenant_id: 1,
      category_id: 3,
      name: 'MacBook Air M3',
      description: 'Apple MacBook Air com chip M3, tela Liquid Retina de 13.6", 8GB RAM e 256GB SSD.',
      short_description: 'MacBook Air M3 13" 256GB - Cinza Espacial',
      sku: 'MBA-M3-256-CE',
      bling_id: 'B003',
      price: 12999.00,
      compare_price: 13999.00,
      cost_price: 10500.00,
      stock_quantity: 5,
      min_stock: 2,
      manage_stock: true,
      is_active: true,
      is_featured: false,
      weight: 1240,
      dimensions: JSON.stringify({
        length: 304.1,
        width: 215.0,
        height: 11.3
      }),
      images: JSON.stringify([
        'https://example.com/macbook-air-m3-1.jpg'
      ]),
      tags: JSON.stringify(['apple', 'macbook', 'laptop', 'm3'])
    },
    {
      id: 4,
      tenant_id: 1,
      category_id: 5,
      name: 'Camiseta Básica Algodão',
      description: 'Camiseta básica 100% algodão, corte regular, ideal para o dia a dia.',
      short_description: 'Camiseta Básica - Branca',
      sku: 'CAM-BAS-BR-M',
      price: 29.90,
      compare_price: 39.90,
      cost_price: 15.00,
      stock_quantity: 50,
      min_stock: 10,
      manage_stock: true,
      is_active: true,
      is_featured: false,
      weight: 150,
      images: JSON.stringify([
        'https://example.com/camiseta-basica-branca.jpg'
      ]),
      tags: JSON.stringify(['camiseta', 'algodão', 'básica', 'casual'])
    },
    {
      id: 5,
      tenant_id: 1,
      category_id: 5,
      name: 'Camiseta Premium Dry Fit',
      description: 'Camiseta esportiva com tecnologia dry fit, tecido que elimina o suor rapidamente.',
      short_description: 'Camiseta Dry Fit - Preta',
      sku: 'CAM-DRY-PR-G',
      price: 59.90,
      cost_price: 25.00,
      stock_quantity: 0, // Produto sem estoque para teste
      min_stock: 5,
      manage_stock: true,
      is_active: true,
      is_featured: false,
      weight: 120,
      images: JSON.stringify([
        'https://example.com/camiseta-dry-fit-preta.jpg'
      ]),
      tags: JSON.stringify(['camiseta', 'esporte', 'dry-fit', 'academia'])
    }
  ]).returning('id');

  // Inserir variantes de produto (para camisetas com tamanhos)
  await knex('product_variants').insert([
    // Variantes da Camiseta Básica
    {
      id: 1,
      tenant_id: 1,
      product_id: 4,
      name: 'Camiseta Básica - Branca P',
      sku: 'CAM-BAS-BR-P',
      stock_quantity: 15,
      attributes: JSON.stringify({
        size: 'P',
        color: 'Branco'
      }),
      is_active: true
    },
    {
      id: 2,
      tenant_id: 1,
      product_id: 4,
      name: 'Camiseta Básica - Branca M',
      sku: 'CAM-BAS-BR-M',
      stock_quantity: 20,
      attributes: JSON.stringify({
        size: 'M',
        color: 'Branco'
      }),
      is_active: true
    },
    {
      id: 3,
      tenant_id: 1,
      product_id: 4,
      name: 'Camiseta Básica - Branca G',
      sku: 'CAM-BAS-BR-G',
      stock_quantity: 15,
      attributes: JSON.stringify({
        size: 'G',
        color: 'Branco'
      }),
      is_active: true
    },
    // Variantes da Camiseta Dry Fit
    {
      id: 4,
      tenant_id: 1,
      product_id: 5,
      name: 'Camiseta Dry Fit - Preta M',
      sku: 'CAM-DRY-PR-M',
      stock_quantity: 0,
      attributes: JSON.stringify({
        size: 'M',
        color: 'Preto'
      }),
      is_active: true
    },
    {
      id: 5,
      tenant_id: 1,
      product_id: 5,
      name: 'Camiseta Dry Fit - Preta G',
      sku: 'CAM-DRY-PR-G-VAR',
      stock_quantity: 8,
      attributes: JSON.stringify({
        size: 'G',
        color: 'Preto'
      }),
      is_active: true
    }
  ]);

  // Inserir movimentações de estoque iniciais
  await knex('stock_movements').insert([
    // Movimentações para iPhone
    {
      tenant_id: 1,
      product_id: 1,
      type: 'in',
      quantity: 15,
      previous_stock: 0,
      new_stock: 15,
      reason: 'initial',
      metadata: JSON.stringify({ source: 'seed_data' })
    },
    // Movimentações para Galaxy
    {
      tenant_id: 1,
      product_id: 2,
      type: 'in',
      quantity: 10,
      previous_stock: 0,
      new_stock: 10,
      reason: 'initial'
    },
    {
      tenant_id: 1,
      product_id: 2,
      type: 'out',
      quantity: 2,
      previous_stock: 10,
      new_stock: 8,
      reason: 'sale',
      reference_id: 'ORDER-001'
    },
    // Movimentações para MacBook
    {
      tenant_id: 1,
      product_id: 3,
      type: 'in',
      quantity: 5,
      previous_stock: 0,
      new_stock: 5,
      reason: 'initial'
    },
    // Movimentações para Camiseta Básica (produto pai)
    {
      tenant_id: 1,
      product_id: 4,
      type: 'in',
      quantity: 50,
      previous_stock: 0,
      new_stock: 50,
      reason: 'initial'
    },
    // Movimentações para variantes
    {
      tenant_id: 1,
      variant_id: 1,
      type: 'in',
      quantity: 15,
      previous_stock: 0,
      new_stock: 15,
      reason: 'initial'
    },
    {
      tenant_id: 1,
      variant_id: 2,
      type: 'in',
      quantity: 20,
      previous_stock: 0,
      new_stock: 20,
      reason: 'initial'
    },
    {
      tenant_id: 1,
      variant_id: 3,
      type: 'in',
      quantity: 15,
      previous_stock: 0,
      new_stock: 15,
      reason: 'initial'
    },
    {
      tenant_id: 1,
      variant_id: 5,
      type: 'in',
      quantity: 8,
      previous_stock: 0,
      new_stock: 8,
      reason: 'initial'
    }
  ]);

  console.log('✅ Seed executado com sucesso!');
  console.log('📦 5 categorias criadas');
  console.log('🛍️ 5 produtos criados');
  console.log('🏷️ 5 variantes criadas');
  console.log('📊 9 movimentações de estoque registradas');
};