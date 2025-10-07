/**
 * Bling Price Synchronization Service - Enhanced Version
 * 
 * Sistema avançado de sincronização de preços entre Bling ERP e plataforma.
 * Implementa estratégias inteligentes de sincronização, cache, políticas de preço,
 * e monitoramento em tempo real.
 * 
 * Funcionalidades:
 * - Sincronização automática e manual de preços
 * - Cache inteligente para performance
 * - Políticas de preço customizáveis
 * - Histórico completo de mudanças
 * - Detecção de conflitos e resolução
 * - Webhooks para atualizações em tempo real
 * - Métricas e monitoramento avançado
 * - Sistema de retry com backoff exponencial
 * 
 * @author Sistema Vitrine Digital
 * @version 2.0.0 Enhanced
 */

const EventEmitter = require('events');
const BlingApiService = require('./BlingApiService');
const DatabaseConnection = require('../../../shared/database/connection');
const EventPublisher = require('../../../shared/events/EventPublisher');
const Logger = require('../../../shared/utils/logger');

class BlingPriceSyncService extends EventEmitter {
    constructor() {
        super();
        
        this.blingApi = new BlingApiService();
        this.db = DatabaseConnection.create('bling');
        this.eventPublisher = new EventPublisher();
        this.logger = Logger.create('BlingPriceSyncService');
        
        // Cache avançado de preços
        this.priceCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        this.cacheLock = new Map(); // Evita race conditions
        
        // Configurações avançadas
        this.config = {
            batchSize: 50,
            maxRetries: 3,
            retryDelay: 1000,
            retryBackoffMultiplier: 2,
            enableCache: true,
            enableNotifications: true,
            priceValidation: true,
            autoMarkup: false,
            markupPercentage: 0,
            priceTolerancePercent: 0.5, // 0.5% tolerância para mudanças
            syncInterval: 15 * 60 * 1000, // 15 minutos
            webhookRetryCount: 5,
            conflictResolution: 'bling_wins' // bling_wins, local_wins, manual
        };
        
        // Estado do serviço
        this.state = {
            isRunning: false,
            syncInProgress: false,
            lastSyncTime: null,
            activeConnections: 0,
            queuedOperations: 0
        };
        
        // Métricas detalhadas
        this.metrics = {
            totalSynced: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            priceUpdates: 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            webhooksProcessed: 0,
            averageSyncTime: 0,
            lastSyncTimestamp: null,
            uptimeStart: Date.now()
        };
        
        // Fila de operações para evitar concorrência
        this.operationQueue = [];
        this.processingQueue = false;
        
        this.logger.info('BlingPriceSyncService Enhanced initialized');
        this.startPeriodicSync();
    }
    
    /**
     * Inicia sincronização periódica automática
     */
    startPeriodicSync() {
        if (this.periodicSyncInterval) {
            clearInterval(this.periodicSyncInterval);
        }
        
        this.periodicSyncInterval = setInterval(async () => {
            try {
                if (!this.state.syncInProgress) {
                    this.logger.info('Starting periodic price sync');
                    await this.syncAllPricesScheduled();
                }
            } catch (error) {
                this.logger.error('Periodic sync failed:', error);
            }
        }, this.config.syncInterval);
        
        this.logger.info(`Periodic sync started with interval: ${this.config.syncInterval}ms`);
    }
    
