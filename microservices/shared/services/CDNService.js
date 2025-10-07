const AWS = require('aws-sdk');
const { Logger } = require('../../shared');
const path = require('path');
const fs = require('fs').promises;

/**
 * CDN Management Service
 * Handles CloudFront distribution management and asset optimization
 */
class CDNService {
  constructor(options = {}) {
    this.logger = new Logger('cdn-service');
    this.config = {
      // AWS Configuration
      region: options.region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      
      // S3 Configuration
      bucketName: options.bucketName || process.env.CDN_BUCKET_NAME || 'vitrine-digital-cdn',
      bucketRegion: options.bucketRegion || process.env.CDN_BUCKET_REGION || 'us-east-1',
      
      // CloudFront Configuration
      distributionId: options.distributionId || process.env.CLOUDFRONT_DISTRIBUTION_ID,
      domainName: options.domainName || process.env.CDN_DOMAIN_NAME,
      
      // Cache Configuration
      defaultCacheTTL: options.defaultCacheTTL || 86400, // 24 hours
      maxCacheTTL: options.maxCacheTTL || 31536000, // 1 year
      
      // Local fallback
      localStaticPath: options.localStaticPath || './uploads',
      enableLocalFallback: options.enableLocalFallback !== false
    };

    // Initialize AWS services
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      AWS.config.update({
        region: this.config.region,
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      });

      this.s3 = new AWS.S3();
      this.cloudfront = new AWS.CloudFront();
      this.awsEnabled = true;
    } else {
      this.logger.warn('AWS credentials not configured, using local fallback');
      this.awsEnabled = false;
    }

