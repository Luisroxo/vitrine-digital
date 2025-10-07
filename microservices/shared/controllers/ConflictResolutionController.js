/**
 * ConflictResolutionController - API Controller para Resolução de Conflitos
 * 
 * Endpoints para gerenciar detecção e resolução de conflitos de dados
 * Inclui ferramentas manuais e automáticas de resolução
 */

const ConflictResolutionService = require('../services/ConflictResolutionService');
const { body, param, query, validationResult } = require('express-validator');

class ConflictResolutionController {
    constructor(options = {}) {
        this.conflictService = options.conflictService || new ConflictResolutionService(options);
        
        // Bind methods
        this.getConflicts = this.getConflicts.bind(this);
        this.getConflictById = this.getConflictById.bind(this);
        this.detectConflicts = this.detectConflicts.bind(this);
        this.resolveManually = this.resolveManually.bind(this);
        this.ignoreConflict = this.ignoreConflict.bind(this);
        this.getMetrics = this.getMetrics.bind(this);
        this.getResolutionHistory = this.getResolutionHistory.bind(this);
        this.getResolutionStrategies = this.getResolutionStrategies.bind(this);
        this.updateResolutionStrategy = this.updateResolutionStrategy.bind(this);
        this.bulkResolve = this.bulkResolve.bind(this);
        this.exportConflicts = this.exportConflicts.bind(this);
        this.getConflictSummary = this.getConflictSummary.bind(this);
    }
    
