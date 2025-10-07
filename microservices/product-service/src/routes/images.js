const express = require('express');
const ProductImagesController = require('../controllers/ProductImagesController');
const { JWTUtils } = require('../../../shared');

/**
 * Product Images Routes
 * RESTful API routes for product image management
 */
function createProductImagesRoutes(database, eventPublisher) {
  const router = express.Router();
  const imagesController = new ProductImagesController(database, eventPublisher);
  const jwtUtils = new JWTUtils();

  // Initialize controller
  imagesController.initialize().catch(error => {
    console.error('Failed to initialize ProductImagesController:', error);
  });

  // Middleware
  const authMiddleware = jwtUtils.createAuthMiddleware();

  // Error handling middleware for multer
  const handleMulterError = (error, req, res, next) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB'
        });
      }
      
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Too many files. Maximum is 5 files per request'
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next();
  };

  // Routes

  /**
   * GET /products/:productId/images
   * Get all images for a product
   */
  router.get('/products/:productId/images', 
    authMiddleware,
    imagesController.getProductImages.bind(imagesController)
  );

  /**
   * GET /products/:productId/images/:imageId
   * Get specific image details
   */
  router.get('/products/:productId/images/:imageId',
    authMiddleware,
    imagesController.getImageDetails.bind(imagesController)
  );

  /**
   * POST /products/:productId/images/upload
   * Upload single image file
   */
  router.post('/products/:productId/images/upload',
    authMiddleware,
    imagesController.getSingleUploadMiddleware(),
    handleMulterError,
    imagesController.uploadSingleImage.bind(imagesController)
  );

  /**
   * POST /products/:productId/images/upload-multiple
   * Upload multiple image files
   */
  router.post('/products/:productId/images/upload-multiple',
    authMiddleware,
    imagesController.getMultipleUploadMiddleware(),
    handleMulterError,
    imagesController.uploadMultipleImages.bind(imagesController)
  );

  /**
   * POST /products/:productId/images/from-url
   * Add image from URL
   */
  router.post('/products/:productId/images/from-url',
    authMiddleware,
    imagesController.addImageFromUrl.bind(imagesController)
  );

  /**
   * PUT /products/:productId/images/:imageId/primary
   * Set image as primary
   */
  router.put('/products/:productId/images/:imageId/primary',
    authMiddleware,
    imagesController.setPrimaryImage.bind(imagesController)
  );

  /**
   * PUT /products/:productId/images/:imageId
   * Update image metadata (display order, alt text, etc.)
   */
  router.put('/products/:productId/images/:imageId',
    authMiddleware,
    imagesController.updateImageMetadata.bind(imagesController)
  );

  /**
   * DELETE /products/:productId/images/:imageId
   * Delete specific image
   */
  router.delete('/products/:productId/images/:imageId',
    authMiddleware,
    imagesController.deleteImage.bind(imagesController)
  );

  /**
   * POST /products/:productId/images/reprocess
   * Reprocess failed images for a product
   */
  router.post('/products/:productId/images/reprocess',
    authMiddleware,
    imagesController.reprocessFailedImages.bind(imagesController)
  );

  /**
   * PUT /products/:productId/images/bulk-order
   * Bulk update image display orders
   */
  router.put('/products/:productId/images/bulk-order',
    authMiddleware,
    imagesController.bulkUpdateOrder.bind(imagesController)
  );

  // Administrative routes

  /**
   * GET /images/stats
   * Get image processing statistics
   */
  router.get('/images/stats',
    authMiddleware,
    imagesController.getProcessingStats.bind(imagesController)
  );

  /**
   * POST /images/reprocess-all
   * Reprocess all failed images for tenant
   */
  router.post('/images/reprocess-all',
    authMiddleware,
    async (req, res, next) => {
      req.params.productId = null; // Process all products
      next();
    },
    imagesController.reprocessFailedImages.bind(imagesController)
  );

  /**
   * POST /images/cleanup
   * Cleanup old processed images
   */
  router.post('/images/cleanup',
    authMiddleware,
    imagesController.cleanupOldImages.bind(imagesController)
  );

  return router;
}

module.exports = createProductImagesRoutes;