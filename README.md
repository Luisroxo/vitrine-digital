# Vitrine Digital

Uma aplicação moderna de vitrine digital desenvolvida com React.js e Node.js, inspirada no repositório [patricksouza/vitrine](https://github.com/patricksouza/vitrine).

## 🚀 Tecnologias

- **Frontend**: React.js, Bootstrap, React Multi Carousel
- **Backend**: Node.js, Express.js
- **Banco de Dados**: PostgreSQL, Knex.js
- **Containerização**: Docker, Docker Compose

## ✨ Funcionalidades

### Vitrine Digital
- ✅ Vitrine de produtos mais populares
- ✅ Vitrine de ofertas com sistema de descontos
- ✅ Carousels responsivos
- ✅ Formatação de preços em Real (R$)
- ✅ Sistema de parcelas
- ✅ Interface moderna e responsiva
- ✅ API REST completa

### Integração Bling ERP 🔥 **NOVA!**
- ✅ **Sincronização automática** de produtos do Bling ERP
- ✅ **Controle de estoque** em tempo real
- ✅ **Criação de pedidos** automatizada no Bling
- ✅ **OAuth2** para autenticação segura
- ✅ **Painel administrativo** para gerenciar a integração
- ✅ **Webhooks** para atualizações instantâneas
- ✅ **Gestão de clientes** sincronizada

## 🏗️ Estrutura do Projeto

```
vitrine-digital/
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── controllers/     # Controladores da API
│   │   ├── database/        # Configuração do banco
│   │   └── routes.js        # Rotas da API
│   ├── Dockerfile
│   └── package.json
├── frontend/                # Aplicação React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/          # Páginas da aplicação
│   │   └── services/       # Serviços API
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml       # Orquestração dos containers
```

## 🚀 Como Executar

### Pré-requisitos
- Docker e Docker Compose instalados

### Execução com Docker
```bash
# Clone o repositório (se necessário)
git clone <url-do-repositorio>
cd vitrine-digital

# Inicie todos os serviços
docker-compose up --build

# Ou execute em background
docker-compose up -d --build
```

### Acessar a Aplicação
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3333
- **Banco de Dados**: localhost:5432
- **Painel Admin**: http://localhost:3000/admin

### Execução Manual (Desenvolvimento)

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## 📋 API Endpoints

### Produtos
- `GET /api/products` - Lista todos os produtos
- `GET /api/products/popular` - Produtos mais populares
- `GET /api/products/offers` - Produtos em oferta

### Integração Bling ERP
- `GET /api/bling/status` - Status da conexão com Bling
- `GET /api/bling/auth/url` - URL de autorização OAuth2
- `POST /api/bling/sync/products` - Sincronizar produtos
- `POST /api/bling/orders` - Criar pedido no Bling
- `GET /api/bling/categories` - Listar categorias

## 🎨 Demonstração

A aplicação apresenta duas seções principais:

1. **Vitrine de Mais Populares**: Exibe os produtos mais vendidos com ranking
2. **Vitrine de Ofertas**: Produtos com desconto em destaque

Cada produto exibe:
- Imagem do produto
- Nome e categoria
- Preço original (riscado)
- Preço com desconto
- Percentual de desconto
- Opções de parcelamento

## 🔧 Personalização

### Adicionando Novos Produtos
Edite o arquivo `backend/src/controllers/ProductController.js` e adicione novos produtos ao array `sampleProducts`.

### Modificando Estilos
Os estilos estão em `frontend/src/index.css` e seguem as classes do Bootstrap 5.

### Configurando Banco de Dados
As configurações estão em `backend/knexfile.js`. Para usar um banco real, atualize as variáveis de ambiente no `docker-compose.yml`.

## 🔧 Configuração da Integração Bling

Para usar a integração com Bling ERP, siga os passos em [BLING_INTEGRATION.md](BLING_INTEGRATION.md):

1. **Criar aplicação** no [Bling Developer](https://developer.bling.com.br/aplicativos)
2. **Configurar variáveis** de ambiente no backend
3. **Executar migrações** do banco de dados
4. **Autorizar integração** via painel administrativo

## 🌟 Próximas Funcionalidades

- [ ] Sistema de autenticação de usuários
- [x] Painel administrativo ✅
- [ ] Carrinho de compras
- [ ] Sistema de pagamento
- [ ] Busca e filtros avançados
- [ ] Avaliações de produtos
- [ ] Notificações push
- [ ] Relatórios de vendas
- [ ] Múltiplas integrações ERP

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

Desenvolvido com ❤️ para criar experiências de compra incríveis!
