# 🚀 Vitrine Digital - Microservices Architecture

Arquitetura de microserviços para a plataforma Vitrine Digital, implementando uma solução escalável e resiliente para o ecossistema SaaS.

## 🏗️ Arquitetura

### Serviços

- **🌐 API Gateway** (Port 3000) - Roteamento e autenticação
- **🔐 Auth Service** (Port 3001) - Autenticação e autorização
- **📦 Product Service** (Port 3002) - Gerenciamento de produtos
- **🔗 Bling Service** (Port 3003) - Integração Bling ERP
- **💰 Billing Service** (Port 3004) - Sistema de créditos e cobrança

### Infraestrutura

- **PostgreSQL** - Banco de dados por serviço
- **Redis** - Message queue e cache
- **Prometheus** - Métricas e monitoramento
- **Grafana** - Dashboards e visualização

## 🚀 Quick Start

### Pré-requisitos

- Docker & Docker Compose
- Node.js 18+ (para desenvolvimento)
- Git

### 1. Clone e Setup

```bash
# Clone o repositório
git clone <repository-url>
cd vitrine-digital/microservices

# Torne os scripts executáveis (Linux/Mac)
chmod +x scripts/*.sh

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações
```

### 2. Desenvolvimento

```bash
# Build e start todos os serviços
./scripts/build.sh
./scripts/start.sh

# Ou usando Docker Compose diretamente
docker-compose up --build -d

# Ver logs
docker-compose logs -f

# Parar serviços
./scripts/stop.sh
```

### 3. Produção

```bash
# Deploy para produção
NODE_ENV=production ./scripts/deploy.sh

# Ou com versão específica
VERSION=v1.0.0 ./scripts/deploy.sh
```

## 📡 API Endpoints

### API Gateway (http://localhost:3000)

Todos os requests devem passar pelo gateway:

- `POST /auth/register` - Registro de usuário
- `POST /auth/login` - Login
- `GET /products` - Listar produtos (protegido)
- `POST /bling/sync` - Sincronizar com Bling (protegido)
- `GET /billing/credits` - Verificar créditos (protegido)

### Autenticação

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "123456"}'

# Request autenticado
curl -X GET http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🏥 Health Checks

Cada serviço expõe um endpoint `/health`:

```bash
# Gateway health (inclui status de todos os serviços)
curl http://localhost:3000/health

# Serviço específico
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3002/health  # Product Service
curl http://localhost:3003/health  # Bling Service
curl http://localhost:3004/health  # Billing Service
```

## 🗄️ Bancos de Dados

Cada serviço tem seu próprio banco PostgreSQL:

- `auth_db` - Usuários, sessões, permissões
- `product_db` - Produtos, categorias, estoque
- `bling_db` - Integração Bling, tokens, webhooks
- `billing_db` - Créditos, transações, planos

### Migrações

```bash
# Executar migrations para um serviço específico
docker-compose exec auth-service npm run migrate
docker-compose exec product-service npm run migrate
docker-compose exec bling-service npm run migrate
docker-compose exec billing-service npm run migrate
```

## 📊 Monitoramento

### Prometheus Metrics

Acesse http://localhost:9090 para métricas:

- Request latency
- Error rates
- Database connections
- Custom business metrics

### Grafana Dashboards

Acesse http://localhost:3001 (admin/admin) para dashboards:

- Service overview
- Database performance
- Business KPIs
- Alert management

### Logs Centralizados

Todos os serviços logam em formato JSON estruturado:

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Logs de serviço específico
docker-compose logs -f gateway
docker-compose logs -f auth-service

# Filtrar por nível de log
docker-compose logs -f | grep ERROR
```

## 🔒 Segurança

### JWT Authentication

- Access tokens: 1 hora de validade
- Refresh tokens: 30 dias de validade
- RBAC (Role-Based Access Control)
- Rate limiting por IP

### Roles e Permissões

- **admin**: Acesso completo ao sistema
- **lojista**: Gerenciar produtos, pedidos, créditos
- **user**: Visualizar produtos, fazer pedidos

### HTTPS & TLS

Em produção, configure:

- Certificados SSL/TLS
- HTTPS redirect
- Security headers (Helmet.js)
- CORS apropriado

## 🔄 Event-Driven Architecture

### Eventos Redis Pub/Sub

```javascript
// Publicar evento
eventPublisher.publishUserEvent('created', userId, userData);
eventPublisher.publishProductEvent('updated', productId, changes);
eventPublisher.publishOrderEvent('completed', orderId, orderData);