    /**
     * Listar conflitos com filtros
     * GET /api/conflicts
     */
    async getConflicts(req, res) {
        try {
            const {
                status,
                type,
                severity,
                tenantId,
                page = 1,
                limit = 50,
                sortBy = 'detectedAt',
                sortOrder = 'desc'
            } = req.query;
            
            const filters = {};
            if (status) filters.status = status;
            if (type) filters.type = type;
            if (severity) filters.severity = severity;
            if (tenantId) filters.tenantId = tenantId;
            
            const conflicts = await this.conflictService.getConflictsForManualReview(filters);
            
            // Paginação
            const offset = (page - 1) * limit;
            const paginatedConflicts = conflicts
                .sort((a, b) => {
                    const aVal = a[sortBy];
                    const bVal = b[sortBy];
                    
                    if (sortOrder === 'desc') {
                        return new Date(bVal) - new Date(aVal);
                    }
                    return new Date(aVal) - new Date(bVal);
                })
                .slice(offset, offset + parseInt(limit));
            
            res.json({
                success: true,
                data: {
                    conflicts: paginatedConflicts,
                    pagination: {
                        total: conflicts.length,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(conflicts.length / limit)
                    }
                }
            });
            
        } catch (error) {
            console.error('Erro ao buscar conflitos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
    
    /**
     * Obter conflito específico
     * GET /api/conflicts/:id
     */
    async getConflictById(req, res) {
        try {
            const { id } = req.params;
            
            const conflict = this.conflictService.conflicts.get(id);
            
            if (!conflict) {
                return res.status(404).json({
                    success: false,
                    error: 'Conflito não encontrado'
                });
            }
            
            res.json({
                success: true,
                data: conflict
            });
            
        } catch (error) {
            console.error('Erro ao buscar conflito:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno do servidor'
            });
        }
    }
    
    /**
     * Executar detecção manual de conflitos
     * POST /api/conflicts/detect
     */
    async detectConflicts(req, res) {
        try {
            const { tenantId, types } = req.body;
            
            // Executar detecção
            const conflicts = await this.conflictService.detectConflicts();
            
            // Filtrar por tenant se especificado
            let filteredConflicts = conflicts;
            if (tenantId) {
                filteredConflicts = conflicts.filter(c => c.tenantId === tenantId);
            }
            
            // Filtrar por tipos se especificado
            if (types && Array.isArray(types)) {
                filteredConflicts = filteredConflicts.filter(c => types.includes(c.type));
            }
            
            res.json({
                success: true,
                data: {
                    detected: filteredConflicts.length,
                    total: conflicts.length,
                    conflicts: filteredConflicts
                }
            });
            
        } catch (error) {
            console.error('Erro na detecção de conflitos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro na detecção de conflitos'
            });
        }
    }
    
    /**
     * Resolver conflito manualmente
     * POST /api/conflicts/:id/resolve
     */
    async resolveManually(req, res) {
        try {
            const { id } = req.params;
            const { strategy, chosenSource, customData, reason } = req.body;
            const userId = req.user?.id || 'system';
            
            const resolution = {
                strategy,
                chosen_source: chosenSource,
                data: customData,
                reason,
                manual: true
            };
            
            const result = await this.conflictService.resolveManually(id, resolution, userId);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Conflito resolvido com sucesso',
                    data: result.conflict
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('Erro na resolução manual:', error);
            res.status(500).json({
                success: false,
                error: 'Erro na resolução manual'
            });
        }
    }
    
    /**
     * Ignorar conflito
     * POST /api/conflicts/:id/ignore
     */
    async ignoreConflict(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id || 'system';
            
            const result = await this.conflictService.ignoreConflict(id, reason, userId);
            
            res.json({
                success: true,
                message: 'Conflito ignorado com sucesso'
            });
            
        } catch (error) {
            console.error('Erro ao ignorar conflito:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao ignorar conflito'
            });
        }
    }
    
    /**
     * Obter métricas de conflitos
     * GET /api/conflicts/metrics
     */
    async getMetrics(req, res) {
        try {
            const { period = '7d', tenantId } = req.query;
            
            const metrics = this.conflictService.getMetrics();
            
            // Adicionar métricas específicas do período se necessário
            const response = {
                ...metrics,
                period,
                generatedAt: new Date()
            };
            
            res.json({
                success: true,
                data: response
            });
            
        } catch (error) {
            console.error('Erro ao obter métricas:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter métricas'
            });
        }
    }
    
    /**
     * Obter histórico de resoluções
     * GET /api/conflicts/history
     */
    async getResolutionHistory(req, res) {
        try {
            const { page = 1, limit = 50 } = req.query;
            
            const history = Array.from(this.conflictService.resolutionHistory.values());
            
            // Paginação
            const offset = (page - 1) * limit;
            const paginatedHistory = history
                .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))
                .slice(offset, offset + parseInt(limit));
            
            res.json({
                success: true,
                data: {
                    history: paginatedHistory,
                    pagination: {
                        total: history.length,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(history.length / limit)
                    }
                }
            });
            
        } catch (error) {
            console.error('Erro ao obter histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter histórico'
            });
        }
    }
    
    /**
     * Obter estratégias de resolução disponíveis
     * GET /api/conflicts/strategies
     */
    async getResolutionStrategies(req, res) {
        try {
            const strategies = this.conflictService.config.strategies;
            
            const formattedStrategies = Object.keys(strategies).map(key => ({
                id: key,
                name: strategies[key].name,
                description: strategies[key].description
            }));
            
            res.json({
                success: true,
                data: {
                    strategies: formattedStrategies,
                    defaultStrategy: this.conflictService.config.defaultStrategy
                }
            });
            
        } catch (error) {
            console.error('Erro ao obter estratégias:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter estratégias'
            });
        }
    }
    
    /**
     * Atualizar configuração de estratégia
     * PUT /api/conflicts/strategies/config
     */
    async updateResolutionStrategy(req, res) {
        try {
            const { defaultStrategy, autoResolveTypes, conflictThreshold } = req.body;
            
            if (defaultStrategy) {
                if (!this.conflictService.config.strategies[defaultStrategy]) {
                    return res.status(400).json({
                        success: false,
                        error: 'Estratégia inválida'
                    });
                }
                this.conflictService.config.defaultStrategy = defaultStrategy;
            }
            
            if (autoResolveTypes && Array.isArray(autoResolveTypes)) {
                this.conflictService.config.autoResolveTypes = autoResolveTypes;
            }
            
            if (conflictThreshold && typeof conflictThreshold === 'number') {
                this.conflictService.config.conflictThreshold = conflictThreshold;
            }
            
            res.json({
                success: true,
                message: 'Configuração atualizada com sucesso',
                data: {
                    defaultStrategy: this.conflictService.config.defaultStrategy,
                    autoResolveTypes: this.conflictService.config.autoResolveTypes,
                    conflictThreshold: this.conflictService.config.conflictThreshold
                }
            });
            
        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao atualizar configuração'
            });
        }
    }
    
    /**
     * Resolução em lote
     * POST /api/conflicts/bulk-resolve
     */
    async bulkResolve(req, res) {
        try {
            const { conflictIds, strategy, filters } = req.body;
            const userId = req.user?.id || 'system';
            
            let conflictsToResolve = [];
            
            if (conflictIds && Array.isArray(conflictIds)) {
                // Resolver IDs específicos
                conflictsToResolve = conflictIds
                    .map(id => this.conflictService.conflicts.get(id))
                    .filter(Boolean);
            } else if (filters) {
                // Resolver por filtros
                conflictsToResolve = await this.conflictService.getConflictsForManualReview(filters);
            }
            
            const results = {
                total: conflictsToResolve.length,
                resolved: 0,
                failed: 0,
                errors: []
            };
            
            for (const conflict of conflictsToResolve) {
                try {
                    const resolution = {
                        strategy,
                        bulk: true,
                        reason: 'Resolução em lote'
                    };
                    
                    const result = await this.conflictService.resolveManually(
                        conflict.id, 
                        resolution, 
                        userId
                    );
                    
                    if (result.success) {
                        results.resolved++;
                    } else {
                        results.failed++;
                        results.errors.push({
                            conflictId: conflict.id,
                            error: result.error
                        });
                    }
                    
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        conflictId: conflict.id,
                        error: error.message
                    });
                }
            }
            
            res.json({
                success: true,
                message: `Processamento em lote concluído: ${results.resolved} resolvidos, ${results.failed} falharam`,
                data: results
            });
            
        } catch (error) {
            console.error('Erro na resolução em lote:', error);
            res.status(500).json({
                success: false,
                error: 'Erro na resolução em lote'
            });
        }
    }
    
    /**
     * Exportar conflitos
     * GET /api/conflicts/export
     */
    async exportConflicts(req, res) {
        try {
            const { format = 'json', status, type, tenantId } = req.query;
            
            const filters = {};
            if (status) filters.status = status;
            if (type) filters.type = type;
            if (tenantId) filters.tenantId = tenantId;
            
            const conflicts = await this.conflictService.getConflictsForManualReview(filters);
            
            if (format === 'csv') {
                // Converter para CSV
                const csv = this.convertToCSV(conflicts);
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=conflicts.csv');
                res.send(csv);
            } else {
                // JSON
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=conflicts.json');
                res.json({
                    exportedAt: new Date(),
                    filters,
                    total: conflicts.length,
                    conflicts
                });
            }
            
        } catch (error) {
            console.error('Erro na exportação:', error);
            res.status(500).json({
                success: false,
                error: 'Erro na exportação'
            });
        }
    }
    
    /**
     * Obter resumo de conflitos
     * GET /api/conflicts/summary
     */
    async getConflictSummary(req, res) {
        try {
            const { tenantId } = req.query;
            
            const allConflicts = await this.conflictService.getConflictsForManualReview();
            
            let conflicts = allConflicts;
            if (tenantId) {
                conflicts = allConflicts.filter(c => c.tenantId === tenantId);
            }
            
            const summary = {
                total: conflicts.length,
                byStatus: {},
                byType: {},
                bySeverity: {},
                recentActivity: conflicts
                    .filter(c => {
                        const dayAgo = new Date();
                        dayAgo.setDate(dayAgo.getDate() - 1);
                        return new Date(c.detectedAt) > dayAgo;
                    }).length,
                oldestPending: null,
                averageResolutionTime: 0
            };
            
            // Contadores
            conflicts.forEach(conflict => {
                // Por status
                summary.byStatus[conflict.status] = (summary.byStatus[conflict.status] || 0) + 1;
                
                // Por tipo
                summary.byType[conflict.type] = (summary.byType[conflict.type] || 0) + 1;
                
                // Por severidade
                summary.bySeverity[conflict.severity] = (summary.bySeverity[conflict.severity] || 0) + 1;
                
                // Conflito pendente mais antigo
                if (conflict.status === 'pending') {
                    if (!summary.oldestPending || 
                        new Date(conflict.detectedAt) < new Date(summary.oldestPending.detectedAt)) {
                        summary.oldestPending = conflict;
                    }
                }
            });
            
            res.json({
                success: true,
                data: summary
            });
            
        } catch (error) {
            console.error('Erro ao obter resumo:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter resumo'
            });
        }
    }
    
    /**
     * Converter conflitos para CSV
     */
    convertToCSV(conflicts) {
        if (conflicts.length === 0) return '';
        
        const headers = ['ID', 'Type', 'Severity', 'Status', 'Entity Type', 'Entity ID', 'Detected At', 'Resolved At'];
        const rows = conflicts.map(conflict => [
            conflict.id,
            conflict.type,
            conflict.severity,
            conflict.status,
            conflict.entityType,
            conflict.entityId,
            conflict.detectedAt,
            conflict.resolvedAt || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }
    
    /**
     * Validações para os endpoints
     */
    static getValidationRules() {
        return {
            resolveManually: [
                param('id').notEmpty().withMessage('ID do conflito é obrigatório'),
                body('strategy').notEmpty().withMessage('Estratégia é obrigatória'),
                body('chosenSource').isIn(['local', 'bling', 'merged', 'custom']).withMessage('Fonte inválida'),
                body('reason').optional().isString().withMessage('Motivo deve ser texto')
            ],
            
            ignoreConflict: [
                param('id').notEmpty().withMessage('ID do conflito é obrigatório'),
                body('reason').notEmpty().withMessage('Motivo é obrigatório')
            ],
            
            bulkResolve: [
                body().custom((value) => {
                    if (!value.conflictIds && !value.filters) {
                        throw new Error('É necessário especificar conflictIds ou filters');
                    }
                    return true;
                }),
                body('strategy').notEmpty().withMessage('Estratégia é obrigatória')
            ]
        };
    }
}

module.exports = ConflictResolutionController;