    /**
     * Sincroniza preços de um produto específico com retry e cache
     */
    async syncProductPrice(productId, tenantId, options = {}) {
        const operationId = `sync_${productId}_${Date.now()}`;
        const startTime = Date.now();
        
        try {
            this.logger.info(`Starting enhanced price sync for product ${productId} (tenant: ${tenantId})`);
            
            // Verificar se operação já está em andamento
            if (this.cacheLock.has(productId)) {
                this.logger.debug(`Sync already in progress for product ${productId}, waiting...`);
                await this.waitForCacheLock(productId);
            }
            
            // Adquirir lock
            this.cacheLock.set(productId, operationId);
            
            try {
                // Buscar dados locais
                const localProduct = await this.getLocalProductWithPrices(productId, tenantId);
                if (!localProduct) {
                    throw new Error(`Product ${productId} not found in local database`);
                }
                
                // Verificar cache primeiro
                if (this.config.enableCache && !options.forceUpdate) {
                    const cachedResult = this.getCachedPrice(productId);
                    if (cachedResult) {
                        this.metrics.cacheHits++;
                        return cachedResult;
                    }
                    this.metrics.cacheMisses++;
                }
                
                // Buscar preços no Bling com retry
                const blingProduct = await this.fetchBlingProductWithRetry(localProduct.bling_id, tenantId);
                
                // Extrair e processar preços
                const blingPrices = this.extractEnhancedPricesFromBling(blingProduct);
                const processedPrices = await this.processPricesWithPolicies(blingPrices, localProduct, options);
                
                // Detectar mudanças significativas
                const priceChange = await this.detectSignificantPriceChange(productId, processedPrices, localProduct);
                
                if (priceChange.hasSignificantChange || options.forceUpdate) {
                    // Verificar conflitos
                    const conflictInfo = await this.detectPriceConflicts(productId, processedPrices, localProduct);
                    
                    if (conflictInfo.hasConflict) {
                        await this.handlePriceConflict(productId, conflictInfo, options);
                        this.metrics.conflictsDetected++;
                    }
                    
                    // Atualizar preços
                    await this.updateProductPricesEnhanced(productId, processedPrices, tenantId, priceChange);
                    
                    // Registrar histórico detalhado
                    await this.logDetailedPriceHistory(productId, processedPrices, localProduct, tenantId, options);
                    
                    // Notificar stakeholders
                    if (this.config.enableNotifications) {
                        await this.notifyEnhancedPriceChange(productId, localProduct, processedPrices, priceChange, tenantId);
                    }
                    
                    this.metrics.priceUpdates++;
                    this.logger.info(`Price updated for product ${productId}: ${localProduct.price} → ${processedPrices.price} (${priceChange.changePercent.toFixed(2)}%)`);
                }
                
                // Atualizar cache
                const result = {
                    success: true,
                    productId,
                    tenantId,
                    priceChanged: priceChange.hasSignificantChange,
                    priceChange: priceChange,
                    prices: processedPrices,
                    syncTime: Date.now() - startTime,
                    source: options.source || 'manual',
                    cached: false
                };
                
                this.updateAdvancedCache(productId, result);
                
                // Atualizar métricas
                this.updateSyncMetrics(true, Date.now() - startTime);
                
                this.emit('productPriceSynced', result);
                
                return result;
                
            } finally {
                // Liberar lock
                this.cacheLock.delete(productId);
            }
            
        } catch (error) {
            this.logger.error(`Enhanced price sync failed for product ${productId}:`, error);
            
            this.updateSyncMetrics(false, Date.now() - startTime);
            
            const errorResult = {
                success: false,
                productId,
                tenantId,
                error: error.message,
                syncTime: Date.now() - startTime
            };
            
            this.emit('productPriceSyncFailed', errorResult);
            
            // Liberar lock em caso de erro
            this.cacheLock.delete(productId);
            
            throw error;
        }
    }
    
    /**
     * Busca produto do Bling com retry e backoff exponencial
     */
    async fetchBlingProductWithRetry(blingId, tenantId, attempt = 1) {
        try {
            return await this.blingApi.getProduct(blingId, tenantId);
        } catch (error) {
            if (attempt < this.config.maxRetries) {
                const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
                this.logger.warn(`Bling API error, retrying in ${delay}ms (attempt ${attempt}/${this.config.maxRetries}):`, error.message);
                await this.sleep(delay);
                return this.fetchBlingProductWithRetry(blingId, tenantId, attempt + 1);
            }
            throw new Error(`Failed to fetch product from Bling after ${this.config.maxRetries} attempts: ${error.message}`);
        }
    }
    
