const express = require('express');
const BlingController = require('./controllers/BlingController');
const { JWTUtils } = require('../shared');

const router = express.Router();
const blingController = new BlingController();
const jwtUtils = new JWTUtils();

// Middleware for authentication
const authMiddleware = jwtUtils.createAuthMiddleware();

// Health check (public)
router.get('/health', blingController.healthCheck.bind(blingController));

// OAuth routes
router.get('/auth/url', authMiddleware, blingController.getAuthURL.bind(blingController));
router.get('/auth/callback', blingController.handleCallback.bind(blingController));

// Connection management (protected)
router.post('/connections', authMiddleware, blingController.createConnection.bind(blingController));
router.get('/connections', authMiddleware, blingController.getConnections.bind(blingController));
router.get('/connections/:connectionId', authMiddleware, blingController.getConnection.bind(blingController));
router.post('/connections/:connectionId/test', authMiddleware, blingController.testConnection.bind(blingController));
router.delete('/connections/:connectionId', authMiddleware, blingController.deleteConnection.bind(blingController));

// Sync operations (protected)
router.post('/sync/:jobType', authMiddleware, blingController.startSync.bind(blingController));
router.get('/sync/:jobId/status', authMiddleware, blingController.getSyncStatus.bind(blingController));
router.delete('/sync/:jobId', authMiddleware, blingController.cancelSync.bind(blingController));
router.get('/sync/stats', authMiddleware, blingController.getSyncStats.bind(blingController));

// Dashboard (protected)
router.get('/dashboard', authMiddleware, blingController.getDashboard.bind(blingController));

// Price Sync operations (protected)
router.post('/prices/sync', authMiddleware, blingController.syncAllPrices.bind(blingController));
router.post('/prices/sync/tenant', authMiddleware, blingController.syncTenantPrices.bind(blingController));
router.get('/prices/sync/stats', authMiddleware, blingController.getPriceSyncStats.bind(blingController));
router.get('/prices/history/:productId', authMiddleware, blingController.getPriceHistory.bind(blingController));

// Webhooks (public - will be secured by signature validation)
router.post('/webhooks/:tenantId', blingController.handleWebhook.bind(blingController));
router.post('/webhooks/prices/:tenantId', blingController.handlePriceWebhook.bind(blingController));

module.exports = router;