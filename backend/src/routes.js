const express = require('express');
const ProductController = require('./controllers/ProductController');
const BlingController = require('./controllers/BlingController');

const routes = express.Router();
const blingController = new BlingController();

// Rotas da API - Produtos
routes.get('/api/products', ProductController.index);
routes.get('/api/products/popular', ProductController.popular);
routes.get('/api/products/offers', ProductController.offers);

// Rotas da API - Integração Bling ERP
routes.get('/api/bling/status', blingController.getStatus.bind(blingController));
routes.get('/api/bling/auth/url', blingController.getAuthUrl.bind(blingController));
routes.get('/api/bling/auth/callback', blingController.authCallback.bind(blingController));
routes.post('/api/bling/sync/products', blingController.syncProducts.bind(blingController));
routes.get('/api/bling/categories', blingController.getCategories.bind(blingController));
routes.post('/api/bling/orders', blingController.createOrder.bind(blingController));
routes.post('/api/bling/webhook', blingController.webhook.bind(blingController));

module.exports = routes;