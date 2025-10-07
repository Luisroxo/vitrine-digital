# 💳 Billing Service - Sistema Avançado de Cobrança

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-20.x-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)
![Status](https://img.shields.io/badge/status-production_ready-brightgreen.svg)

Sistema completo de cobrança baseado em créditos com processamento de pagamentos PIX/cartão, gerenciamento de assinaturas e analytics avançados para o ecossistema Vitrine Digital.

## 📋 Índice

- [Características](#-características)
- [Arquitetura](#-arquitetura)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [API Reference](#-api-reference)
- [Uso](#-uso)
- [Integrações](#-integrações)
- [Monitoramento](#-monitoramento)
- [Testes](#-testes)
- [Deploy](#-deploy)

## 🚀 Características

### 💰 Sistema de Créditos
- **Compra de Créditos**: PIX instantâneo, cartões de crédito/débito
- **Sistema de Reserva**: Prevenção de duplo gasto com timeout automático
- **Bonificações**: Sistema configurável de bônus por volume
- **Histórico Completo**: Auditoria de todas as transações
- **Cache Inteligente**: Performance otimizada com Redis

### 🏦 Processamento de Pagamentos
- **PIX**: Integração nativa com QR Code e Copia & Cola
- **Cartões**: Processamento via Stripe com 3D Secure
- **Webhooks**: Confirmação automática de pagamentos
- **Reembolsos**: Sistema completo de estornos
- **Fraud Detection**: Validação avançada de segurança

### 📊 Gestão de Assinaturas
- **Planos Flexíveis**: Starter, Growth, Professional, Enterprise
- **Billing Cycles**: Mensal, anual com proration inteligente
- **Upgrades/Downgrades**: Mudança de plano com cálculo automático
- **Dunning Management**: Recuperação automática de pagamentos falhados
- **Trial & Freemium**: Suporte completo a períodos de teste

### 📈 Revenue Analytics & BI
- **KPIs Essenciais**: MRR, ARR, Churn Rate, LTV, CAC, ARPU
- **Forecasting**: Projeções de receita com múltiplos modelos
- **Cohort Analysis**: Análise de coortes de usuários
- **Relatórios**: Geração automática de relatórios executivos
- **Business Intelligence**: Insights acionáveis e recomendações

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    BILLING SERVICE                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  CreditManager  │  │ PaymentProcessor │  │ Subscription│  │
│  │                 │  │                 │  │   Manager   │  │
│  │ • Balance       │  │ • PIX           │  │ • Plans     │  │
│  │ • Transactions  │  │ • Cards         │  │ • Billing   │  │
│  │ • Reservations  │  │ • Webhooks      │  │ • Analytics │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Revenue Analytics Engine                   │  │
│  │ • KPI Calculation  • Forecasting  • BI Reports        │  │
│  └─────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│              Event-Driven Communication                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │     Redis Event Bus + PostgreSQL + Caching Layer       │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Principais

#### 1. **CreditManager** 🎯
- Gestão completa do sistema de créditos
- Reservas temporárias para prevenção de conflitos
- Cálculo automático de bonificações
- Cache distribuído para performance

#### 2. **PaymentProcessor** 💳
- Processamento multi-provider (Stripe, PagarMe)
- Suporte completo a PIX e cartões
- Webhooks seguros com verificação de assinatura
- Sistema robusto de reembolsos

#### 3. **SubscriptionManager** 📋
- Gerenciamento completo de assinaturas
- Proration inteligente em mudanças de plano
- Dunning automático para pagamentos falhados
- Suporte a trials e períodos de graça

#### 4. **RevenueAnalytics** 📊
- Business Intelligence avançado
- Forecasting com múltiplos modelos
- Análise de coortes de usuários
- Relatórios executivos automatizados

## 📦 Instalação

### Pré-requisitos

```bash
node >= 20.x
postgresql >= 15.x  
redis >= 7.x
docker >= 24.x (opcional)
```

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/vitrine-digital.git
cd vitrine-digital/microservices/billing-service

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Execute as migrações do banco
npm run migrate

# Inicie o serviço
npm run dev
```

### Docker Compose

```bash
# A partir da raiz do projeto
docker-compose -f microservices/docker-compose.yml up billing-service
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Servidor
PORT=3005
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=billing_service
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Payment Providers
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

PAGARME_API_KEY=ak_test_...
PAGARME_WEBHOOK_SECRET=your_secret
PIX_KEY=sua_chave_pix

# Segurança
JWT_SECRET=your_jwt_secret
WEBHOOK_TIMEOUT=30000

# Limites
CREDIT_MIN_AMOUNT=1000  # R$ 10.00
CREDIT_MAX_AMOUNT=10000000  # R$ 100,000.00
PIX_TIMEOUT=1800000  # 30 minutos
```

### Planos Pré-configurados

O sistema vem com 4 planos prontos para uso:

```javascript
// Plano Starter - R$ 29/mês
{
  planId: 'starter',
  creditsIncluded: 500,
  features: { products: 100, orders: 50, storage: '1GB' }
}

// Plano Growth - R$ 59/mês  
{
  planId: 'growth',
  creditsIncluded: 1500,
  features: { products: 500, orders: 200, storage: '5GB' }
}

// Plano Professional - R$ 99/mês
{
  planId: 'professional', 
  creditsIncluded: 3000,
  features: { products: 2000, orders: 1000, storage: '20GB' }
}

// Plano Enterprise - R$ 199/mês
{
  planId: 'enterprise',
  creditsIncluded: 10000, 
  features: { products: 'unlimited', orders: 'unlimited', storage: '100GB' }
}
```

## 🔌 API Reference

### 💰 Gestão de Créditos

#### Consultar Saldo
```http
GET /credits/balance/:tenantId
```

```json
{
  \"success\": true,
  \"tenantId\": \"tenant_123\",
  \"balance\": 50000,
  \"currency\": \"BRL\",
  \"timestamp\": \"2024-01-15T10:30:00Z\"
}
```

#### Comprar Créditos
```http
POST /credits/purchase
```

```json
{
  \"tenantId\": \"tenant_123\",
  \"amount\": 10000,
  \"paymentMethod\": \"pix\",
  \"customer\": {
    \"name\": \"João Silva\",
    \"email\": \"joao@exemplo.com\",
    \"document\": \"123.456.789-01\"
  }
}
```

**Resposta PIX:**
```json
{
  \"success\": true,
  \"paymentId\": \"pay_123\",
  \"paymentStatus\": \"pending\",
  \"qrCode\": \"data:image/png;base64,...\",
  \"pixCopyPaste\": \"00020126580014BR.GOV.BCB.PIX...\",
  \"expiresAt\": \"2024-01-15T11:00:00Z\"
}
```

#### Reservar Créditos
```http
POST /credits/reserve
```

```json
{
  \"tenantId\": \"tenant_123\",
  \"amount\": 5000,
  \"reservationData\": {
    \"orderId\": \"order_456\",
    \"description\": \"Compra de produto premium\"
  }
}
```

### 💳 Processamento de Pagamentos

#### Status do Pagamento
```http
GET /payments/status/:paymentId
```

```json
{
  \"success\": true,
  \"paymentId\": \"pay_123\",
  \"status\": \"completed\",
  \"method\": \"pix\",
  \"amount\": 10000,
  \"completedAt\": \"2024-01-15T10:35:00Z\"
}
```

#### Webhook de Pagamento
```http
POST /payments/webhook/:provider
```

O sistema suporta webhooks de múltiplos provedores:
- **Stripe**: `/payments/webhook/stripe`
- **PagarMe**: `/payments/webhook/pagarme`

### 📊 Gestão de Assinaturas

#### Listar Planos
```http
GET /subscriptions/plans
```

#### Criar Assinatura
```http
POST /subscriptions/create
```

```json
{
  \"tenantId\": \"tenant_123\",
  \"planId\": \"growth\",
  \"quantity\": 1,
  \"metadata\": {
    \"source\": \"web_signup\"
  }
}
```

#### Alterar Plano
```http
PUT /subscriptions/:subscriptionId/plan
```

```json
{
  \"newPlanId\": \"professional\",
  \"proration\": true,
  \"immediate\": true
}
```

### 📈 Analytics e Relatórios

#### Dashboard Executivo
```http
GET /analytics/dashboard?tenantId=tenant_123
```

#### KPIs Detalhados
```http
GET /analytics/kpis?period=30d&tenantId=tenant_123
```

#### Relatório de Receita
```http
GET /analytics/revenue?period=90d&includeForecasts=true
```

## 🎯 Uso

### Fluxo de Compra de Créditos

```javascript
// 1. Iniciar compra de créditos
const purchase = await fetch('/credits/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'tenant_123',
    amount: 10000, // R$ 100.00
    paymentMethod: 'pix',
    customer: { /* dados do cliente */ }
  })
});

// 2. Para PIX - mostrar QR Code ao usuário
if (purchase.paymentStatus === 'pending') {
  showPixQRCode(purchase.qrCode);
}

// 3. Webhook confirma pagamento automaticamente
// 4. Créditos são adicionados à conta do tenant
```

### Reserva e Consumo de Créditos

```javascript
// 1. Reservar créditos antes da compra
const reservation = await fetch('/credits/reserve', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: 'tenant_123',
    amount: 5000,
    reservationData: { orderId: 'order_456' }
  })
});