    /**
     * Extrai preços avançados do Bling com validação
     */
    extractEnhancedPricesFromBling(blingProduct) {
        const prices = {
            price: 0,
            cost_price: 0,
            sale_price: 0,
            promotional_price: null,
            wholesale_price: null,
            margin_percent: 0,
            markup_percent: 0,
            last_bling_update: new Date()
        };
        
        try {
            // Preço principal
            if (blingProduct.preco && !isNaN(parseFloat(blingProduct.preco))) {
                prices.price = parseFloat(blingProduct.preco);
            }
            
            // Preço de custo
            if (blingProduct.precoCusto && !isNaN(parseFloat(blingProduct.precoCusto))) {
                prices.cost_price = parseFloat(blingProduct.precoCusto);
            }
            
            // Preço de venda
            if (blingProduct.precoVenda && !isNaN(parseFloat(blingProduct.precoVenda))) {
                prices.sale_price = parseFloat(blingProduct.precoVenda);
            }
            
            // Preço promocional
            if (blingProduct.precoPromocional && parseFloat(blingProduct.precoPromocional) > 0) {
                prices.promotional_price = parseFloat(blingProduct.precoPromocional);
            }
            
            // Preço atacado
            if (blingProduct.precoAtacado && parseFloat(blingProduct.precoAtacado) > 0) {
                prices.wholesale_price = parseFloat(blingProduct.precoAtacado);
            }
            
            // Calcular margem e markup
            if (prices.cost_price > 0 && prices.sale_price > 0) {
                prices.margin_percent = ((prices.sale_price - prices.cost_price) / prices.sale_price) * 100;
                prices.markup_percent = ((prices.sale_price - prices.cost_price) / prices.cost_price) * 100;
            }
            
            this.logger.debug(`Extracted prices for Bling product ${blingProduct.id}:`, prices);
            
        } catch (error) {
            this.logger.error('Error extracting prices from Bling product:', error);
            throw new Error(`Invalid price data from Bling: ${error.message}`);
        }
        
        return prices;
    }
    
    /**
     * Processa preços com políticas avançadas
     */
    async processPricesWithPolicies(blingPrices, localProduct, options = {}) {
        let processedPrices = { ...blingPrices };
        
        try {
            // Aplicar markup automático global
            if (this.config.autoMarkup && this.config.markupPercentage > 0) {
                const markup = this.config.markupPercentage / 100;
                processedPrices.price = processedPrices.price * (1 + markup);
                processedPrices.sale_price = processedPrices.sale_price * (1 + markup);
                
                this.logger.debug(`Applied global markup of ${this.config.markupPercentage}% to product ${localProduct.id}`);
            }
            
            // Buscar e aplicar políticas específicas do produto
            const productPolicies = await this.getProductPricePolicies(localProduct.id);
            
            for (const policy of productPolicies) {
                const oldPrice = processedPrices.price;
                processedPrices = this.applyAdvancedPricePolicy(processedPrices, policy);
                
                this.logger.debug(`Applied policy '${policy.type}' to product ${localProduct.id}: ${oldPrice} → ${processedPrices.price}`);
            }
            
            // Buscar políticas de categoria
            if (localProduct.category_id) {
                const categoryPolicies = await this.getCategoryPricePolicies(localProduct.category_id);
                
                for (const policy of categoryPolicies) {
                    processedPrices = this.applyAdvancedPricePolicy(processedPrices, policy);
                }
            }
            
            // Validar preços processados
            if (this.config.priceValidation) {
                this.validateAdvancedPrices(processedPrices, localProduct);
            }
            
            // Arredondar preços conforme configuração
            processedPrices = this.roundPricesAdvanced(processedPrices);
            
            return processedPrices;
            
        } catch (error) {
            this.logger.error(`Error processing prices for product ${localProduct.id}:`, error);
            throw error;
        }
    }
    
