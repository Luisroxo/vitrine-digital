/**
 * ConflictResolutionService - Sistema Avançado de Resolução de Conflitos
 * 
 * Detecta, analisa e resolve conflitos de dados entre sistemas
 * Suporta múltiplas estratégias de resolução e ferramentas manuais
 * 
 * Funcionalidades:
 * - Detecção automática de conflitos multi-dimensional
 * - Estratégias de resolução configuráveis
 * - Ferramentas manuais de resolução
 * - Histórico completo de conflitos
 * - Métricas e analytics de conflitos
 * - Sistema de notificações
 */

const EventEmitter = require('events');

class ConflictResolutionService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            // Configurações de detecção
            detectionInterval: options.detectionInterval || 300000, // 5 min
            conflictThreshold: options.conflictThreshold || 0.1, // 10% diferença
            autoResolveTypes: options.autoResolveTypes || ['price_minor', 'stock_minor'],
            
            // Configurações de resolução  
            defaultStrategy: options.defaultStrategy || 'timestamp_priority',
            strategies: options.strategies || this.getDefaultStrategies(),
            
            // Configurações de notificação
            notifyOnConflict: options.notifyOnConflict || true,
            criticalConflictTypes: options.criticalConflictTypes || ['price_major', 'product_deletion'],
            
            ...options
        };
        
        this.conflicts = new Map(); // Cache de conflitos ativos
        this.resolutionHistory = new Map(); // Histórico de resoluções
        this.metrics = this.initializeMetrics();
        
        // Database connections (será injetado)
        this.db = options.db;
        this.redis = options.redis;
        
        this.startConflictDetection();
    }
    
    /**
     * Estratégias padrão de resolução
     */
    getDefaultStrategies() {
        return {
            // Prioridade por timestamp (mais recente vence)
            timestamp_priority: {
                name: 'Timestamp Priority',
                description: 'O dado mais recente prevalece',
                handler: this.resolveByTimestamp.bind(this)
            },
            
            // Prioridade por fonte (Bling vs Local)
            source_priority: {
                name: 'Source Priority', 
                description: 'Uma fonte específica sempre prevalece',
                handler: this.resolveBySource.bind(this)
            },
            
            // Merge inteligente
            smart_merge: {
                name: 'Smart Merge',
                description: 'Combina dados de ambas as fontes',
                handler: this.resolveBySmartMerge.bind(this)
            },
            
            // Valor maior/menor
            value_based: {
                name: 'Value Based',
                description: 'Escolhe baseado no valor (maior/menor)',
                handler: this.resolveByValue.bind(this)
            },
            
            // Resolução manual obrigatória
            manual_required: {
                name: 'Manual Required',
                description: 'Sempre requer intervenção manual',
                handler: this.requireManualResolution.bind(this)
            }
        };
    }
    
    /**
     * Inicializa métricas de conflitos
     */
    initializeMetrics() {
        return {
            totalConflicts: 0,
            resolvedConflicts: 0,
            pendingConflicts: 0,
            autoResolved: 0,
            manualResolved: 0,
            byType: new Map(),
            byStrategy: new Map(),
            resolutionTime: [],
            lastUpdated: new Date()
        };
    }
    
    /**
     * Inicia detecção automática de conflitos
     */
    startConflictDetection() {
        setInterval(() => {
            this.detectConflicts().catch(error => {
                console.error('Erro na detecção de conflitos:', error);
                this.emit('detection_error', error);
            });
        }, this.config.detectionInterval);
        
        console.log(`🔍 Conflict Detection iniciado (intervalo: ${this.config.detectionInterval}ms)`);
    }
    
    /**
     * Detecta conflitos entre fontes de dados
     */
    async detectConflicts() {
        const startTime = Date.now();
        
        try {
            // Detectar conflitos de produtos
            const productConflicts = await this.detectProductConflicts();
            
            // Detectar conflitos de preços
            const priceConflicts = await this.detectPriceConflicts();
            
            // Detectar conflitos de estoque  
            const stockConflicts = await this.detectStockConflicts();
            
            // Detectar conflitos de pedidos
            const orderConflicts = await this.detectOrderConflicts();
            
            const allConflicts = [
                ...productConflicts,
                ...priceConflicts, 
                ...stockConflicts,
                ...orderConflicts
            ];
            
            // Processar conflitos detectados
            for (const conflict of allConflicts) {
                await this.processConflict(conflict);
            }
            
            const detectionTime = Date.now() - startTime;
            
            console.log(`🔍 Detecção de conflitos concluída: ${allConflicts.length} conflitos em ${detectionTime}ms`);
            
            this.emit('detection_completed', {
                conflicts: allConflicts.length,
                time: detectionTime
            });
            
            return allConflicts;
            
        } catch (error) {
            console.error('Erro na detecção de conflitos:', error);
            throw error;
        }
    }
    
    /**
     * Detecta conflitos de produtos
     */
    async detectProductConflicts() {
        const conflicts = [];
        
        try {
            // Buscar produtos com possíveis conflitos
            const query = `
                SELECT 
                    p1.id as local_id,
                    p1.name as local_name,
                    p1.description as local_description,
                    p1.updated_at as local_updated,
                    p1.bling_id,
                    bs.name as bling_name,
                    bs.description as bling_description,
                    bs.updated_at as bling_updated,
                    bs.tenant_id
                FROM products p1
                LEFT JOIN bling_sync_data bs ON p1.bling_id = bs.bling_product_id
                WHERE p1.bling_id IS NOT NULL
                AND (
                    p1.name != bs.name OR
                    p1.description != bs.description OR
                    ABS(EXTRACT(EPOCH FROM (p1.updated_at - bs.updated_at))) > 300
                )
            `;
            
            const results = await this.db.raw(query);
            
            for (const row of results.rows || []) {
                const conflict = {
                    id: `product_${row.local_id}_${Date.now()}`,
                    type: 'product_data',
                    severity: this.calculateSeverity('product', row),
                    entityType: 'product',
                    entityId: row.local_id,
                    blingId: row.bling_id,
                    tenantId: row.tenant_id,
                    
                    localData: {
                        name: row.local_name,
                        description: row.local_description,
                        updatedAt: row.local_updated
                    },
                    
                    blingData: {
                        name: row.bling_name,
                        description: row.bling_description,
                        updatedAt: row.bling_updated
                    },
                    
                    differences: this.identifyDifferences(
                        { name: row.local_name, description: row.local_description },
                        { name: row.bling_name, description: row.bling_description }
                    ),
                    
                    detectedAt: new Date(),
                    status: 'pending'
                };
                
                conflicts.push(conflict);
            }
            
        } catch (error) {
            console.error('Erro ao detectar conflitos de produtos:', error);
        }
        
        return conflicts;
    }
    
    /**
     * Detecta conflitos de preços
     */
    async detectPriceConflicts() {
        const conflicts = [];
        
        try {
            const query = `
                SELECT 
                    p.id as product_id,
                    p.price as local_price,
                    p.bling_id,
                    bs.price as bling_price,
                    p.updated_at as local_updated,
                    bs.updated_at as bling_updated,
                    bs.tenant_id
                FROM products p
                LEFT JOIN bling_sync_data bs ON p.bling_id = bs.bling_product_id
                WHERE p.bling_id IS NOT NULL
                AND ABS(p.price - bs.price) > (p.price * ${this.config.conflictThreshold})
            `;
            
            const results = await this.db.raw(query);
            
            for (const row of results.rows || []) {
                const priceDiff = Math.abs(row.local_price - row.bling_price);
                const percentageDiff = (priceDiff / row.local_price) * 100;
                
                const conflict = {
                    id: `price_${row.product_id}_${Date.now()}`,
                    type: percentageDiff > 20 ? 'price_major' : 'price_minor',
                    severity: percentageDiff > 20 ? 'high' : 'medium',
                    entityType: 'product',
                    entityId: row.product_id,
                    blingId: row.bling_id,
                    tenantId: row.tenant_id,
                    
                    localData: {
                        price: row.local_price,
                        updatedAt: row.local_updated
                    },
                    
                    blingData: {
                        price: row.bling_price,
                        updatedAt: row.bling_updated
                    },
                    
                    metadata: {
                        priceDifference: priceDiff,
                        percentageDifference: percentageDiff
                    },
                    
                    detectedAt: new Date(),
                    status: 'pending'
                };
                
                conflicts.push(conflict);
            }
            
        } catch (error) {
            console.error('Erro ao detectar conflitos de preços:', error);
        }
        
        return conflicts;
    }
    
    /**
     * Detecta conflitos de estoque
     */
    async detectStockConflicts() {
        const conflicts = [];
        
        try {
            const query = `
                SELECT 
                    p.id as product_id,
                    p.stock_quantity as local_stock,
                    p.bling_id,
                    bs.stock_quantity as bling_stock,
                    p.updated_at as local_updated,
                    bs.updated_at as bling_updated,
                    bs.tenant_id
                FROM products p
                LEFT JOIN bling_sync_data bs ON p.bling_id = bs.bling_product_id
                WHERE p.bling_id IS NOT NULL
                AND ABS(p.stock_quantity - bs.stock_quantity) > 5
            `;
            
            const results = await this.db.raw(query);
            
            for (const row of results.rows || []) {
                const stockDiff = Math.abs(row.local_stock - row.bling_stock);
                
                const conflict = {
                    id: `stock_${row.product_id}_${Date.now()}`,
                    type: stockDiff > 50 ? 'stock_major' : 'stock_minor', 
                    severity: stockDiff > 50 ? 'high' : 'low',
                    entityType: 'product',
                    entityId: row.product_id,
                    blingId: row.bling_id,
                    tenantId: row.tenant_id,
                    
                    localData: {
                        stock: row.local_stock,
                        updatedAt: row.local_updated
                    },
                    
                    blingData: {
                        stock: row.bling_stock,
                        updatedAt: row.bling_updated
                    },
                    
                    metadata: {
                        stockDifference: stockDiff
                    },
                    
                    detectedAt: new Date(),
                    status: 'pending'
                };
                
                conflicts.push(conflict);
            }
            
        } catch (error) {
            console.error('Erro ao detectar conflitos de estoque:', error);
        }
        
        return conflicts;
    }
    
    /**
     * Detecta conflitos de pedidos
     */
    async detectOrderConflicts() {
        const conflicts = [];
        
        try {
            // Implementar detecção de conflitos de pedidos
            // Por exemplo: status diferentes, valores diferentes, etc.
            
        } catch (error) {
            console.error('Erro ao detectar conflitos de pedidos:', error);
        }
        
        return conflicts;
    }
    
    /**
     * Processa um conflito detectado
     */
    async processConflict(conflict) {
        try {
            // Armazenar conflito
            this.conflicts.set(conflict.id, conflict);
            
            // Atualizar métricas
            this.updateMetrics('detected', conflict);
            
            // Verificar se pode ser resolvido automaticamente
            if (this.canAutoResolve(conflict)) {
                await this.autoResolveConflict(conflict);
            } else {
                // Notificar sobre conflito que requer atenção
                await this.notifyConflict(conflict);
            }
            
            // Persistir no banco se necessário
            if (conflict.severity === 'high' || conflict.type.includes('major')) {
                await this.persistConflict(conflict);
            }
            
            this.emit('conflict_detected', conflict);
            
        } catch (error) {
            console.error('Erro ao processar conflito:', error);
            this.emit('processing_error', { conflict, error });
        }
    }
    
    /**
     * Verifica se conflito pode ser resolvido automaticamente
     */
    canAutoResolve(conflict) {
        return this.config.autoResolveTypes.includes(conflict.type) &&
               conflict.severity !== 'high';
    }
    
    /**
     * Resolve conflito automaticamente
     */
    async autoResolveConflict(conflict) {
        try {
            const strategy = this.config.strategies[this.config.defaultStrategy];
            
            if (!strategy) {
                throw new Error(`Estratégia não encontrada: ${this.config.defaultStrategy}`);
            }
            
            const resolution = await strategy.handler(conflict);
            
            if (resolution.success) {
                conflict.status = 'resolved';
                conflict.resolvedAt = new Date();
                conflict.resolution = resolution;
                conflict.resolvedBy = 'auto';
                
                // Aplicar resolução
                await this.applyResolution(conflict, resolution);
                
                this.updateMetrics('auto_resolved', conflict);
                this.emit('conflict_resolved', conflict);
                
                console.log(`✅ Conflito resolvido automaticamente: ${conflict.id}`);
            }
            
        } catch (error) {
            console.error('Erro na resolução automática:', error);
            conflict.autoResolutionError = error.message;
        }
    }
    
    /**
     * Estratégia: Resolução por timestamp
     */
    async resolveByTimestamp(conflict) {
        const localTime = new Date(conflict.localData.updatedAt);
        const blingTime = new Date(conflict.blingData.updatedAt);
        
        const useLocal = localTime > blingTime;
        
        return {
            success: true,
            strategy: 'timestamp_priority',
            chosen_source: useLocal ? 'local' : 'bling',
            data: useLocal ? conflict.localData : conflict.blingData,
            reason: `Dado ${useLocal ? 'local' : 'Bling'} é mais recente`
        };
    }
    
    /**
     * Estratégia: Resolução por fonte
     */
    async resolveBySource(conflict) {
        const preferredSource = this.config.preferredSource || 'bling';
        
        return {
            success: true,
            strategy: 'source_priority',
            chosen_source: preferredSource,
            data: preferredSource === 'local' ? conflict.localData : conflict.blingData,
            reason: `Fonte preferencial: ${preferredSource}`
        };
    }
    
    /**
     * Estratégia: Merge inteligente
     */
    async resolveBySmartMerge(conflict) {
        const merged = { ...conflict.localData };
        
        // Lógica específica por tipo de conflito
        if (conflict.type.includes('price')) {
            // Para preços, usar o menor para não prejudicar vendas
            merged.price = Math.min(conflict.localData.price, conflict.blingData.price);
        }
        
        if (conflict.type.includes('stock')) {
            // Para estoque, usar o menor para evitar overselling
            merged.stock = Math.min(conflict.localData.stock, conflict.blingData.stock);
        }
        
        return {
            success: true,
            strategy: 'smart_merge', 
            chosen_source: 'merged',
            data: merged,
            reason: 'Dados combinados inteligentemente'
        };
    }
    
    /**
     * Estratégia: Baseada em valor
     */
    async resolveByValue(conflict) {
        const config = this.config.valueBasedRules || {};
        
        if (conflict.type.includes('price')) {
            const useHigher = config.priceRule === 'higher';
            const useLocal = useHigher ? 
                conflict.localData.price > conflict.blingData.price :
                conflict.localData.price < conflict.blingData.price;
                
            return {
                success: true,
                strategy: 'value_based',
                chosen_source: useLocal ? 'local' : 'bling',
                data: useLocal ? conflict.localData : conflict.blingData,
                reason: `Usado valor ${useHigher ? 'maior' : 'menor'}`
            };
        }
        
        return { success: false, reason: 'Regra de valor não definida para este tipo' };
    }
    
    /**
     * Estratégia: Resolução manual obrigatória
     */
    async requireManualResolution(conflict) {
        conflict.requiresManualResolution = true;
        await this.notifyConflict(conflict, true);
        
        return {
            success: false,
            strategy: 'manual_required',
            reason: 'Resolução manual obrigatória'
        };
    }
    
    /**
     * Aplica resolução do conflito
     */
    async applyResolution(conflict, resolution) {
        try {
            const { entityType, entityId, tenantId } = conflict;
            
            if (entityType === 'product') {
                await this.applyProductResolution(conflict, resolution);
            }
            
            // Log da resolução
            console.log(`📝 Aplicando resolução ${resolution.strategy} para ${conflict.id}`);
            
        } catch (error) {
            console.error('Erro ao aplicar resolução:', error);
            throw error;
        }
    }
    
    /**
     * Aplica resolução para produto
     */
    async applyProductResolution(conflict, resolution) {
        const updateData = {};
        
        if (resolution.data.price !== undefined) {
            updateData.price = resolution.data.price;
        }
        
        if (resolution.data.stock !== undefined) {
            updateData.stock_quantity = resolution.data.stock;
        }
        
        if (resolution.data.name !== undefined) {
            updateData.name = resolution.data.name;
        }
        
        if (resolution.data.description !== undefined) {
            updateData.description = resolution.data.description;
        }
        
        updateData.updated_at = new Date();
        updateData.conflict_resolved_at = new Date();
        
        await this.db('products')
            .where({ id: conflict.entityId })
            .update(updateData);
    }
    
    /**
     * Ferramentas manuais de resolução
     */
    async getConflictsForManualReview(filters = {}) {
        const conflicts = Array.from(this.conflicts.values());
        
        return conflicts.filter(conflict => {
            if (filters.status && conflict.status !== filters.status) return false;
            if (filters.type && conflict.type !== filters.type) return false;
            if (filters.severity && conflict.severity !== filters.severity) return false;
            if (filters.tenantId && conflict.tenantId !== filters.tenantId) return false;
            
            return true;
        });
    }
    
    /**
     * Resolve conflito manualmente
     */
    async resolveManually(conflictId, resolution, userId) {
        const conflict = this.conflicts.get(conflictId);
        
        if (!conflict) {
            throw new Error('Conflito não encontrado');
        }
        
        try {
            conflict.status = 'resolved';
            conflict.resolvedAt = new Date();
            conflict.resolution = resolution;
            conflict.resolvedBy = userId;
            conflict.resolutionType = 'manual';
            
            // Aplicar resolução
            await this.applyResolution(conflict, resolution);
            
            // Salvar no histórico
            this.resolutionHistory.set(conflictId, conflict);
            
            this.updateMetrics('manual_resolved', conflict);
            this.emit('conflict_manually_resolved', conflict);
            
            console.log(`✅ Conflito resolvido manualmente: ${conflictId} por ${userId}`);
            
            return { success: true, conflict };
            
        } catch (error) {
            console.error('Erro na resolução manual:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Ignora conflito
     */
    async ignoreConflict(conflictId, reason, userId) {
        const conflict = this.conflicts.get(conflictId);
        
        if (!conflict) {
            throw new Error('Conflito não encontrado');
        }
        
        conflict.status = 'ignored';
        conflict.ignoredAt = new Date();
        conflict.ignoreReason = reason;
        conflict.ignoredBy = userId;
        
        this.updateMetrics('ignored', conflict);
        this.emit('conflict_ignored', conflict);
        
        return { success: true };
    }
    
    /**
     * Calcula severidade do conflito
     */
    calculateSeverity(type, data) {
        if (type === 'product') {
            const timeDiff = Math.abs(new Date(data.local_updated) - new Date(data.bling_updated));
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff > 24) return 'high';
            if (hoursDiff > 1) return 'medium';
            return 'low';
        }
        
        return 'medium';
    }
    
    /**
     * Identifica diferenças específicas
     */
    identifyDifferences(local, bling) {
        const differences = [];
        
        Object.keys(local).forEach(key => {
            if (local[key] !== bling[key]) {
                differences.push({
                    field: key,
                    local: local[key],
                    bling: bling[key]
                });
            }
        });
        
        return differences;
    }
    
    /**
     * Atualiza métricas
     */
    updateMetrics(action, conflict) {
        switch (action) {
            case 'detected':
                this.metrics.totalConflicts++;
                this.metrics.pendingConflicts++;
                break;
                
            case 'auto_resolved':
                this.metrics.resolvedConflicts++;
                this.metrics.autoResolved++;
                this.metrics.pendingConflicts--;
                break;
                
            case 'manual_resolved':
                this.metrics.resolvedConflicts++;
                this.metrics.manualResolved++;
                this.metrics.pendingConflicts--;
                break;
                
            case 'ignored':
                this.metrics.pendingConflicts--;
                break;
        }
        
        // Atualizar contadores por tipo
        const typeCount = this.metrics.byType.get(conflict.type) || 0;
        this.metrics.byType.set(conflict.type, typeCount + 1);
        
        this.metrics.lastUpdated = new Date();
    }
    
    /**
     * Notifica sobre conflito
     */
    async notifyConflict(conflict, urgent = false) {
        if (!this.config.notifyOnConflict) return;
        
        const message = {
            type: 'conflict_detected',
            urgent,
            conflict: {
                id: conflict.id,
                type: conflict.type,
                severity: conflict.severity,
                entityType: conflict.entityType,
                tenantId: conflict.tenantId
            },
            timestamp: new Date()
        };
        
        this.emit('notification', message);
        
        // Implementar notificações específicas (email, Slack, etc.)
        if (urgent || this.config.criticalConflictTypes.includes(conflict.type)) {
            console.log(`🚨 CONFLITO CRÍTICO: ${conflict.type} - ${conflict.id}`);
        }
    }
    
    /**
     * Persiste conflito no banco
     */
    async persistConflict(conflict) {
        try {
            await this.db('conflict_log').insert({
                conflict_id: conflict.id,
                type: conflict.type,
                severity: conflict.severity,
                entity_type: conflict.entityType,
                entity_id: conflict.entityId,
                bling_id: conflict.blingId,
                tenant_id: conflict.tenantId,
                local_data: JSON.stringify(conflict.localData),
                bling_data: JSON.stringify(conflict.blingData),
                differences: JSON.stringify(conflict.differences),
                metadata: JSON.stringify(conflict.metadata),
                status: conflict.status,
                detected_at: conflict.detectedAt,
                created_at: new Date()
            });
            
        } catch (error) {
            console.error('Erro ao persistir conflito:', error);
        }
    }
    
    /**
     * Obter métricas de conflitos
     */
    getMetrics() {
        return {
            ...this.metrics,
            byType: Object.fromEntries(this.metrics.byType),
            byStrategy: Object.fromEntries(this.metrics.byStrategy),
            activeConflicts: this.conflicts.size,
            resolutionRate: this.metrics.totalConflicts > 0 ? 
                (this.metrics.resolvedConflicts / this.metrics.totalConflicts * 100).toFixed(2) : 0
        };
    }
    
    /**
     * Limpar conflitos antigos resolvidos
     */
    async cleanupResolvedConflicts(olderThanDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        
        let cleaned = 0;
        
        for (const [id, conflict] of this.conflicts) {
            if (conflict.status === 'resolved' && 
                conflict.resolvedAt && 
                conflict.resolvedAt < cutoffDate) {
                
                // Mover para histórico se não estiver lá
                if (!this.resolutionHistory.has(id)) {
                    this.resolutionHistory.set(id, conflict);
                }
                
                this.conflicts.delete(id);
                cleaned++;
            }
        }
        
        console.log(`🧹 Limpeza de conflitos: ${cleaned} conflitos antigos removidos`);
        return cleaned;
    }
}

module.exports = ConflictResolutionService;