// 2. Processar compra...

// 3. Consumir créditos reservados
const consumption = await fetch('/credits/consume', {
  method: 'POST', 
  body: JSON.stringify({
    tenantId: 'tenant_123',
    reservationId: reservation.reservationId
  })
});
```

### Gestão de Assinaturas

```javascript
// Criar nova assinatura
const subscription = await fetch('/subscriptions/create', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: 'tenant_123',
    planId: 'growth'
  })
});

// Fazer upgrade do plano
const upgrade = await fetch(`/subscriptions/${subId}/plan`, {
  method: 'PUT',
  body: JSON.stringify({
    newPlanId: 'professional',
    proration: true
  })
});
```

## 🔗 Integrações

### Provedores de Pagamento

#### Stripe
```javascript
// Configuração automática via variáveis de ambiente
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### PagarMe (PIX)
```javascript
// Configuração para PIX brasileiro
PAGARME_API_KEY=ak_live_...
PIX_KEY=sua_chave_pix
```

### Event Bus
O serviço publica eventos para outros microserviços:

```javascript
// Eventos de crédito
'billing.credit.purchased'
'billing.credit.consumed'
'billing.credit.bonus_applied'

// Eventos de pagamento  
'billing.payment.processed'
'billing.payment.completed'
'billing.payment.failed'

// Eventos de assinatura
'billing.subscription.created'
'billing.subscription.upgraded'
'billing.subscription.canceled'
```