    /**
     * Detecta mudanças significativas de preço
     */
    async detectSignificantPriceChange(productId, newPrices, localProduct) {
        const oldPrice = parseFloat(localProduct.price || 0);
        const newPrice = parseFloat(newPrices.price || 0);
        
        const absoluteChange = newPrice - oldPrice;
        const changePercent = oldPrice > 0 ? (absoluteChange / oldPrice) * 100 : 0;
        
        const isSignificant = Math.abs(changePercent) >= this.config.priceTolerancePercent;
        
        return {
            hasSignificantChange: isSignificant,
            oldPrice,
            newPrice,
            absoluteChange,
            changePercent,
            isIncrease: absoluteChange > 0,
            tolerance: this.config.priceTolerancePercent
        };
    }
    
    /**
     * Detecta conflitos de preço
     */
    async detectPriceConflicts(productId, newPrices, localProduct) {
        // Verificar se produto foi modificado localmente recentemente
        const recentLocalUpdate = await this.db('price_history')
            .where('product_id', productId)
            .where('change_source', 'manual')
            .where('created_at', '>', new Date(Date.now() - 60 * 60 * 1000)) // Última hora
            .first();
        
        const hasConflict = !!recentLocalUpdate && 
                           Math.abs(parseFloat(newPrices.price) - parseFloat(localProduct.price)) > 0.01;
        
        return {
            hasConflict,
            localUpdate: recentLocalUpdate,
            blingPrice: newPrices.price,
            localPrice: localProduct.price,
            conflictType: hasConflict ? 'concurrent_modification' : null
        };
    }
    
    /**
     * Gerencia conflitos de preço
     */
    async handlePriceConflict(productId, conflictInfo, options) {
        this.logger.warn(`Price conflict detected for product ${productId}:`, conflictInfo);
        
        switch (this.config.conflictResolution) {
            case 'bling_wins':
                this.logger.info(`Resolving conflict: Bling price wins for product ${productId}`);
                break;
                
            case 'local_wins':
                this.logger.info(`Resolving conflict: Local price wins for product ${productId}`);
                throw new Error('Local price takes precedence, skipping Bling update');
                
            case 'manual':
                this.logger.info(`Conflict requires manual resolution for product ${productId}`);
                
                // Publicar evento para resolução manual
                await this.eventPublisher.publish('price.conflict_detected', {
                    productId,
                    conflictInfo,
                    requiresManualResolution: true,
                    timestamp: new Date().toISOString()
                });
                
                throw new Error('Price conflict requires manual resolution');
                
            default:
                this.logger.warn(`Unknown conflict resolution strategy: ${this.config.conflictResolution}`);
                break;
        }
        
        this.metrics.conflictsResolved++;
    }
    
    /**
     * Sincronização periódica agendada
     */
    async initialize() {
        try {
      this.logger.info('Initializing Bling Price Sync Service...');

      // Create price history table if needed
      await this.ensurePriceHistoryTable();

      // Set up periodic sync
      if (this.config.enableRealTimeSync) {
        this.startPeriodicSync();
      }

      this.logger.info('Bling Price Sync Service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Bling Price Sync Service:', error);
      throw error;
    }
  }

  /**
   * Ensure price history table exists
   */
  async ensurePriceHistoryTable() {
    const tableExists = await this.db.schema.hasTable('bling_price_history');
    
    if (!tableExists) {
      await this.db.schema.createTable('bling_price_history', (table) => {
        table.increments('id').primary();
        table.integer('tenant_id').notNullable();
        table.string('bling_product_id').notNullable();
        table.string('product_sku').nullable();
        table.decimal('old_price', 10, 2).nullable();
        table.decimal('new_price', 10, 2).notNullable();
        table.decimal('price_change_percent', 5, 2).nullable();
        table.string('sync_source').defaultTo('automatic'); // automatic, webhook, manual
        table.json('metadata').nullable(); // Additional sync information
        table.timestamps(true, true);

        // Indexes
        table.index(['tenant_id', 'bling_product_id']);
        table.index(['tenant_id', 'created_at']);
        table.index('sync_source');
      });

      this.logger.info('Price history table created successfully');
    }
  }

