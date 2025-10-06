const connection = require('../database/connection');

// Dados de exemplo dos produtos
const sampleProducts = [
  {
    id: '1',
    name: 'Smartphone Samsung Galaxy A54',
    price: 1299.99,
    oldprice: 1599.99,
    categories: 'Eletrônicos',
    count: 10,
    discount: 19,
    image_src: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=300&fit=crop'
  },
  {
    id: '2', 
    name: 'Notebook Lenovo IdeaPad 3',
    price: 2499.99,
    oldprice: 2899.99,
    categories: 'Informática',
    count: 12,
    discount: 14,
    image_src: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop'
  },
  {
    id: '3',
    name: 'Fone de Ouvido Sony WH-1000XM4',
    price: 899.99,
    oldprice: 1199.99,
    categories: 'Áudio',
    count: 6,
    discount: 25,
    image_src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'
  },
  {
    id: '4',
    name: 'Smart TV LG 55" 4K',
    price: 2199.99,
    oldprice: 2799.99,
    categories: 'Eletrônicos',
    count: 18,
    discount: 21,
    image_src: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&h=300&fit=crop'
  },
  {
    id: '5',
    name: 'Câmera Canon EOS Rebel T7',
    price: 1799.99,
    oldprice: 2199.99,
    categories: 'Fotografia',
    count: 8,
    discount: 18,
    image_src: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=300&fit=crop'
  },
  {
    id: '6',
    name: 'Apple Watch Series 8',
    price: 2999.99,
    oldprice: 3499.99,
    categories: 'Wearables',
    count: 15,
    discount: 14,
    image_src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'
  }
];

module.exports = {
  async index(request, response) {
    try {
      // Retorna todos os produtos
      return response.json({
        products: sampleProducts
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async popular(request, response) {
    try {
      // Retorna produtos mais populares (simulando popularidade)
      const popularProducts = sampleProducts
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return response.json({
        popular_products: popularProducts
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async offers(request, response) {
    try {
      // Retorna produtos com desconto
      const offerProducts = sampleProducts
        .filter(product => product.discount > 15)
        .sort((a, b) => b.discount - a.discount)
        .slice(0, 4);

      return response.json({
        price_products: offerProducts
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};