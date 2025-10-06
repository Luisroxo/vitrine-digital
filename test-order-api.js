// Teste de criação de pedido via API
// Execute este script no console do browser ou em uma ferramenta como Postman

const testOrderData = {
  customer_name: "João Silva",
  customer_email: "joao.silva@email.com",
  customer_phone: "(11) 99999-9999",
  customer_document: "12345678901",
  shipping_address: JSON.stringify({
    street: "Rua das Flores, 123",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipcode: "01000-000",
    complement: "Apto 45"
  }),
  items: [
    {
      product_id: 1,
      quantity: 2,
      unit_price: 15000, // R$ 150,00 em centavos
      product_name: "Produto Teste 1"
    },
    {
      product_id: 2,
      quantity: 1,
      unit_price: 8900, // R$ 89,00 em centavos
      product_name: "Produto Teste 2"
    }
  ],
  shipping_cost: 1500, // R$ 15,00 em centavos
  discount: 0,
  payment_method: "credit_card",
  notes: "Pedido de teste criado automaticamente"
};

// Função para criar pedido via fetch (execute no console do browser)
async function createTestOrder() {
  try {
    const response = await fetch('http://localhost:3334/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrderData)
    });

    const result = await response.json();
    console.log('Resposta da API:', result);
    
    if (result.success) {
      console.log('✅ Pedido criado com sucesso!');
      console.log('ID:', result.order.id);
      console.log('Número:', result.order.order_number);
      console.log('Total:', result.order.total);
    } else {
      console.log('❌ Erro ao criar pedido:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

// Para usar via curl (terminal):
/*
curl -X POST http://localhost:3334/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "João Silva",
    "customer_email": "joao.silva@email.com",
    "customer_phone": "(11) 99999-9999",
    "customer_document": "12345678901",
    "shipping_address": "{\"street\":\"Rua das Flores, 123\",\"neighborhood\":\"Centro\",\"city\":\"São Paulo\",\"state\":\"SP\",\"zipcode\":\"01000-000\",\"complement\":\"Apto 45\"}",
    "items": [
      {
        "product_id": 1,
        "quantity": 2,
        "unit_price": 15000,
        "product_name": "Produto Teste 1"
      },
      {
        "product_id": 2,
        "quantity": 1,
        "unit_price": 8900,
        "product_name": "Produto Teste 2"
      }
    ],
    "shipping_cost": 1500,
    "discount": 0,
    "payment_method": "credit_card",
    "notes": "Pedido de teste criado automaticamente"
  }'
*/

console.log('📋 Script de teste do sistema de pedidos carregado!');
console.log('💡 Execute createTestOrder() para criar um pedido de teste');
console.log('🔗 Ou use o comando curl no terminal para testar via API diretamente');