    // Asset type configurations
    this.assetTypes = {
      images: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
        cacheTTL: 31536000, // 1 year
        gzip: false,
        prefix: 'images/'
      },
      documents: {
        extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
        cacheTTL: 86400, // 1 day
        gzip: true,
        prefix: 'documents/'
      },
      assets: {
        extensions: ['.css', '.js', '.woff', '.woff2', '.ttf'],
        cacheTTL: 31536000, // 1 year
        gzip: true,
        prefix: 'assets/'
      },
      videos: {
        extensions: ['.mp4', '.webm', '.ogg'],
        cacheTTL: 31536000, // 1 year
        gzip: false,
        prefix: 'videos/'
      }
    };
  }

  /**
   * Upload file to CDN (S3 + CloudFront)
   */
  async uploadFile(filePath, key, options = {}) {
    const assetType = this.getAssetType(filePath);
    const config = this.assetTypes[assetType];
    
    if (!this.awsEnabled) {
      return this.handleLocalUpload(filePath, key, options);
    }

    try {
      const fileContent = await fs.readFile(filePath);
      const contentType = this.getContentType(filePath);
      const finalKey = config.prefix + key;

      const uploadParams = {
        Bucket: this.config.bucketName,
        Key: finalKey,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: `max-age=${config.cacheTTL}`,
        ...options.s3Params
      };

      // Add compression for supported types
      if (config.gzip && !options.skipGzip) {
        const zlib = require('zlib');
        uploadParams.Body = zlib.gzipSync(fileContent);
        uploadParams.ContentEncoding = 'gzip';
      }

      // Set public read if not specified
      if (!uploadParams.ACL) {
        uploadParams.ACL = 'public-read';
      }

      const result = await this.s3.upload(uploadParams).promise();
      
      const cdnUrl = this.getCDNUrl(finalKey);
      
      this.logger.info('File uploaded to CDN', {
        key: finalKey,
        size: fileContent.length,
        contentType,
        cdnUrl
      });

      return {
        success: true,
        key: finalKey,
        url: result.Location,
        cdnUrl,
        size: fileContent.length,
        contentType
      };

    } catch (error) {
      this.logger.error('CDN upload failed', {
        filePath,
        key,
        error: error.message
      });
      
      // Fallback to local storage
      if (this.config.enableLocalFallback) {
        return this.handleLocalUpload(filePath, key, options);
      }
      
      throw error;
    }
  }

  /**
   * Upload multiple files in batch
   */
  async uploadBatch(files, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(file => 
        this.uploadFile(file.path, file.key, file.options)
          .catch(error => ({ error: error.message, file }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Delete file from CDN
   */
  async deleteFile(key) {
    if (!this.awsEnabled) {
      return this.handleLocalDelete(key);
    }

    try {
      const deleteParams = {
        Bucket: this.config.bucketName,
        Key: key
      };

      await this.s3.deleteObject(deleteParams).promise();
      
      // Invalidate CloudFront cache
      if (this.config.distributionId) {
        await this.invalidateCache([key]);
      }

      this.logger.info('File deleted from CDN', { key });
      
      return { success: true, key };

    } catch (error) {
      this.logger.error('CDN delete failed', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get optimized CDN URL for asset
   */
  getCDNUrl(key, options = {}) {
    if (!this.config.domainName && !this.awsEnabled) {
      // Return local URL as fallback
      return `/uploads/${key}`;
    }

    const baseUrl = this.config.domainName || 
      `${this.config.bucketName}.s3.${this.config.bucketRegion}.amazonaws.com`;
    
    let url = `https://${baseUrl}/${key}`;
    
    // Add query parameters for image transformations
    if (options.width || options.height || options.quality) {
      const params = new URLSearchParams();
      if (options.width) params.append('w', options.width);
      if (options.height) params.append('h', options.height);
      if (options.quality) params.append('q', options.quality);
      if (options.format) params.append('f', options.format);
      
      url += `?${params.toString()}`;
    }
    
    return url;
  }

  /**
   * Generate responsive image URLs
   */
  getResponsiveImageUrls(key, sizes = [150, 300, 600, 1200]) {
    const urls = {};
    
    sizes.forEach(size => {
      urls[`w${size}`] = this.getCDNUrl(key, { 
        width: size,
        quality: size > 600 ? 85 : 90 // Lower quality for larger images
      });
    });
    
    // Add WebP variants for modern browsers
    sizes.forEach(size => {
      urls[`w${size}_webp`] = this.getCDNUrl(key, { 
        width: size,
        quality: size > 600 ? 85 : 90,
        format: 'webp'
      });
    });
    
    return urls;
  }

  /**
   * Invalidate CloudFront cache
   */
  async invalidateCache(paths) {
    if (!this.awsEnabled || !this.config.distributionId) {
      this.logger.warn('CloudFront not configured, skipping cache invalidation');
      return { success: false, reason: 'CloudFront not configured' };
    }

    try {
      const invalidationParams = {
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths.map(path => `/${path}`)
          },
          CallerReference: `invalidation-${Date.now()}`
        }
      };

      const result = await this.cloudfront.createInvalidation(invalidationParams).promise();
      
      this.logger.info('Cache invalidation created', {
        invalidationId: result.Invalidation.Id,
        paths
      });

      return {
        success: true,
        invalidationId: result.Invalidation.Id,
        paths
      };

    } catch (error) {
      this.logger.error('Cache invalidation failed', {
        paths,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get CDN statistics
   */
  async getStatistics(startDate, endDate) {
    if (!this.awsEnabled || !this.config.distributionId) {
      return { error: 'CloudFront not configured' };
    }

    try {
      // Get distribution statistics
      const statsParams = {
        DistributionId: this.config.distributionId,
        StartTime: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        EndTime: endDate || new Date(),
        Granularity: 'PT1H' // Hourly granularity
      };

      const [distribution, statistics] = await Promise.all([
        this.cloudfront.getDistribution({ Id: this.config.distributionId }).promise(),
        this.cloudfront.getDistributionStatistics ? 
          this.cloudfront.getDistributionStatistics(statsParams).promise() : 
          Promise.resolve(null)
      ]);

      return {
        distribution: {
          domainName: distribution.Distribution.DomainName,
          status: distribution.Distribution.Status,
          lastModified: distribution.Distribution.LastModifiedTime,
          enabled: distribution.Distribution.DistributionConfig.Enabled
        },
        statistics: statistics || { message: 'Statistics API not available' }
      };

    } catch (error) {
      this.logger.error('Failed to get CDN statistics', {
        error: error.message
      });
      return { error: error.message };
    }
  }

  /**
   * Health check for CDN service
   */
  async healthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      aws: {
        enabled: this.awsEnabled,
        s3: false,
        cloudfront: false
      },
      config: {
        bucket: this.config.bucketName,
        distribution: this.config.distributionId,
        domain: this.config.domainName
      }
    };

    if (this.awsEnabled) {
      try {
        // Test S3 connectivity
        await this.s3.headBucket({ Bucket: this.config.bucketName }).promise();
        health.aws.s3 = true;

        // Test CloudFront if configured
        if (this.config.distributionId) {
          await this.cloudfront.getDistribution({ 
            Id: this.config.distributionId 
          }).promise();
          health.aws.cloudfront = true;
        }

        health.status = 'healthy';
      } catch (error) {
        health.status = 'degraded';
        health.error = error.message;
      }
    } else {
      health.status = 'local-fallback';
    }

    return health;
  }

  /**
   * Get asset type based on file extension
   */
  getAssetType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [type, config] of Object.entries(this.assetTypes)) {
      if (config.extensions.includes(ext)) {
        return type;
      }
    }
    
    return 'assets'; // Default type
  }

  /**
   * Get content type for file
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Handle local file upload (fallback)
   */
  async handleLocalUpload(filePath, key, options = {}) {
    try {
      const localDir = path.join(this.config.localStaticPath, path.dirname(key));
      const localPath = path.join(this.config.localStaticPath, key);
      
      // Ensure directory exists
      await fs.mkdir(localDir, { recursive: true });
      
      // Copy file
      await fs.copyFile(filePath, localPath);
      
      const stats = await fs.stat(localPath);
      
      this.logger.info('File stored locally', {
        key,
        size: stats.size,
        localPath
      });

      return {
        success: true,
        key,
        url: `/uploads/${key}`,
        cdnUrl: `/uploads/${key}`,
        size: stats.size,
        contentType: this.getContentType(filePath),
        local: true
      };

    } catch (error) {
      this.logger.error('Local upload failed', {
        filePath,
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle local file delete (fallback)
   */
  async handleLocalDelete(key) {
    try {
      const localPath = path.join(this.config.localStaticPath, key);
      await fs.unlink(localPath);
      
      this.logger.info('Local file deleted', { key, localPath });
      
      return { success: true, key, local: true };

    } catch (error) {
      this.logger.error('Local delete failed', {
        key,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CDNService;