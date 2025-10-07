/**
 * Conflict Resolution Routes - Rotas para Sistema de Resolução de Conflitos
 * 
 * Endpoints RESTful para gerenciar conflitos de dados entre sistemas
 * Inclui detecção automática, resolução manual e ferramentas administrativas
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const ConflictResolutionController = require('../controllers/ConflictResolutionController');

const router = express.Router();

// Rate limiting específico para conflitos
const conflictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por janela
    message: {
        success: false,
        error: 'Muitas requisições. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting mais restritivo para operações pesadas
const heavyOperationLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // máximo 10 requests por janela
    message: {
        success: false,
        error: 'Limite de operações atingido. Tente novamente em 5 minutos.'
    }
});

// Middleware de autenticação (será injetado externamente)
const authenticate = (req, res, next) => {
    // Este middleware será substituído pela autenticação real do sistema
    if (!req.user && !req.headers.authorization) {
        return res.status(401).json({
            success: false,
            error: 'Autenticação necessária'
        });
    }
    next();
};

// Middleware de autorização para operações administrativas
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.roles?.includes('admin')) {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado. Privilégios de administrador necessários.'
        });
    }
    next();
};

// Middleware de tenant (multi-tenancy)
const resolveTenant = (req, res, next) => {
    // Resolver tenant a partir do usuário ou headers
    req.tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    next();
};

// Middleware de logging
const logRequest = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[ConflictAPI] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
};

// Middleware de validação
const handleValidationErrors = (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            details: errors.array()
        });
    }
    
    next();
};

// Inicializar controller
const conflictController = new ConflictResolutionController();

// Aplicar middlewares globais
router.use(conflictRateLimit);
router.use(authenticate);
router.use(resolveTenant);
router.use(logRequest);

/**
 * @route GET /api/conflicts
 * @desc Listar conflitos com filtros e paginação
 * @access Private
 */
router.get('/', 
    conflictController.getConflicts
);

/**
 * @route GET /api/conflicts/summary
 * @desc Obter resumo geral de conflitos
 * @access Private
 */
router.get('/summary',
    conflictController.getConflictSummary
);

/**
 * @route GET /api/conflicts/metrics
 * @desc Obter métricas detalhadas de conflitos
 * @access Private
 */
router.get('/metrics',
    conflictController.getMetrics
);

/**
 * @route GET /api/conflicts/history
 * @desc Obter histórico de resoluções
 * @access Private
 */
router.get('/history',
    conflictController.getResolutionHistory
);

/**
 * @route GET /api/conflicts/strategies
 * @desc Obter estratégias de resolução disponíveis
 * @access Private
 */
router.get('/strategies',
    conflictController.getResolutionStrategies
);

/**
 * @route GET /api/conflicts/export
 * @desc Exportar conflitos em JSON ou CSV
 * @access Admin
 */
router.get('/export',
    requireAdmin,
    conflictController.exportConflicts
);

/**
 * @route POST /api/conflicts/detect
 * @desc Executar detecção manual de conflitos
 * @access Private
 */
router.post('/detect',
    heavyOperationLimit,
    conflictController.detectConflicts
);

/**
 * @route POST /api/conflicts/bulk-resolve
 * @desc Resolver múltiplos conflitos em lote
 * @access Admin
 */
router.post('/bulk-resolve',
    requireAdmin,
    heavyOperationLimit,
    ConflictResolutionController.getValidationRules().bulkResolve,
    handleValidationErrors,
    conflictController.bulkResolve
);

/**
 * @route PUT /api/conflicts/strategies/config
 * @desc Atualizar configuração de estratégias
 * @access Admin
 */
router.put('/strategies/config',
    requireAdmin,
    conflictController.updateResolutionStrategy
);

/**
 * @route GET /api/conflicts/:id
 * @desc Obter detalhes de conflito específico
 * @access Private
 */
router.get('/:id',
    conflictController.getConflictById
);

/**
 * @route POST /api/conflicts/:id/resolve
 * @desc Resolver conflito manualmente
 * @access Private
 */
router.post('/:id/resolve',
    ConflictResolutionController.getValidationRules().resolveManually,
    handleValidationErrors,
    conflictController.resolveManually
);

/**
 * @route POST /api/conflicts/:id/ignore
 * @desc Ignorar conflito específico
 * @access Private
 */
