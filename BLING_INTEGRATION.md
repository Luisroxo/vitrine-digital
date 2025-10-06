# Integração Bling ERP - Vitrine Digital

## Visão Geral

A integração com o Bling ERP permite sincronizar automaticamente produtos, estoques, pedidos e clientes entre o sistema Bling e a Vitrine Digital, proporcionando:

- ✅ **Sincronização automática de produtos** do Bling para a vitrine
- ✅ **Controle de estoque em tempo real**
- ✅ **Criação automática de pedidos** no Bling a partir da vitrine
- ✅ **Gestão de clientes** sincronizada
- ✅ **Webhooks** para atualizações instantâneas
- ✅ **Painel administrativo** para gerenciar a integração

## Tecnologias Utilizadas

### APIs e Bibliotecas Analisadas

**JavaScript/TypeScript (Recomendado):**
- Repository: `AlexandreBellas/bling-erp-api-js`
- Package: `npm install bling-erp-api`
- Suporte: TypeScript completo, 40+ entidades, OAuth2

**PHP (Alternativa):**
- Repository: `AlexandreBellas/bling-erp-api-php`
- Package: `composer require alebatistella/bling-erp-api`
- Suporte: PHP 8.2+, estrutura similar ao JS

### Implementação Escolhida

Optamos pela **implementação customizada em JavaScript** por:
- Consistência com o stack Node.js/React existente
- Controle total sobre a integração
- Flexibilidade para customizações específicas
- Melhor integração com o banco PostgreSQL

## Configuração

### 1. Criar Aplicação no Bling

