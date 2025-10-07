const express = require('express');
const router = express.Router();
const CDNService = require('../../shared/services/CDNService');

/**
 * CDN Management Routes
 * Administrative endpoints for CDN operations
 */

let cdnService;

// Initialize CDN service
const initializeCDNService = () => {
  if (!cdnService) {
    cdnService = new CDNService({
      bucketName: process.env.CDN_BUCKET_NAME,
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      domainName: process.env.CDN_DOMAIN_NAME,
      enableLocalFallback: true
    });
  }
  return cdnService;
};

/**
 * GET /api/cdn/health
 * CDN service health check
 */
router.get('/health', async (req, res) => {
  try {
    const cdn = initializeCDNService();
    const health = await cdn.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      status: 'error'
    });
  }
});

/**
 * GET /api/cdn/stats
 * Get CDN statistics and usage
 */
router.get('/stats', async (req, res) => {
  try {
    const cdn = initializeCDNService();
    const { startDate, endDate } = req.query;
    
    const stats = await cdn.getStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    
    res.json({
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cdn/upload
 * Manual file upload to CDN
 */
router.post('/upload', async (req, res) => {
  try {
    const { filePath, key, options = {} } = req.body;
    
    if (!filePath || !key) {
      return res.status(400).json({
        error: 'filePath and key are required'
      });
    }

    const cdn = initializeCDNService();
    const result = await cdn.uploadFile(filePath, key, options);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cdn/upload-batch
 * Batch upload multiple files to CDN
 */
router.post('/upload-batch', async (req, res) => {
  try {
    const { files, options = {} } = req.body;
    
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: 'files array is required'
      });
    }

    const cdn = initializeCDNService();
    const results = await cdn.uploadBatch(files, options);
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => r.error).length,
      results
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cdn/file/:key
 * Delete file from CDN
 */
router.delete('/file/:key(*)', async (req, res) => {
  try {
    const { key } = req.params;
    
    const cdn = initializeCDNService();
    const result = await cdn.deleteFile(key);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cdn/invalidate
 * Invalidate CloudFront cache
 */
router.post('/invalidate', async (req, res) => {
  try {
    const { paths } = req.body;
    
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({
        error: 'paths array is required'
      });
    }

    const cdn = initializeCDNService();
    const result = await cdn.invalidateCache(paths);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cdn/url/:key
 * Get CDN URL for a key with optional transformations
 */
router.get('/url/:key(*)', (req, res) => {
  try {
    const { key } = req.params;
    const { width, height, quality, format } = req.query;
    
    const cdn = initializeCDNService();
    const url = cdn.getCDNUrl(key, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      quality: quality ? parseInt(quality) : undefined,
      format
    });
    
    res.json({ key, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cdn/responsive/:key
 * Get responsive image URLs for a key
 */
router.get('/responsive/:key(*)', (req, res) => {
  try {
    const { key } = req.params;
    const { sizes } = req.query;
    
    const cdn = initializeCDNService();
    
    // Parse sizes if provided
    const sizeArray = sizes ? 
      sizes.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s)) :
      undefined;
    
    const urls = cdn.getResponsiveImageUrls(key, sizeArray);
    
    res.json({ key, urls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cdn/config
 * Get CDN configuration (safe fields only)
 */
router.get('/config', (req, res) => {
  const cdn = initializeCDNService();
  
  res.json({
    enabled: cdn.awsEnabled,
    bucket: cdn.config.bucketName,
    domain: cdn.config.domainName,
    assetTypes: cdn.assetTypes,
    localFallback: cdn.config.enableLocalFallback
  });
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  req.logger?.error('CDN route error', {
    error: error.message,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal CDN service error',
    message: error.message
  });
});

module.exports = router;