### Webhooks Externos
```bash
# URLs de webhook para configurar nos provedores
https://api.vitrinedigital.com/billing/payments/webhook/stripe
https://api.vitrinedigital.com/billing/payments/webhook/pagarme
```

## 📊 Monitoramento

### Health Check
```http
GET /health
```

```json
{
  \"status\": \"healthy\",
  \"services\": {
    \"creditManager\": { \"status\": \"ok\" },
    \"paymentProcessor\": { \"status\": \"ok\" }, 
    \"subscriptionManager\": { \"status\": \"ok\" }
  },
  \"database\": { \"connected\": true }
}
```

### Métricas do Sistema
```http
GET /stats
```

### Logs Estruturados
```json
{
  \"level\": \"info\",
  \"service\": \"billing-service\",
  \"component\": \"payment-processor\", 
  \"message\": \"Payment processed successfully\",
  \"metadata\": {
    \"paymentId\": \"pay_123\",
    \"amount\": 10000,
    \"method\": \"pix\"
  }
}
```

## 🧪 Testes

### Executar Testes
```bash
# Todos os testes
npm test

# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Coverage
npm run test:coverage
```

### Testes de Carga
```bash
# Instalar Artillery
npm install -g artillery

# Executar load tests
artillery run tests/load/payment-flow.yml
```

## 🚀 Deploy

### Produção com Docker

```bash
# Build da imagem
docker build -t billing-service:1.0.0 .

# Deploy
docker run -d \
  --name billing-service \
  -p 3005:3005 \
  --env-file .env.production \
  billing-service:1.0.0
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: billing-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: billing-service
  template:
    metadata:
      labels:
        app: billing-service
    spec:
      containers:
      - name: billing-service
        image: billing-service:1.0.0
        ports:
        - containerPort: 3005
        env:
        - name: NODE_ENV
          value: \"production\"
```

### CI/CD GitHub Actions

```yaml
name: Deploy Billing Service
on:
  push:
    branches: [main]
    paths: ['microservices/billing-service/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          docker build -t billing-service .
          docker push $REGISTRY/billing-service
```

## 📋 Roadmap

- [x] **v1.0** - Sistema de créditos completo ✅
- [x] **v1.0** - Processamento PIX/Cartões ✅  
- [x] **v1.0** - Gestão de assinaturas ✅
- [x] **v1.0** - Analytics e BI ✅
- [ ] **v1.1** - Machine Learning para fraud detection
- [ ] **v1.2** - Integração com marketplaces (ML, Shopee)
- [ ] **v1.3** - Programa de afiliados automatizado
- [ ] **v2.0** - Marketplace de créditos B2B

## 🤝 Contribuição

1. Fork do projeto
2. Crie uma feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Add nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 License

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

### 🎉 Status do Desenvolvimento

**✅ BILLING SERVICE 100% COMPLETO!**

- ✅ Credit Management System
- ✅ Payment Processing (PIX + Cards)  
- ✅ Subscription Management
- ✅ Revenue Analytics & BI
- ✅ Database Migrations
- ✅ API Endpoints completos
- ✅ Event-driven Architecture
- ✅ Production-ready code

**📊 Progresso Geral do Projeto: 68% (138/204 tasks)**

> Sistema robusto, escalável e pronto para produção! 🚀