  /**
   * Start periodic price synchronization
   */
  startPeriodicSync() {
    if (this.state.isRunning) {
      this.logger.warn('Periodic sync already running');
      return;
    }

    this.state.isRunning = true;
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllTenantPrices();
      } catch (error) {
        this.logger.error('Error in periodic price sync:', error);
      }
    }, this.config.syncInterval);

    this.logger.info(`Periodic price sync started (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Stop periodic price synchronization
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.state.isRunning = false;
    this.logger.info('Periodic price sync stopped');
  }

  /**
   * Sync prices for all tenants
   */
  async syncAllTenantPrices() {
    if (this.state.syncInProgress) {
      this.logger.warn('Price sync already in progress, skipping...');
      return;
    }

    const startTime = Date.now();
    this.state.syncInProgress = true;
    this.state.processedCount = 0;
    this.state.updatedCount = 0;
    this.state.errorCount = 0;

    try {
      this.logger.info('Starting price sync for all tenants...');

      // Get all active tenant connections
      const activeConnections = await this.db('bling_connections')
        .where('is_active', true)
        .where('status', 'connected')
        .select('id', 'tenant_id', 'access_token', 'refresh_token');

      this.logger.info(`Found ${activeConnections.length} active connections`);

      // Process each tenant
      for (const connection of activeConnections) {
        try {
          await this.syncTenantPrices(connection.tenant_id);
        } catch (error) {
          this.logger.error(`Error syncing prices for tenant ${connection.tenant_id}:`, error);
          this.state.errorCount++;
        }
      }

      // Update statistics
      const syncTime = Date.now() - startTime;
      this.stats.totalSyncs++;
      this.stats.averageSyncTime = ((this.stats.averageSyncTime * (this.stats.totalSyncs - 1)) + syncTime) / this.stats.totalSyncs;
      this.stats.lastSync = new Date();

      this.state.lastSyncTime = new Date();

      this.logger.info(`Price sync completed. Processed: ${this.state.processedCount}, Updated: ${this.state.updatedCount}, Errors: ${this.state.errorCount}, Time: ${syncTime}ms`);

      // Publish sync completion event
      await this.eventPublisher.publish('bling.prices.sync.completed', {
        tenants_processed: activeConnections.length,
        products_processed: this.state.processedCount,
        prices_updated: this.state.updatedCount,
        errors: this.state.errorCount,
        sync_time_ms: syncTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Error during price sync:', error);
      this.stats.totalErrors++;
      throw error;
    } finally {
      this.state.syncInProgress = false;
    }
  }

  /**
   * Sync prices for a specific tenant
   */
  async syncTenantPrices(tenantId) {
    try {
      this.logger.debug(`Starting price sync for tenant ${tenantId}`);

      // Get tenant's Bling connection
      const connection = await this.db('bling_connections')
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .first();

      if (!connection) {
        this.logger.warn(`No active Bling connection found for tenant ${tenantId}`);
        return;
      }

      // Get products from Bling with current prices
      const blingProducts = await this.fetchBlingProductsWithPrices(connection);
      
      if (!blingProducts || blingProducts.length === 0) {
        this.logger.debug(`No products found for tenant ${tenantId}`);
        return;
      }

      this.logger.debug(`Found ${blingProducts.length} products for tenant ${tenantId}`);

      // Process products in batches
      const batches = this.chunkArray(blingProducts, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processPriceBatch(tenantId, batch);
      }

      this.logger.debug(`Price sync completed for tenant ${tenantId}`);

    } catch (error) {
      this.logger.error(`Error syncing prices for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch products with prices from Bling API
   */
  async fetchBlingProductsWithPrices(connection) {
    try {
      const response = await this.blingService.makeApiRequest({
        method: 'GET',
        url: '/produtos',
        params: {
          limite: 100,
          situacao: 'A', // Active products only
          estrutura: 'completa'
        }
      }, connection.tenant_id);

      return response.data?.data || [];
    } catch (error) {
      this.logger.error('Error fetching products from Bling:', error);
      throw error;
    }
  }

  /**
   * Process a batch of products for price updates
   */
  async processPriceBatch(tenantId, products) {
    for (const blingProduct of products) {
      try {
        await this.processSingleProductPrice(tenantId, blingProduct);
        this.state.processedCount++;
      } catch (error) {
        this.logger.error(`Error processing product ${blingProduct.id}:`, error);
        this.state.errorCount++;
      }
    }
  }

  /**
   * Process price update for a single product
   */
  async processSingleProductPrice(tenantId, blingProduct) {
    try {
      // Extract current price from Bling product
      const currentBlingPrice = this.extractProductPrice(blingProduct);
      
      if (currentBlingPrice === null) {
        this.logger.debug(`No price found for product ${blingProduct.id}`);
        return;
      }

      // Find corresponding product in local database
      const localProduct = await this.findLocalProduct(tenantId, blingProduct);
      
      if (!localProduct) {
        this.logger.debug(`Local product not found for Bling product ${blingProduct.id}`);
        return;
      }

      // Check if price has changed significantly
      const priceChanged = this.hasPriceChanged(localProduct.price, currentBlingPrice);
      
      if (!priceChanged) {
        return; // No significant price change
      }

      // Update local product price
      await this.updateLocalProductPrice(localProduct.id, currentBlingPrice, localProduct.price);

      // Record price change in history
      await this.recordPriceChange(tenantId, blingProduct, localProduct.price, currentBlingPrice);

      // Publish price update event
      await this.publishPriceUpdateEvent(tenantId, localProduct, currentBlingPrice, localProduct.price);

      this.state.updatedCount++;
      this.stats.totalPriceUpdates++;

      this.logger.debug(`Price updated for product ${localProduct.id}: ${localProduct.price} -> ${currentBlingPrice}`);

    } catch (error) {
      this.logger.error(`Error processing product price ${blingProduct.id}:`, error);
      throw error;
    }
  }

  /**
   * Extract price from Bling product data
   */
  extractProductPrice(blingProduct) {
    try {
      // Try different price fields from Bling API
      if (blingProduct.preco && blingProduct.preco.valor) {
        return parseFloat(blingProduct.preco.valor);
      }
      
      if (blingProduct.precoVenda) {
        return parseFloat(blingProduct.precoVenda);
      }
      
      if (blingProduct.valor) {
        return parseFloat(blingProduct.valor);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error extracting price from product:', error);
      return null;
    }
  }

  /**
   * Find local product by Bling product data
   */
  async findLocalProduct(tenantId, blingProduct) {
    try {
      // Try to find by Bling ID first
      let product = await this.db('products')
        .where('tenant_id', tenantId)
        .where('bling_id', blingProduct.id)
        .first();

      if (product) return product;

      // Try to find by SKU
      if (blingProduct.codigo) {
        product = await this.db('products')
          .where('tenant_id', tenantId)
          .where('sku', blingProduct.codigo)
          .first();
      }

      return product;
    } catch (error) {
      this.logger.error('Error finding local product:', error);
      return null;
    }
  }

  /**
   * Check if price has changed significantly
   */
  hasPriceChanged(oldPrice, newPrice) {
    if (!oldPrice || !newPrice) return true;
    
    const priceDiff = Math.abs(oldPrice - newPrice);
    const percentChange = (priceDiff / oldPrice) * 100;
    
    return percentChange > this.config.priceTolerancePercent;
  }

  /**
   * Update local product price
   */
  async updateLocalProductPrice(productId, newPrice, oldPrice) {
    try {
      await this.db('products')
        .where('id', productId)
        .update({
          price: newPrice,
          updated_at: new Date()
        });

      this.logger.debug(`Updated product ${productId} price: ${oldPrice} -> ${newPrice}`);
    } catch (error) {
      this.logger.error('Error updating product price:', error);
      throw error;
    }
  }

  /**
   * Record price change in history
   */
  async recordPriceChange(tenantId, blingProduct, oldPrice, newPrice) {
    try {
      const priceChangePercent = oldPrice ? ((newPrice - oldPrice) / oldPrice) * 100 : null;

      await this.db('bling_price_history').insert({
        tenant_id: tenantId,
        bling_product_id: blingProduct.id,
        product_sku: blingProduct.codigo,
        old_price: oldPrice,
        new_price: newPrice,
        price_change_percent: priceChangePercent,
        sync_source: 'automatic',
        metadata: JSON.stringify({
          bling_product_name: blingProduct.nome,
          sync_timestamp: new Date().toISOString(),
          api_response_id: blingProduct.id
        })
      });
    } catch (error) {
      this.logger.error('Error recording price change:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Publish price update event
   */
  async publishPriceUpdateEvent(tenantId, product, newPrice, oldPrice) {
    try {
      await this.eventPublisher.publish('product.price.updated', {
        tenant_id: tenantId,
        product_id: product.id,
        product_sku: product.sku,
        old_price: oldPrice,
        new_price: newPrice,
        price_change_percent: oldPrice ? ((newPrice - oldPrice) / oldPrice) * 100 : null,
        source: 'bling_sync',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error publishing price update event:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Handle webhook price update
   */
  async handleWebhookPriceUpdate(webhookData) {
    try {
      this.logger.info('Processing webhook price update:', webhookData);

      const { tenantId, productId, newPrice } = webhookData;

      if (!tenantId || !productId || newPrice === undefined) {
        this.logger.warn('Invalid webhook data for price update');
        return;
      }

      // Find local product
      const localProduct = await this.db('products')
        .where('tenant_id', tenantId)
        .where('bling_id', productId)
        .first();

      if (!localProduct) {
        this.logger.warn(`Product not found for webhook update: ${productId}`);
        return;
      }

      // Check if price actually changed
      const priceChanged = this.hasPriceChanged(localProduct.price, newPrice);
      
      if (!priceChanged) {
        this.logger.debug('Price change not significant enough to update');
        return;
      }

      // Update price
      await this.updateLocalProductPrice(localProduct.id, newPrice, localProduct.price);

      // Record in history
      await this.recordPriceChange(tenantId, { id: productId }, localProduct.price, newPrice);

      // Publish event
      await this.publishPriceUpdateEvent(tenantId, localProduct, newPrice, localProduct.price);

      this.logger.info(`Webhook price update completed for product ${localProduct.id}`);

    } catch (error) {
      this.logger.error('Error handling webhook price update:', error);
      throw error;
    }
  }

  /**
   * Get price sync statistics
   */
  getStats() {
    return {
      ...this.stats,
      current_state: this.state,
      config: {
        sync_interval_ms: this.config.syncInterval,
        batch_size: this.config.batchSize,
        price_tolerance_percent: this.config.priceTolerancePercent,
        real_time_sync_enabled: this.config.enableRealTimeSync
      }
    };
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(tenantId, productId, limit = 50) {
    try {
      const history = await this.db('bling_price_history')
        .where('tenant_id', tenantId)
        .where('bling_product_id', productId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select('*');

      return history;
    } catch (error) {
      this.logger.error('Error getting price history:', error);
      throw error;
    }
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup old price history records
   */
  async cleanupOldPriceHistory(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await this.db('bling_price_history')
        .where('created_at', '<', cutoffDate)
        .del();

      this.logger.info(`Cleaned up ${deleted} old price history records`);
      return deleted;
    } catch (error) {
      this.logger.error('Error cleaning up price history:', error);
      throw error;
    }
  }
}

module.exports = BlingPriceSyncService;