router.post('/:id/ignore',
    ConflictResolutionController.getValidationRules().ignoreConflict,
    handleValidationErrors,
    conflictController.ignoreConflict
);

/**
 * @route GET /api/conflicts/health
 * @desc Health check do serviço de conflitos
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'conflict-resolution',
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        features: [
            'conflict_detection',
            'manual_resolution', 
            'bulk_operations',
            'export_capabilities',
            'metrics_tracking'
        ]
    });
});

// Middleware de tratamento de erros
router.use((error, req, res, next) => {
    console.error('Erro na API de Conflitos:', error);
    
    // Erro de validação
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            details: error.message
        });
    }
    
    // Erro de autorização
    if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: 'Token inválido ou expirado'
        });
    }
    
    // Erro de rate limiting
    if (error.status === 429) {
        return res.status(429).json({
            success: false,
            error: 'Muitas requisições',
            retryAfter: error.retryAfter
        });
    }
    
    // Erro genérico
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        requestId: req.id || 'unknown'
    });
});

// Documentação das rotas (Swagger-like)
router.get('/docs', (req, res) => {
    res.json({
        title: 'Conflict Resolution API',
        version: '1.0.0',
        description: 'API para gerenciamento de conflitos de dados entre sistemas',
        
        endpoints: [
            {
                method: 'GET',
                path: '/api/conflicts',
                description: 'Listar conflitos com filtros',
                parameters: [
                    'status: string (pending|resolved|ignored)',
                    'type: string (product_data|price_minor|stock_major|etc)',
                    'severity: string (low|medium|high)',
                    'tenantId: number',
                    'page: number (default: 1)',
                    'limit: number (default: 50)'
                ]
            },
            {
                method: 'GET',
                path: '/api/conflicts/:id',
                description: 'Obter detalhes de conflito específico',
                parameters: ['id: string (conflict ID)']
            },
            {
                method: 'POST',
                path: '/api/conflicts/detect', 
                description: 'Executar detecção manual',
                body: {
                    tenantId: 'number (optional)',
                    types: 'array (optional)'
                }
            },
            {
                method: 'POST',
                path: '/api/conflicts/:id/resolve',
                description: 'Resolver conflito manualmente',
                body: {
                    strategy: 'string (timestamp_priority|source_priority|smart_merge|value_based|manual_required)',
                    chosenSource: 'string (local|bling|merged|custom)',
                    customData: 'object (optional)',
                    reason: 'string (optional)'
                }
            },
            {
                method: 'POST',
                path: '/api/conflicts/:id/ignore',
                description: 'Ignorar conflito',
                body: {
                    reason: 'string (required)'
                }
            },
            {
                method: 'GET',
                path: '/api/conflicts/metrics',
                description: 'Obter métricas de conflitos',
                parameters: [
                    'period: string (7d|30d|90d)',
                    'tenantId: number (optional)'
                ]
            },
            {
                method: 'POST',
                path: '/api/conflicts/bulk-resolve',
                description: 'Resolver múltiplos conflitos',
                body: {
                    conflictIds: 'array (optional)',
                    filters: 'object (optional)', 
                    strategy: 'string (required)'
                }
            },
            {
                method: 'GET',
                path: '/api/conflicts/export',
                description: 'Exportar conflitos',
                parameters: [
                    'format: string (json|csv)',
                    'status: string (optional)',
                    'type: string (optional)'
                ]
            }
        ],
        
        responseFormat: {
            success: 'boolean',
            data: 'object|array',
            error: 'string (when success=false)',
            pagination: 'object (when applicable)'
        },
        
        conflictTypes: [
            'product_data - Dados básicos do produto diferentes',
            'price_minor - Diferença de preço < 20%',  
            'price_major - Diferença de preço >= 20%',
            'stock_minor - Diferença de estoque < 50 unidades',
            'stock_major - Diferença de estoque >= 50 unidades',
            'order_status - Status de pedido conflitante',
            'product_deletion - Produto deletado em uma fonte'
        ],
        
        resolutionStrategies: [
            'timestamp_priority - Usar dados mais recentes',
            'source_priority - Priorizar fonte específica (Bling/Local)',
            'smart_merge - Combinar dados inteligentemente', 
            'value_based - Escolher baseado em valores (maior/menor)',
            'manual_required - Sempre requer intervenção manual'
        ]
    });
});

module.exports = router;