/**
 * Bling Price Sync API Routes
 * 
 * Endpoints para controle e monitoramento da sincronização de preços
 * entre Bling ERP e a plataforma de e-commerce.
 * 
 * Funcionalidades:
 * - Sincronização manual e automática de preços
 * - Monitoramento de status e métricas
 * - Configuração de políticas de preço
 * - Histórico de mudanças e resolução de conflitos
 * - Webhooks do Bling para atualizações em tempo real
 * 
 * @author Sistema Vitrine Digital
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const BlingPriceSyncService = require('../services/BlingPriceSyncService');
const authMiddleware = require('../../../shared/middleware/auth');
const rateLimiter = require('../../../shared/middleware/rateLimiter');
const Logger = require('../../../shared/utils/logger');

const logger = Logger.create('BlingPriceSyncRoutes');
const priceSyncService = new BlingPriceSyncService();

// Rate limiting específico para sync de preços
const syncRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por janela
    message: 'Muitas tentativas de sincronização. Tente novamente em alguns minutos.'
});

const bulkSyncRateLimit = rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // máximo 10 sync em massa por hora
    message: 'Limite de sincronização em massa atingido. Tente novamente em 1 hora.'
});

/**
 * GET /sync/status
 * Obtém status geral do serviço de sincronização
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const status = {
            service: 'BlingPriceSyncService',
            version: '2.0.0',
            status: 'operational',
            uptime: process.uptime(),
            state: priceSyncService.state,
            metrics: priceSyncService.getSyncMetrics(),
            configuration: {
                syncInterval: priceSyncService.config.syncInterval,
                batchSize: priceSyncService.config.batchSize,
                enableCache: priceSyncService.config.enableCache,
                enableNotifications: priceSyncService.config.enableNotifications,
                conflictResolution: priceSyncService.config.conflictResolution
            },
            lastChecked: new Date().toISOString()
        };
        
        res.json(status);
        
    } catch (error) {
        logger.error('Error getting sync status:', error);
        res.status(500).json({
            error: 'Failed to get sync status',
            message: error.message
        });
    }
});

/**
 * GET /sync/metrics
 * Obtém métricas detalhadas de sincronização
 */
router.get('/metrics', authMiddleware, async (req, res) => {
    try {
        const metrics = priceSyncService.getSyncMetrics();
        
        // Adicionar métricas calculadas
        const extendedMetrics = {
            ...metrics,
            successRate: metrics.totalSynced > 0 ? 
                (metrics.successfulSyncs / metrics.totalSynced * 100).toFixed(2) + '%' : '0%',
            failureRate: metrics.totalSynced > 0 ? 
                (metrics.failedSyncs / metrics.totalSynced * 100).toFixed(2) + '%' : '0%',
            cacheHitRate: (metrics.cacheHits + metrics.cacheMisses) > 0 ? 
                (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2) + '%' : '0%',
            averageSyncTimeFormatted: metrics.averageSyncTime.toFixed(2) + 'ms',
            uptimeFormatted: formatUptime(process.uptime())
        };
        
        res.json(extendedMetrics);
        
    } catch (error) {
        logger.error('Error getting sync metrics:', error);
        res.status(500).json({
            error: 'Failed to get sync metrics',
            message: error.message
        });
    }
});

/**
 * POST /sync/product/:productId
 * Sincroniza preços de um produto específico
 */
