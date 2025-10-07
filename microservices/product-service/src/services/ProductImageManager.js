const ImageProcessingService = require('../../shared/services/ImageProcessingService');
const CDNService = require('../../shared/services/CDNService');
const { Logger } = require('../../shared');

/**
 * Product Image Manager
 * Integrates image processing with product management
 */
class ProductImageManager {
  constructor(database, eventPublisher) {
    this.logger = new Logger('product-image-manager');
    this.db = database;
    this.eventPublisher = eventPublisher;

    // Initialize image processing service
    this.imageProcessor = new ImageProcessingService({
      uploadPath: process.env.UPLOAD_PATH || './uploads',
      processedPath: process.env.PROCESSED_PATH || './uploads/processed',
      cdnEnabled: process.env.CDN_ENABLED === 'true',
      cdnBaseUrl: process.env.CDN_BASE_URL || ''
    });

    // Initialize CDN service
    this.cdnService = new CDNService({
      bucketName: process.env.CDN_BUCKET_NAME,
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      domainName: process.env.CDN_DOMAIN_NAME,
      enableLocalFallback: true
    });

    // Configuration
    this.config = {
      maxImagesPerProduct: 10,
      enableAutoProcessing: true,
      requiredSizes: ['thumbnail', 'small', 'medium', 'large'],
      defaultFormats: ['jpeg', 'webp']
    };
  }

  /**
   * Initialize the product image manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing Product Image Manager...');

      // Initialize image processing service
      await this.imageProcessor.initialize();

      // Ensure product_images table exists
      await this.ensureProductImagesTable();

      this.logger.info('Product Image Manager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Product Image Manager:', error);
      throw error;
    }
  }

  /**
   * Ensure product images table exists
   */
  async ensureProductImagesTable() {
    const tableExists = await this.db.schema.hasTable('product_images');
    
    if (!tableExists) {
      await this.db.schema.createTable('product_images', (table) => {
        table.increments('id').primary();
        table.integer('tenant_id').notNullable();
        table.integer('product_id').notNullable();
        
        // Image metadata
        table.string('original_filename').notNullable();
        table.string('image_hash').notNullable().unique(); // Prevent duplicates
        table.integer('display_order').defaultTo(0);
        table.boolean('is_primary').defaultTo(false);
        
        // Processing status
        table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
        table.text('processing_error').nullable();
        table.integer('processing_attempts').defaultTo(0);
        
        // Original image info
        table.json('original_metadata').nullable(); // Width, height, format, size
        table.string('original_url').nullable();
        
        // Processed variants
        table.json('variants').nullable(); // All generated variants
        table.json('processing_stats').nullable(); // Compression ratio, processing time
        
        // Timestamps
        table.timestamps(true, true);
        
        // Indexes
        table.index(['tenant_id', 'product_id']);
        table.index(['tenant_id', 'status']);
        table.index('image_hash');
        table.index(['product_id', 'display_order']);
        table.index(['product_id', 'is_primary']);

        // Foreign key constraints
        table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
      });

      this.logger.info('Product images table created successfully');
    }
  }

  /**
   * Add image to product from file upload
   */
  async addProductImageFromFile(tenantId, productId, filePath, options = {}) {
    try {
      this.logger.info(`Adding image to product ${productId} from file`, {
        tenantId,
        productId,
        filePath
      });

      // Validate product exists
      await this.validateProductExists(tenantId, productId);

      // Check image limits
      await this.checkImageLimits(tenantId, productId);

      // Generate image hash for deduplication
      const imageHash = await this.generateImageHash(filePath);

      // Check if image already exists
      const existingImage = await this.db('product_images')
        .where('tenant_id', tenantId)
        .where('image_hash', imageHash)
        .first();

      if (existingImage) {
        this.logger.warn('Image already exists', { imageHash, existingImageId: existingImage.id });
        return existingImage;
      }

      // Create database record
      const imageRecord = await this.createImageRecord(tenantId, productId, filePath, imageHash, options);

      // Process image asynchronously
      if (this.config.enableAutoProcessing) {
        this.processImageAsync(imageRecord.id, filePath);
      }

      return imageRecord;

    } catch (error) {
      this.logger.error('Failed to add product image from file:', error);
      throw error;
    }
  }

