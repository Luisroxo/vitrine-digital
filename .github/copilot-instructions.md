# Vitrine Digital - Instruções de Desenvolvimento

Este é um projeto de vitrine digital desenvolvido com React.js, Node.js, PostgreSQL e Docker, com integração completa ao Bling ERP.

## Estrutura do Projeto

- **Backend**: Node.js + Express + PostgreSQL + Knex.js
- **Frontend**: React.js + Bootstrap + React Multi Carousel
- **Integração**: Bling ERP API para sincronização de produtos, estoques e pedidos
- **Containerização**: Docker + Docker Compose para desenvolvimento e produção

## Funcionalidades Principais

### Vitrine Digital
- Carousels responsivos de produtos populares e ofertas
- Sistema de descontos e promoções
- Formatação brasileira de preços e parcelas
- Interface moderna com Bootstrap 5

### Integração Bling ERP
- Sincronização automática de produtos do Bling para a vitrine
- Controle de estoque em tempo real
- Criação automatizada de pedidos no Bling
- Painel administrativo para gerenciar a integração
- Autenticação OAuth2 segura
- Webhooks para atualizações instantâneas

## Comandos de Desenvolvimento

### Execução com Docker
```bash
docker-compose up --build
```

### Execução Manual
```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm start
```

## Arquivos Importantes

- `backend/src/services/BlingService.js` - Integração com API Bling
- `backend/src/controllers/BlingController.js` - Endpoints da integração
- `frontend/src/components/BlingIntegration.js` - Interface administrativa
- `frontend/src/pages/Admin.js` - Painel administrativo
- `BLING_INTEGRATION.md` - Documentação completa da integração

## Configuração da Integração

1. Criar aplicação no [Bling Developer](https://developer.bling.com.br/aplicativos)
2. Configurar variáveis de ambiente no backend (.env)
3. Executar migrações do banco de dados
4. Autorizar integração via painel administrativo (/admin)

## Tecnologias e Dependências

### Backend
- Express.js, CORS, Knex.js, PostgreSQL
- dotenv para variáveis de ambiente
- axios para requisições HTTP à API Bling

### Frontend  
- React.js, React Router, Bootstrap 5
- React Multi Carousel para carousels responsivos
- FontAwesome para ícones

## Status do Projeto

✅ Projeto completamente funcional
✅ Integração Bling ERP implementada
✅ Documentação completa
✅ Painel administrativo operacional
✅ Docker configurado
✅ Tasks de desenvolvimento criadas