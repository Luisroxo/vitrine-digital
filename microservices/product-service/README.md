# 📦 Product Service - Vitrine Digital

Microserviço responsável pelo gerenciamento completo de produtos, categorias, variantes e analytics em uma arquitetura multi-tenant.

## 🚀 Funcionalidades

### **Core Features**
- ✅ **CRUD Produtos:** Criação, leitura, atualização e exclusão
- ✅ **Gestão de Categorias:** Hierarquia e organização
- ✅ **Variantes de Produto:** Tamanhos, cores, modelos
- ✅ **Controle de Estoque:** Movimentações e alertas
- ✅ **Sincronização Bling:** Integração ERP automática
- ✅ **Multi-tenant:** Isolamento completo por fornecedor

### **Analytics & Insights**
- ✅ **Tracking de Visualizações:** Métricas de engagement
- ✅ **Analytics de Busca:** Queries e performance
- ✅ **Top Products:** Produtos mais visualizados
- ✅ **Alertas de Estoque:** Produtos em baixa/sem estoque
- ✅ **Receita por Produto:** Relatórios de vendas
- ✅ **Performance Metrics:** Métricas operacionais

### **Event Integration**
- ✅ **Product Events:** Created, Updated, Deleted, Stock Changed
- ✅ **Bling Events:** Sync, Updates, Stock Changes
- ✅ **Order Events:** Stock decrements/increments
- ✅ **Tenant Events:** Setup/cleanup automático

## 📋 API Endpoints

### **Products**
```bash
GET    /api/products              # Listar produtos com filtros
GET    /api/products/:id          # Buscar produto por ID
POST   /api/products              # Criar produto
PUT    /api/products/:id          # Atualizar produto
DELETE /api/products/:id          # Deletar produto
GET    /api/products/:id/stock/movements # Histórico de estoque
```

### **Categories**
```bash
GET    /api/categories            # Listar categorias
GET    /api/categories/tree       # Árvore hierárquica
GET    /api/categories/:id        # Buscar categoria
POST   /api/categories            # Criar categoria
PUT    /api/categories/:id        # Atualizar categoria
DELETE /api/categories/:id        # Deletar categoria
```

### **Variants**
```bash
GET    /api/variants              # Listar variantes
GET    /api/variants/:id          # Buscar variante
POST   /api/variants              # Criar variante
PUT    /api/variants/:id          # Atualizar variante
DELETE /api/variants/:id          # Deletar variante
```

### **Stock**
```bash
GET    /api/stock/summary         # Resumo do estoque
GET    /api/stock/movements       # Movimentações
POST   /api/stock/update          # Atualizar estoque
GET    /api/stock/low-stock       # Produtos com estoque baixo
GET    /api/stock/out-of-stock    # Produtos sem estoque
GET    /api/stock/analytics       # Analytics de estoque
```

### **Sync**
```bash
POST   /api/sync/products/bulk    # Sincronização em lote
GET    /api/sync/status/:sync_id  # Status da sincronização
```

### **Analytics**
```bash
POST   /api/analytics/views       # Registrar visualização
POST   /api/analytics/searches    # Registrar busca
GET    /api/analytics/products/top # Top produtos
GET    /api/analytics/stock/alerts # Alertas de estoque
GET    /api/analytics/revenue/products # Receita por produto
GET    /api/analytics/searches    # Analytics de busca
GET    /api/analytics/performance # Métricas de performance
GET    /api/analytics/dashboard   # Dashboard completo
```

## 🗄️ Database Schema

### **Core Tables**
- `products` - Produtos principais
- `categories` - Categorias organizacionais
- `product_variants` - Variações de produtos
- `stock_movements` - Movimentações de estoque

### **Analytics Tables**
- `product_views` - Visualizações de produtos
- `search_queries` - Consultas de busca realizadas

## 🔄 Events

### **Published Events**
- `product.created` - Produto criado
- `product.updated` - Produto atualizado
- `product.deleted` - Produto deletado
- `product.stock.updated` - Estoque atualizado
- `product.viewed` - Produto visualizado

### **Subscribed Events**
- `bling.product.synced` - Produto sincronizado do Bling
- `bling.product.updated` - Produto atualizado no Bling
- `bling.stock.updated` - Estoque atualizado no Bling
- `order.created` - Pedido criado (decrementar estoque)
- `order.cancelled` - Pedido cancelado (devolver estoque)
- `order.item.returned` - Item devolvido
- `tenant.created` - Tenant criado (setup inicial)
- `tenant.deleted` - Tenant deletado (cleanup)

## 🏃‍♂️ Como Executar