// Escutar eventos
eventSubscriber.subscribeToUserEvents('created', handleUserCreated);
eventSubscriber.subscribeToAllProductEvents(handleAnyProductEvent);
```

### Padrões de Eventos

- `user.created` - Novo usuário registrado
- `user.updated` - Dados de usuário alterados
- `product.created` - Produto criado
- `product.updated` - Produto atualizado
- `product.stock_changed` - Estoque alterado
- `order.created` - Pedido criado
- `order.completed` - Pedido finalizado
- `billing.credit_purchased` - Créditos comprados
- `billing.credit_used` - Créditos utilizados
- `bling.sync_completed` - Sincronização Bling concluída

## 🧪 Testes

### Unit Tests

```bash
# Testar serviço específico
cd auth-service && npm test
cd product-service && npm test

# Coverage report
npm run test:coverage
```

### Integration Tests

```bash
# Testes de integração entre serviços
npm run test:integration

# Smoke tests pós-deploy
./scripts/smoke-tests.sh
```

### Load Testing

```bash
# Artillery.js para load testing
npm install -g artillery
artillery run load-tests/auth-flow.yml
artillery run load-tests/product-api.yml
```

## 📊 Métricas de Negócio

### KPIs Monitorados

- **MRR** (Monthly Recurring Revenue)
- **Churn Rate**
- **CAC** (Customer Acquisition Cost) 
- **LTV** (Lifetime Value)
- **DAU/MAU** (Daily/Monthly Active Users)

### Alerts Configurados

- **High Error Rate** (>5% em 5min)
- **High Latency** (>2s P95)
- **Database Connection Issues**
- **Service Down** (health check fail)
- **Low Credit Balance** (<10 créditos)

## 🔧 Troubleshooting

### Problemas Comuns

**Gateway 502 Bad Gateway**
```bash
# Verificar se serviços estão rodando
docker-compose ps
# Verificar logs do gateway
docker-compose logs -f gateway
```

**Serviço não conecta no banco**
```bash
# Verificar containers do banco
docker-compose ps | grep postgres
# Verificar logs do serviço
docker-compose logs -f auth-service
```

**Redis Connection Error**
```bash
# Verificar Redis
docker-compose ps | grep redis
# Testar conexão
docker-compose exec redis redis-cli ping
```

### Debug Mode

```bash
# Ativar logs debug
export LOG_LEVEL=debug
docker-compose up -d

# Ou para serviço específico
docker-compose exec auth-service sh -c "LOG_LEVEL=debug npm run dev"
```

## 🚢 Deploy

### Staging

```bash
# Deploy para staging
NODE_ENV=staging ./scripts/deploy.sh
```

### Production

```bash
# Deploy com blue-green
NODE_ENV=production DEPLOY_STRATEGY=blue-green ./scripts/deploy.sh

# Deploy com rolling update
NODE_ENV=production DEPLOY_STRATEGY=rolling ./scripts/deploy.sh

# Rollback para versão anterior
./scripts/rollback.sh v1.0.0
```

### CI/CD Pipeline

O projeto inclui GitHub Actions para:

- **Build**: Testes e build de imagens
- **Test**: Testes automatizados
- **Security**: Scan de vulnerabilidades
- **Deploy**: Deploy automático em staging
- **Release**: Deploy manual em produção

## 📚 Recursos Adicionais

### Documentação

- [API Documentation](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Event Catalog](./docs/events.md)
- [Architecture Decisions](./docs/adr/)

### Links Úteis

- [Roadmap Completo](../ROADMAP_MICROSERVICES.md)
- [Monolítico → Microserviços](./docs/migration.md)
- [Desenvolvimento Local](./docs/development.md)
- [Produção & Operações](./docs/operations.md)

---

## 🆘 Suporte

Para problemas ou dúvidas:

1. Verificar [Issues conhecidas](./docs/troubleshooting.md)
2. Consultar logs: `docker-compose logs -f`
3. Verificar health checks: `curl localhost:3000/health`
4. Abrir issue no repositório

---

**🎯 Resultado**: Arquitetura de microserviços production-ready com monitoramento completo e alta disponibilidade!