1. Acesse o [Bling Developer](https://developer.bling.com.br/aplicativos)
2. Crie uma nova aplicação
3. Configure a URL de redirecionamento: `http://localhost:3333/api/bling/auth/callback`
4. Anote o `Client ID` e `Client Secret`

### 2. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` no backend e configure:

```bash
# Configurações da Integração Bling ERP
BLING_CLIENT_ID=seu_client_id_aqui
BLING_CLIENT_SECRET=seu_client_secret_aqui
BLING_REDIRECT_URI=http://localhost:3333/api/bling/auth/callback
```

### 3. Executar Migrações

```bash
cd backend
npm run migrate
```

As seguintes tabelas serão criadas/atualizadas:
- `products` - Campos adicionais para integração Bling
- `bling_config` - Configurações e tokens da integração

### 4. Inicializar Aplicação

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm start
```

## Autenticação OAuth2

### Fluxo de Autenticação

1. **Obter URL de Autorização**: `GET /api/bling/auth/url`
2. **Usuário autoriza** no Bling (redirecionamento)
3. **Callback recebe código**: `GET /api/bling/auth/callback?code=...`
4. **Token obtido** e armazenado automaticamente

### Renovação de Token

A renovação é automática usando refresh tokens quando necessário.

## Endpoints da API

### Autenticação
- `GET /api/bling/status` - Status da conexão
- `GET /api/bling/auth/url` - URL de autorização
- `GET /api/bling/auth/callback` - Callback OAuth2

### Produtos
- `POST /api/bling/sync/products` - Sincronizar produtos
- `GET /api/bling/categories` - Listar categorias

### Pedidos
- `POST /api/bling/orders` - Criar pedido no Bling

### Webhooks
- `POST /api/bling/webhook` - Receber atualizações

## Estrutura da Integração

```
backend/src/
├── services/
│   └── BlingService.js      # Serviço principal da API Bling
├── controllers/
│   └── BlingController.js   # Controller para endpoints
└── database/migrations/
    ├── 002_add_bling_integration.js
    └── 003_create_bling_config.js

frontend/src/
├── components/
│   └── BlingIntegration.js  # Interface de administração
└── pages/
    └── Admin.js             # Painel administrativo
```

## Funcionalidades Implementadas

### BlingService (Backend)

```javascript
const blingService = new BlingService();

// Autenticação
await blingService.authenticate(code);

// Sincronização de produtos
const products = await blingService.syncProducts();

// Criação de pedidos
await blingService.createOrder(orderData);

// Gestão de contatos
await blingService.createOrUpdateContact(clientData);
```

### BlingController (Backend)

- **Autenticação OAuth2** completa
- **Sincronização de produtos** com tratamento de erros
- **Criação de pedidos** a partir da vitrine
- **Webhooks** para atualizações em tempo real
- **Status da conexão** e diagnósticos

### Componentes React (Frontend)

- **BlingIntegration**: Interface para configuração e monitoramento
- **Admin**: Painel administrativo completo
- **Status visual** da conexão
- **Botões de sincronização** com feedback

## Fluxo de Sincronização

### Produtos (Bling → Vitrine)

1. **Busca produtos** ativos no Bling
2. **Formata dados** para o padrão da vitrine
3. **Atualiza/insere** no banco PostgreSQL
4. **Mantém referência** Bling ID para atualizações

### Pedidos (Vitrine → Bling)

1. **Cliente faz pedido** na vitrine
2. **Cria/atualiza contato** no Bling
3. **Cria pedido** no Bling com produtos
4. **Retorna confirmação** para o cliente

### Webhooks (Bling → Vitrine)

1. **Bling envia webhook** para alterações
2. **Sistema processa** eventos em tempo real
3. **Atualiza dados locais** conforme necessário

## Campos Sincronizados

### Produtos
- **Básicos**: Nome, descrição, preço, categoria
- **Estoque**: Quantidade disponível
- **Bling**: ID, código, GTIN, dados completos
- **E-commerce**: Imagens, preço promocional, status

### Pedidos
- **Cliente**: Nome, email, telefone, endereço
- **Itens**: Produtos, quantidades, valores
- **Pagamento**: Forma de pagamento, parcelas
- **Observações**: Informações adicionais

## Monitoramento

### Painel Administrativo

Acesse `/admin` para:
- **Status da conexão** com Bling
- **Sincronização manual** de produtos
- **Logs de atividades** recentes
- **Estatísticas** de produtos e pedidos
- **Configurações** da integração

### Logs e Debugging

```javascript
// Verificar status
console.log(await blingService.testConnection());

// Testar sincronização
console.log(await blingService.syncProducts());

// Verificar configuração
console.log(process.env.BLING_CLIENT_ID);
```

## Segurança

### Tokens
- **Access tokens** armazenados criptografados
- **Refresh tokens** para renovação automática
- **Expiração** controlada automaticamente

### Dados
- **Validação** de entrada em todos endpoints
- **Tratamento de erros** robusto
- **Logs** de atividades para auditoria

## Próximos Passos

### Melhorias Futuras

1. **Sincronização bidirecional** de estoques
2. **Gestão avançada de variações** de produtos
3. **Relatórios de vendas** integrados
4. **Notificações push** para eventos importantes
5. **Cache inteligente** para melhor performance
6. **Backup automático** de configurações

### Expansões

1. **Integração com outros ERPs** (Tiny, Omie, etc.)
2. **Marketplace** (Mercado Livre, Amazon)
3. **Sistemas de pagamento** (PIX, cartões)
4. **Logística** (Correios, transportadoras)

## Troubleshooting

### Problemas Comuns

**❌ Erro de autenticação**
- Verifique BLING_CLIENT_ID e BLING_CLIENT_SECRET
- Confirme URL de redirecionamento no Bling Developer

**❌ Falha na sincronização**
- Verifique token de acesso no banco
- Teste conectividade: `GET /api/bling/status`

**❌ Produtos não aparecem**
- Execute sincronização manual no painel admin
- Verifique se produtos estão ativos no Bling

**❌ Webhook não funciona**
- Configure URL pública para produção
- Verifique processamento de eventos

### Debug Mode

```bash
# Backend com logs detalhados
NODE_ENV=development npm run dev

# Frontend com debug
REACT_APP_DEBUG=true npm start
```

## Suporte

Para dúvidas ou problemas:

1. **Documentação Bling**: https://developer.bling.com.br
2. **Repositórios analisados**:
   - JavaScript: https://github.com/AlexandreBellas/bling-erp-api-js
   - PHP: https://github.com/AlexandreBellas/bling-erp-api-php
3. **Logs da aplicação**: Verifique console do backend
4. **Status da integração**: Acesse `/admin` na vitrine

---

**Integração criada e documentada com base na análise detalhada dos repositórios Bling ERP API disponíveis no GitHub.**