### **Development**
```bash
# Instalar dependências
npm install

# Executar migrações
npm run migrate

# Executar seeds (opcional)
npm run seed

# Modo desenvolvimento
npm run dev
```

### **Production**
```bash
# Build da imagem Docker
docker build -t product-service .

# Ou usar docker-compose
docker-compose up product-service
```

### **Tests**
```bash
# Executar todos os testes
npm test

# Testes específicos
npm test -- analytics.test.js
npm test -- products.test.js
```

## 🔧 Configuration

### **Environment Variables**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=product_service
DB_USER=postgres
DB_PASSWORD=password

# Redis (Events)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Service
PORT=3003
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### **Database Connection**
```javascript
// knexfile.js
module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'product_service',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    }
  }
};
```

## 📊 Multi-Tenant Architecture

### **Tenant Isolation**
Todos os dados são isolados por `tenant_id`:
```sql
-- Exemplo: buscar produtos de um tenant
SELECT * FROM products WHERE tenant_id = 1;

-- FK constraints garantem integridade
ALTER TABLE products 
ADD CONSTRAINT fk_products_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id);
```

### **Headers Required**
```bash
# Todas as requests precisam do header:
x-tenant-id: 1
```

## 🔄 Integration Patterns

### **Event-Driven Architecture**
```javascript
// Publicar evento quando produto é criado
await this.eventPublisher.publish('product.created', {
  tenantId,
  productId: product.id,
  product: productData
});

// Ouvir eventos de outros serviços
eventListener.on('order.created', async (event) => {
  // Decrementar estoque automaticamente
  await this.updateStock(event.tenantId, event.productId, {
    quantity: event.quantity,
    type: 'subtract',
    reason: 'order_created'
  });
});
```

### **Bling Synchronization**
```javascript
// Sincronização automática via eventos
eventListener.on('bling.product.synced', async (event) => {
  const { tenantId, blingProductId, productData } = event;
  
  // Criar ou atualizar produto local
  await this.productService.createOrUpdate(tenantId, {
    ...productData,
    bling_id: blingProductId
  });
});
```

## 📈 Analytics & Monitoring

### **Product Views Tracking**
```javascript
// Registrar visualização
POST /api/analytics/views
{
  "product_id": 123,
  "session_id": "sess_abc123",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.1",
  "referrer": "https://google.com"
}
```

### **Performance Metrics**
```javascript
// Dashboard completo
GET /api/analytics/dashboard?period=30days
{
  "top_products": [...],
  "stock_alerts": {...},
  "performance": {...},
  "search_analytics": {...}
}
```

## 🛡️ Security & Validation

### **Input Validation**
- Joi schemas para todos os endpoints
- Sanitização de dados SQL injection prevention
- Rate limiting por endpoint

### **Authorization**
```javascript
// Middleware de tenant validation
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing tenant ID'
    });
  }
  req.tenantId = parseInt(tenantId);
  next();
});
```

## 🚨 Error Handling

### **Structured Errors**
```javascript
// Validation error
{
  "error": "Validation Error",
  "message": "Invalid product data",
  "details": [...]
}

// Not found error
{
  "error": "Not Found",
  "message": "Product not found"
}

// Internal server error
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

## 📚 Related Services

- **Gateway Service:** Roteamento e autenticação
- **Auth Service:** Gerenciamento de usuários
- **Bling Service:** Integração ERP
- **Order Service:** Processamento de pedidos
- **Billing Service:** Gestão de créditos

## 🔄 Migration & Rollback

```bash
# Aplicar migrações
npx knex migrate:latest

# Rollback última migração
npx knex migrate:rollback

# Status das migrações
npx knex migrate:status
```

## 🎯 Roadmap

### **Completed** ✅
- [x] Core CRUD operations
- [x] Multi-tenant architecture
- [x] Bling integration
- [x] Event system
- [x] Analytics tracking
- [x] Stock management
- [x] Performance metrics

### **Future Enhancements** 🔮
- [ ] Machine Learning recommendations
- [ ] Advanced reporting dashboard
- [ ] Image processing & optimization
- [ ] Price optimization algorithms
- [ ] Inventory forecasting
- [ ] A/B testing framework

---

## 📞 Support

Para suporte técnico ou dúvidas sobre o Product Service:
- **Email:** dev@vitrinedigital.com
- **Slack:** #product-service-support
- **Docs:** [Internal Wiki](wiki.vitrinedigital.com/product-service)

---

**Product Service v1.0** - Vitrine Digital Microservices  
**Status:** ✅ Production Ready  
**Last Updated:** Dezembro 2024