  /**
   * Add image to product from URL
   */
  async addProductImageFromUrl(tenantId, productId, imageUrl, options = {}) {
    try {
      this.logger.info(`Adding image to product ${productId} from URL`, {
        tenantId,
        productId,
        imageUrl
      });

      // Validate product exists
      await this.validateProductExists(tenantId, productId);

      // Check image limits
      await this.checkImageLimits(tenantId, productId);

      // Generate hash from URL (for basic deduplication)
      const urlHash = require('crypto').createHash('md5').update(imageUrl).digest('hex');

      // Create database record
      const imageRecord = await this.createImageRecordFromUrl(tenantId, productId, imageUrl, urlHash, options);

      // Process image from URL asynchronously
      if (this.config.enableAutoProcessing) {
        this.processImageFromUrlAsync(imageRecord.id, imageUrl);
      }

      return imageRecord;

    } catch (error) {
      this.logger.error('Failed to add product image from URL:', error);
      throw error;
    }
  }

  /**
   * Process image asynchronously
   */
  async processImageAsync(imageId, filePath) {
    try {
      // Update status to processing
      await this.db('product_images')
        .where('id', imageId)
        .update({ 
          status: 'processing',
          processing_attempts: this.db.raw('processing_attempts + 1'),
          updated_at: new Date()
        });

      // Process image
      const processingResult = await this.imageProcessor.processImage(filePath, {
        sizes: this.config.requiredSizes,
        formats: this.config.defaultFormats
      });

      // Upload to CDN if enabled
      const cdnResults = await this.uploadToCDN(imageId, processingResult);
      
      // Merge CDN URLs with processing results
      const finalVariants = this.mergeVariantsWithCDN(processingResult.images, cdnResults);

      // Update database with results
      await this.db('product_images')
        .where('id', imageId)
        .update({
          status: 'completed',
          variants: JSON.stringify(finalVariants),
          processing_stats: JSON.stringify({
            processingTime: processingResult.processingTime,
            compressionRatio: this.calculateCompressionRatio(processingResult),
            generatedVariants: finalVariants.length,
            cdnUpload: cdnResults.success,
            cdnUrls: cdnResults.urls ? Object.keys(cdnResults.urls).length : 0
          }),
          updated_at: new Date()
        });

      // Publish success event
      const imageRecord = await this.db('product_images').where('id', imageId).first();
      await this.publishImageEvent('product.image.processed', imageRecord, processingResult);

      this.logger.info(`Image processing completed for image ${imageId}`);

    } catch (error) {
      this.logger.error(`Image processing failed for image ${imageId}:`, error);

      // Update failure status
      await this.db('product_images')
        .where('id', imageId)
        .update({
          status: 'failed',
          processing_error: error.message,
          updated_at: new Date()
        });

      // Publish failure event
      await this.publishImageEvent('product.image.processing.failed', { id: imageId }, { error: error.message });
    }
  }

  /**
   * Process image from URL asynchronously
   */
  async processImageFromUrlAsync(imageId, imageUrl) {
    try {
      // Update status to processing
      await this.db('product_images')
        .where('id', imageId)
        .update({ 
          status: 'processing',
          processing_attempts: this.db.raw('processing_attempts + 1'),
          updated_at: new Date()
        });

      // Process image from URL
      const processingResult = await this.imageProcessor.processImageFromUrl(imageUrl, {
        sizes: this.config.requiredSizes,
        formats: this.config.defaultFormats
      });

      // Update database with results
      await this.db('product_images')
        .where('id', imageId)
        .update({
          status: 'completed',
          variants: JSON.stringify(processingResult.images),
          original_metadata: JSON.stringify(processingResult.metadata),
          processing_stats: JSON.stringify({
            processingTime: processingResult.processingTime,
            compressionRatio: this.calculateCompressionRatio(processingResult),
            generatedVariants: processingResult.images.length
          }),
          updated_at: new Date()
        });

      // Publish success event
      const imageRecord = await this.db('product_images').where('id', imageId).first();
      await this.publishImageEvent('product.image.processed', imageRecord, processingResult);

      this.logger.info(`Image processing from URL completed for image ${imageId}`);

    } catch (error) {
      this.logger.error(`Image processing from URL failed for image ${imageId}:`, error);

      // Update failure status
      await this.db('product_images')
        .where('id', imageId)
        .update({
          status: 'failed',
          processing_error: error.message,
          updated_at: new Date()
        });
    }
  }

