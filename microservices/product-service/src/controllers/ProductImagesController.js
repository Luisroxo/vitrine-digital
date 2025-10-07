const ProductImageManager = require('../services/ProductImageManager');
const multer = require('multer');
const path = require('path');
const { Logger } = require('../../../shared');

/**
 * Product Images Controller
 * Handles HTTP requests for product image management
 */
class ProductImagesController {
  constructor(database, eventPublisher) {
    this.logger = new Logger('product-images-controller');
    this.imageManager = new ProductImageManager(database, eventPublisher);

    // Configure multer for file uploads
    this.upload = multer({
      dest: process.env.UPLOAD_PATH || './uploads/temp',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Max 5 files per request
      },
      fileFilter: (req, file, cb) => {
        // Check file type
        const allowedMimes = [
          'image/jpeg',
          'image/png', 
          'image/webp',
          'image/tiff',
          'image/bmp'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
      }
    });
  }

  /**
   * Initialize the controller
   */
  async initialize() {
    await this.imageManager.initialize();
  }

  /**
   * Upload single product image
   */
  async uploadSingleImage(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;
      const { isPrimary = false, displayOrder = 0 } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }

      this.logger.info('Uploading single image', {
        tenantId,
        productId,
        filename: req.file.originalname,
        size: req.file.size
      });

      const result = await this.imageManager.addProductImageFromFile(
        tenantId,
        parseInt(productId),
        req.file.path,
        {
          isPrimary: isPrimary === 'true',
          displayOrder: parseInt(displayOrder) || 0
        }
      );

      res.json({
        success: true,
        message: 'Image uploaded successfully',
        data: result
      });

    } catch (error) {
      this.logger.error('Failed to upload single image:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Upload multiple product images
   */
  async uploadMultipleImages(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No image files provided'
        });
      }

      this.logger.info('Uploading multiple images', {
        tenantId,
        productId,
        count: req.files.length
      });

      const results = [];
      const errors = [];

      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        
        try {
          const result = await this.imageManager.addProductImageFromFile(
            tenantId,
            parseInt(productId),
            file.path,
            {
              isPrimary: i === 0, // First image is primary by default
              displayOrder: i
            }
          );
          
          results.push(result);
        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Uploaded ${results.length} images successfully`,
        data: {
          uploaded: results,
          errors: errors,
          totalUploaded: results.length,
          totalErrors: errors.length
        }
      });

    } catch (error) {
      this.logger.error('Failed to upload multiple images:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add image from URL
   */
  async addImageFromUrl(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;
      const { imageUrl, isPrimary = false, displayOrder = 0 } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Image URL is required'
        });
      }

      this.logger.info('Adding image from URL', {
        tenantId,
        productId,
        imageUrl
      });

      const result = await this.imageManager.addProductImageFromUrl(
        tenantId,
        parseInt(productId),
        imageUrl,
        {
          isPrimary,
          displayOrder: parseInt(displayOrder) || 0
        }
      );

      res.json({
        success: true,
        message: 'Image added from URL successfully',
        data: result
      });

    } catch (error) {
      this.logger.error('Failed to add image from URL:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get product images
   */
  async getProductImages(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;
      const { status, includeProcessing = false } = req.query;

      const images = await this.imageManager.getProductImages(
        tenantId,
        parseInt(productId),
        {
          status,
          onlyCompleted: !includeProcessing
        }
      );

      res.json({
        success: true,
        data: {
          productId: parseInt(productId),
          images,
          totalCount: images.length
        }
      });

    } catch (error) {
      this.logger.error('Failed to get product images:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get single image details
   */
  async getImageDetails(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId, imageId } = req.params;

      const images = await this.imageManager.getProductImages(
        tenantId,
        parseInt(productId),
        { onlyCompleted: false }
      );

      const image = images.find(img => img.id === parseInt(imageId));

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      res.json({
        success: true,
        data: image
      });

    } catch (error) {
      this.logger.error('Failed to get image details:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Set primary image
   */
  async setPrimaryImage(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId, imageId } = req.params;

      await this.imageManager.setPrimaryImage(
        tenantId,
        parseInt(productId),
        parseInt(imageId)
      );

      res.json({
        success: true,
        message: 'Primary image updated successfully'
      });

    } catch (error) {
      this.logger.error('Failed to set primary image:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId, imageId } = req.params;
      const { displayOrder, altText, caption } = req.body;

      // Build update object
      const updates = {};
      if (displayOrder !== undefined) updates.display_order = parseInt(displayOrder);
      if (altText !== undefined) updates.alt_text = altText;
      if (caption !== undefined) updates.caption = caption;
      updates.updated_at = new Date();

      // Update database
      const updated = await this.imageManager.db('product_images')
        .where('id', parseInt(imageId))
        .where('tenant_id', tenantId)
        .where('product_id', parseInt(productId))
        .update(updates);

      if (updated === 0) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      res.json({
        success: true,
        message: 'Image metadata updated successfully'
      });

    } catch (error) {
      this.logger.error('Failed to update image metadata:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete product image
   */
  async deleteImage(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId, imageId } = req.params;

      await this.imageManager.deleteProductImage(
        tenantId,
        parseInt(productId),
        parseInt(imageId)
      );

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });

    } catch (error) {
      this.logger.error('Failed to delete image:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reprocess failed images
   */
  async reprocessFailedImages(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;

      const reprocessedCount = await this.imageManager.reprocessFailedImages(
        tenantId,
        productId ? parseInt(productId) : null
      );

      res.json({
        success: true,
        message: `Reprocessing ${reprocessedCount} failed images`,
        data: { reprocessedCount }
      });

    } catch (error) {
      this.logger.error('Failed to reprocess failed images:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(req, res) {
    try {
      const stats = this.imageManager.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      this.logger.error('Failed to get processing stats:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cleanup old images
   */
  async cleanupOldImages(req, res) {
    try {
      const { daysOld = 30 } = req.query;
      
      const deletedCount = await this.imageManager.cleanup(parseInt(daysOld));

      res.json({
        success: true,
        message: `Cleanup completed: ${deletedCount} files deleted`,
        data: { deletedCount }
      });

    } catch (error) {
      this.logger.error('Failed to cleanup old images:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk operations
   */
  async bulkUpdateOrder(req, res) {
    try {
      const { tenantId } = req.user;
      const { productId } = req.params;
      const { imageOrders } = req.body; // Array of { imageId, displayOrder }

      if (!Array.isArray(imageOrders)) {
        return res.status(400).json({
          success: false,
          error: 'imageOrders must be an array'
        });
      }

      // Update orders in transaction
      await this.imageManager.db.transaction(async (trx) => {
        for (const { imageId, displayOrder } of imageOrders) {
          await trx('product_images')
            .where('id', imageId)
            .where('tenant_id', tenantId)
            .where('product_id', parseInt(productId))
            .update({ 
              display_order: displayOrder,
              updated_at: new Date()
            });
        }
      });

      res.json({
        success: true,
        message: 'Image orders updated successfully'
      });

    } catch (error) {
      this.logger.error('Failed to bulk update image orders:', error);
      
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get multer middleware for single file upload
   */
  getSingleUploadMiddleware() {
    return this.upload.single('image');
  }

  /**
   * Get multer middleware for multiple file upload
   */
  getMultipleUploadMiddleware() {
    return this.upload.array('images', 5);
  }
}

module.exports = ProductImagesController;