router.post('/product/:productId', authMiddleware, syncRateLimit, async (req, res) => {
    try {
        const { productId } = req.params;
        const { tenant_id } = req.user;
        const options = {
            forceUpdate: req.body.forceUpdate || false,
            source: 'manual',
            userId: req.user.id
        };
        
        logger.info(`Manual price sync requested for product ${productId} by user ${req.user.id}`);
        
        const result = await priceSyncService.syncProductPrice(productId, tenant_id, options);
        
        res.json({
            success: true,
            message: result.priceChanged ? 
                'Preço sincronizado com sucesso' : 
                'Produto verificado - nenhuma alteração necessária',
            data: result
        });
        
    } catch (error) {
        logger.error(`Error syncing product ${req.params.productId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Falha na sincronização do produto',
            message: error.message
        });
    }
});

/**
 * POST /sync/bulk
 * Sincroniza preços de todos os produtos do tenant
 */
router.post('/bulk', authMiddleware, bulkSyncRateLimit, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const options = {
            forceUpdate: req.body.forceUpdate || false,
            batchSize: req.body.batchSize || priceSyncService.config.batchSize,
            source: 'manual_bulk',
            userId: req.user.id
        };
        
        logger.info(`Bulk price sync requested for tenant ${tenant_id} by user ${req.user.id}`);
        
        // Executar sync em background para não bloquear a resposta
        const syncPromise = priceSyncService.syncAllPrices(tenant_id, options);
        
        // Responder imediatamente
        res.json({
            success: true,
            message: 'Sincronização em massa iniciada',
            estimatedTime: 'A sincronização está em andamento. Você receberá notificações sobre o progresso.',
            batchSize: options.batchSize
        });
        
        // Aguardar resultado em background
        syncPromise.catch(error => {
            logger.error(`Bulk sync failed for tenant ${tenant_id}:`, error);
        });
        
    } catch (error) {
        logger.error(`Error starting bulk sync for tenant ${req.user.tenant_id}:`, error);
        res.status(500).json({
            success: false,
            error: 'Falha ao iniciar sincronização em massa',
            message: error.message
        });
    }
});

/**
 * POST /sync/webhook
 * Processa webhooks de mudança de preço do Bling
 */
router.post('/webhook', async (req, res) => {
    try {
        const webhookData = req.body;
        
        logger.info('Processing Bling price webhook:', {
            productId: webhookData.product_id,
            tenantId: webhookData.tenant_id,
            event: webhookData.event
        });
        
        // Validar webhook (implementar assinatura se necessário)
        if (!webhookData.product_id || !webhookData.tenant_id) {
            return res.status(400).json({
                error: 'Invalid webhook data',
                message: 'product_id and tenant_id are required'
            });
        }
        
        // Processar webhook em background
        priceSyncService.syncPriceFromWebhook(webhookData)
            .catch(error => {
                logger.error('Error processing price webhook:', error);
            });
        
        priceSyncService.metrics.webhooksProcessed++;
        
        res.json({
            success: true,
            message: 'Webhook received and will be processed'
        });
        
    } catch (error) {
        logger.error('Error processing price webhook:', error);
        res.status(500).json({
            error: 'Failed to process webhook',
            message: error.message
        });
    }
});

/**
 * GET /sync/history/:productId
 * Obtém histórico de mudanças de preço de um produto
 */
router.get('/history/:productId', authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const { tenant_id } = req.user;
        const { limit = 50, offset = 0 } = req.query;
        
        const history = await priceSyncService.db('price_history')
            .where({ product_id: productId, tenant_id })
            .orderBy('created_at', 'desc')
            .limit(parseInt(limit))
            .offset(parseInt(offset))
            .select('*');
        
        const total = await priceSyncService.db('price_history')
            .where({ product_id: productId, tenant_id })
            .count('* as count')
            .first();
        
        res.json({
            success: true,
            data: history,
            pagination: {
                total: total.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: total.count > (parseInt(offset) + parseInt(limit))
            }
        });
        
    } catch (error) {
        logger.error(`Error getting price history for product ${req.params.productId}:`, error);
        res.status(500).json({
            error: 'Failed to get price history',
            message: error.message
        });
    }
});

/**
 * GET /sync/policies/:productId
 * Obtém políticas de preço de um produto
 */
router.get('/policies/:productId', authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        
        const policies = await priceSyncService.getProductPricePolicies(productId);
        
        res.json({
            success: true,
            data: policies
        });
        
    } catch (error) {
        logger.error(`Error getting price policies for product ${req.params.productId}:`, error);
        res.status(500).json({
            error: 'Failed to get price policies',
            message: error.message
        });
    }
});

/**
 * POST /sync/policies/:productId
 * Cria ou atualiza política de preço para um produto
 */
router.post('/policies/:productId', authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const { tenant_id } = req.user;
        const policyData = {
            product_id: productId,
            tenant_id,
            type: req.body.type,
            value: req.body.value,
            description: req.body.description,
            active: req.body.active !== false,
            created_by: req.user.id,
            created_at: new Date()
        };
        
        // Validar tipo de política
        const validTypes = ['markup', 'discount', 'fixed_margin', 'minimum_price', 'maximum_price'];
        if (!validTypes.includes(policyData.type)) {
            return res.status(400).json({
                error: 'Invalid policy type',
                validTypes
            });
        }
        
        const [policyId] = await priceSyncService.db('product_price_policies')
            .insert(policyData);
        
        logger.info(`Price policy created for product ${productId}:`, policyData);
        
        res.json({
            success: true,
            message: 'Política de preço criada com sucesso',
            data: { id: policyId, ...policyData }
        });
        
    } catch (error) {
        logger.error(`Error creating price policy for product ${req.params.productId}:`, error);
        res.status(500).json({
            error: 'Failed to create price policy',
            message: error.message
        });
    }
});

/**
 * PUT /sync/config
 * Atualiza configurações do serviço de sincronização
 */
router.put('/config', authMiddleware, async (req, res) => {
    try {
        // Apenas admins podem alterar configurações
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only administrators can update sync configuration'
            });
        }
        
        const newConfig = req.body;
        
        // Validar configurações
        if (newConfig.batchSize && (newConfig.batchSize < 1 || newConfig.batchSize > 100)) {
            return res.status(400).json({
                error: 'Invalid batch size',
                message: 'Batch size must be between 1 and 100'
            });
        }
        
        if (newConfig.syncInterval && newConfig.syncInterval < 60000) {
            return res.status(400).json({
                error: 'Invalid sync interval',
                message: 'Sync interval must be at least 1 minute (60000ms)'
            });
        }
        
        priceSyncService.updateConfig(newConfig);
        
        logger.info(`Sync configuration updated by user ${req.user.id}:`, newConfig);
        
        res.json({
            success: true,
            message: 'Configuração atualizada com sucesso',
            data: priceSyncService.config
        });
        
    } catch (error) {
        logger.error('Error updating sync configuration:', error);
        res.status(500).json({
            error: 'Failed to update configuration',
            message: error.message
        });
    }
});

/**
 * POST /sync/cache/clear
 * Limpa cache de preços
 */
router.post('/cache/clear', authMiddleware, async (req, res) => {
    try {
        // Apenas admins podem limpar cache
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Only administrators can clear price cache'
            });
        }
        
        const cacheSize = priceSyncService.priceCache.size;
        priceSyncService.clearPriceCache();
        
        logger.info(`Price cache cleared by user ${req.user.id}. ${cacheSize} entries removed.`);
        
        res.json({
            success: true,
            message: `Cache limpo com sucesso. ${cacheSize} entradas removidas.`,
            clearedEntries: cacheSize
        });
        
    } catch (error) {
        logger.error('Error clearing price cache:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            message: error.message
        });
    }
});

/**
 * GET /sync/conflicts
 * Lista conflitos de preço não resolvidos
 */
router.get('/conflicts', authMiddleware, async (req, res) => {
    try {
        const { tenant_id } = req.user;
        
        // Buscar produtos com conflitos recentes
        const conflicts = await priceSyncService.db('price_conflicts')
            .where({ tenant_id, resolved: false })
            .orderBy('created_at', 'desc')
            .limit(100);
        
        res.json({
            success: true,
            data: conflicts,
            total: conflicts.length
        });
        
    } catch (error) {
        logger.error('Error getting price conflicts:', error);
        res.status(500).json({
            error: 'Failed to get price conflicts',
            message: error.message
        });
    }
});

/**
 * POST /sync/conflicts/:conflictId/resolve
 * Resolve um conflito de preço específico
 */
router.post('/conflicts/:conflictId/resolve', authMiddleware, async (req, res) => {
    try {
        const { conflictId } = req.params;
        const { resolution, price } = req.body; // 'bling', 'local', 'custom'
        
        if (!['bling', 'local', 'custom'].includes(resolution)) {
            return res.status(400).json({
                error: 'Invalid resolution type',
                validTypes: ['bling', 'local', 'custom']
            });
        }
        
        if (resolution === 'custom' && !price) {
            return res.status(400).json({
                error: 'Custom price required',
                message: 'Price value is required for custom resolution'
            });
        }
        
        // Implementar lógica de resolução
        await priceSyncService.db('price_conflicts')
            .where({ id: conflictId })
            .update({
                resolved: true,
                resolution_type: resolution,
                resolution_price: price,
                resolved_by: req.user.id,
                resolved_at: new Date()
            });
        
        logger.info(`Price conflict ${conflictId} resolved as '${resolution}' by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Conflito resolvido com sucesso'
        });
        
    } catch (error) {
        logger.error(`Error resolving price conflict ${req.params.conflictId}:`, error);
        res.status(500).json({
            error: 'Failed to resolve conflict',
            message: error.message
        });
    }
});

/**
 * Utility function para formatar uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

module.exports = router;