  /**
   * Get product images
   */
  async getProductImages(tenantId, productId, options = {}) {
    try {
      const query = this.db('product_images')
        .where('tenant_id', tenantId)
        .where('product_id', productId);

      if (options.status) {
        query.where('status', options.status);
      }

      if (options.onlyCompleted !== false) {
        query.where('status', 'completed');
      }

      const images = await query
        .orderBy('is_primary', 'desc')
        .orderBy('display_order', 'asc')
        .orderBy('created_at', 'asc');

      // Parse JSON fields
      return images.map(image => ({
        ...image,
        variants: image.variants ? JSON.parse(image.variants) : [],
        original_metadata: image.original_metadata ? JSON.parse(image.original_metadata) : null,
        processing_stats: image.processing_stats ? JSON.parse(image.processing_stats) : null
      }));

    } catch (error) {
      this.logger.error('Failed to get product images:', error);
      throw error;
    }
  }

  /**
   * Set primary image for product
   */
  async setPrimaryImage(tenantId, productId, imageId) {
    try {
      await this.db.transaction(async (trx) => {
        // Remove primary flag from all images
        await trx('product_images')
          .where('tenant_id', tenantId)
          .where('product_id', productId)
          .update({ is_primary: false });

        // Set new primary image
        await trx('product_images')
          .where('id', imageId)
          .where('tenant_id', tenantId)
          .where('product_id', productId)
          .update({ is_primary: true });
      });

      this.logger.info(`Set primary image ${imageId} for product ${productId}`);
      
      // Publish event
      await this.publishImageEvent('product.primary_image.changed', {
        tenant_id: tenantId,
        product_id: productId,
        image_id: imageId
      });

    } catch (error) {
      this.logger.error('Failed to set primary image:', error);
      throw error;
    }
  }

  /**
   * Delete product image
   */
  async deleteProductImage(tenantId, productId, imageId) {
    try {
      // Get image record
      const image = await this.db('product_images')
        .where('id', imageId)
        .where('tenant_id', tenantId)
        .where('product_id', productId)
        .first();

      if (!image) {
        throw new Error('Image not found');
      }

      // Delete image variants from filesystem
      if (image.variants) {
        const variants = JSON.parse(image.variants);
        await this.deleteImageFiles(variants);
      }

      // Delete database record
      await this.db('product_images')
        .where('id', imageId)
        .delete();

      // Publish event
      await this.publishImageEvent('product.image.deleted', {
        tenant_id: tenantId,
        product_id: productId,
        image_id: imageId
      });

      this.logger.info(`Deleted image ${imageId} for product ${productId}`);

    } catch (error) {
      this.logger.error('Failed to delete product image:', error);
      throw error;
    }
  }

  /**
   * Reprocess failed images
   */
  async reprocessFailedImages(tenantId, productId = null) {
    try {
      const query = this.db('product_images')
        .where('tenant_id', tenantId)
        .where('status', 'failed')
        .where('processing_attempts', '<', 3);

      if (productId) {
        query.where('product_id', productId);
      }

      const failedImages = await query;

      this.logger.info(`Found ${failedImages.length} failed images to reprocess`);

      for (const image of failedImages) {
        if (image.original_url) {
          this.processImageFromUrlAsync(image.id, image.original_url);
        } else {
          this.logger.warn(`Cannot reprocess image ${image.id}: no original URL`);
        }
      }

      return failedImages.length;

    } catch (error) {
      this.logger.error('Failed to reprocess failed images:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  async validateProductExists(tenantId, productId) {
    const product = await this.db('products')
      .where('id', productId)
      .where('tenant_id', tenantId)
      .first();

    if (!product) {
      throw new Error(`Product ${productId} not found for tenant ${tenantId}`);
    }

    return product;
  }

  async checkImageLimits(tenantId, productId) {
    const imageCount = await this.db('product_images')
      .where('tenant_id', tenantId)
      .where('product_id', productId)
      .count('id as count')
      .first();

    if (parseInt(imageCount.count) >= this.config.maxImagesPerProduct) {
      throw new Error(`Maximum images per product (${this.config.maxImagesPerProduct}) exceeded`);
    }
  }

  async generateImageHash(filePath) {
    const fs = require('fs');
    const crypto = require('crypto');
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  async createImageRecord(tenantId, productId, filePath, imageHash, options) {
    const fs = require('fs');
    const path = require('path');

    return await this.db('product_images').insert({
      tenant_id: tenantId,
      product_id: productId,
      original_filename: path.basename(filePath),
      image_hash: imageHash,
      display_order: options.displayOrder || 0,
      is_primary: options.isPrimary || false,
      status: 'pending'
    }).returning('*').then(rows => rows[0]);
  }

  async createImageRecordFromUrl(tenantId, productId, imageUrl, urlHash, options) {
    const path = require('path');
    const urlPath = new URL(imageUrl).pathname;

    return await this.db('product_images').insert({
      tenant_id: tenantId,
      product_id: productId,
      original_filename: path.basename(urlPath) || 'image_from_url',
      image_hash: urlHash,
      original_url: imageUrl,
      display_order: options.displayOrder || 0,
      is_primary: options.isPrimary || false,
      status: 'pending'
    }).returning('*').then(rows => rows[0]);
  }

  calculateCompressionRatio(processingResult) {
    const originalSize = processingResult.metadata?.fileSize || 0;
    const totalProcessedSize = processingResult.images?.reduce((sum, img) => sum + (img.fileSize || 0), 0) || 0;
    
    if (originalSize === 0) return 0;
    return Math.round(((originalSize - totalProcessedSize) / originalSize) * 100);
  }

  async deleteImageFiles(variants) {
    const fs = require('fs').promises;
    
    for (const variant of variants) {
      try {
        await fs.unlink(variant.path);
      } catch (error) {
        this.logger.warn(`Failed to delete image file ${variant.path}:`, error);
      }
    }
  }

  async publishImageEvent(eventType, imageData, processingData = {}) {
    try {
      await this.eventPublisher.publish(eventType, {
        ...imageData,
        ...processingData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to publish image event:', error);
    }
  }

  /**
   * Upload processed images to CDN
   */
  async uploadToCDN(imageId, processingResult) {
    if (!this.cdnService) {
      return { success: false, reason: 'CDN service not initialized' };
    }

    try {
      const uploadPromises = [];
      const urls = {};

      // Upload each variant to CDN
      for (const variant of processingResult.images) {
        const cdnKey = `products/images/${imageId}/${variant.size}_${variant.format}.${variant.extension}`;
        
        const uploadPromise = this.cdnService.uploadFile(variant.path, cdnKey)
          .then(result => {
            if (result.success) {
              urls[`${variant.size}_${variant.format}`] = {
                url: result.cdnUrl,
                size: result.size,
                key: result.key
              };
            }
            return result;
          })
          .catch(error => {
            this.logger.error(`CDN upload failed for variant ${variant.size}_${variant.format}`, {
              error: error.message,
              imageId,
              variantPath: variant.path
            });
            return { success: false, error: error.message };
          });

        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter(r => r.success);
      
      this.logger.info('CDN upload completed', {
        imageId,
        totalVariants: processingResult.images.length,
        successfulUploads: successfulUploads.length,
        urls: Object.keys(urls)
      });

      return {
        success: successfulUploads.length > 0,
        urls,
        uploadResults,
        totalUploaded: successfulUploads.length
      };

    } catch (error) {
      this.logger.error('CDN upload process failed', {
        imageId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge processing results with CDN URLs
   */
  mergeVariantsWithCDN(variants, cdnResults) {
    if (!cdnResults.success || !cdnResults.urls) {
      return variants;
    }

    return variants.map(variant => {
      const cdnKey = `${variant.size}_${variant.format}`;
      const cdnData = cdnResults.urls[cdnKey];
      
      if (cdnData) {
        return {
          ...variant,
          cdnUrl: cdnData.url,
          cdnKey: cdnData.key,
          deliveryMethod: 'cdn'
        };
      }
      
      return {
        ...variant,
        deliveryMethod: 'local'
      };
    });
  }

  /**
   * Get responsive image URLs for a product image
   */
  async getResponsiveUrls(imageId, options = {}) {
    try {
      const imageRecord = await this.db('product_images')
        .where('id', imageId)
        .first();

      if (!imageRecord || !imageRecord.variants) {
        return null;
      }

      const variants = JSON.parse(imageRecord.variants);
      const responsiveUrls = {
        original: null,
        sizes: {},
        webp: {},
        fallback: null
      };

      // Generate URLs for each variant
      variants.forEach(variant => {
        const key = variant.cdnKey || `products/images/${imageId}/${variant.size}_${variant.format}.${variant.extension}`;
        
        if (variant.cdnUrl) {
          // Use CDN URL if available
          if (variant.format === 'webp') {
            responsiveUrls.webp[variant.size] = variant.cdnUrl;
          } else {
            responsiveUrls.sizes[variant.size] = variant.cdnUrl;
            if (variant.size === 'large') {
              responsiveUrls.original = variant.cdnUrl;
            }
          }
        } else {
          // Generate CDN URL for existing variants
          const cdnUrl = this.cdnService.getCDNUrl(key, options);
          
          if (variant.format === 'webp') {
            responsiveUrls.webp[variant.size] = cdnUrl;
          } else {
            responsiveUrls.sizes[variant.size] = cdnUrl;
            if (variant.size === 'large') {
              responsiveUrls.original = cdnUrl;
            }
          }
        }
      });

      // Set fallback URL
      responsiveUrls.fallback = responsiveUrls.sizes.medium || 
                               responsiveUrls.sizes.small || 
                               responsiveUrls.original;

      return responsiveUrls;

    } catch (error) {
      this.logger.error('Failed to get responsive URLs', {
        imageId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Delete image from CDN
   */
  async deleteFromCDN(imageId) {
    try {
      const imageRecord = await this.db('product_images')
        .where('id', imageId)
        .first();

      if (!imageRecord || !imageRecord.variants) {
        return { success: true, message: 'No CDN assets to delete' };
      }

      const variants = JSON.parse(imageRecord.variants);
      const deletePromises = [];

      // Delete each variant from CDN
      variants.forEach(variant => {
        if (variant.cdnKey) {
          deletePromises.push(
            this.cdnService.deleteFile(variant.cdnKey)
              .catch(error => {
                this.logger.error(`Failed to delete CDN file: ${variant.cdnKey}`, {
                  error: error.message
                });
                return { success: false, key: variant.cdnKey, error: error.message };
              })
          );
        }
      });

      if (deletePromises.length === 0) {
        return { success: true, message: 'No CDN keys found' };
      }

      const deleteResults = await Promise.all(deletePromises);
      const successful = deleteResults.filter(r => r.success);

      this.logger.info('CDN deletion completed', {
        imageId,
        totalAssets: deletePromises.length,
        successfulDeletes: successful.length
      });

      return {
        success: true,
        deleted: successful.length,
        total: deletePromises.length,
        results: deleteResults
      };

    } catch (error) {
      this.logger.error('CDN deletion failed', {
        imageId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Get CDN statistics
   */
  async getCDNStats() {
    try {
      const health = await this.cdnService.healthCheck();
      const stats = await this.cdnService.getStatistics();
      
      return {
        health,
        statistics: stats,
        config: {
          bucket: this.cdnService.config.bucketName,
          distribution: this.cdnService.config.distributionId,
          domain: this.cdnService.config.domainName
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get image processing statistics
   */
  getStats() {
    return {
      imageProcessor: this.imageProcessor.getStats(),
      cdn: this.cdnService ? 'enabled' : 'disabled',
      config: this.config
    };
  }

  /**
   * Cleanup old images
   */
  async cleanup(daysOld = 30) {
    return await this.imageProcessor.cleanup(daysOld);
  }
}

module.exports = ProductImageManager;