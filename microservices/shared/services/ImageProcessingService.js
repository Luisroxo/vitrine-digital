const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { Logger, EventPublisher } = require('../../../shared');

/**
 * Image Processing Service for Product Images
 * Handles automatic image optimization, resizing, and compression
 */
class ImageProcessingService {
  constructor(options = {}) {
    this.logger = new Logger('image-processing');
    this.eventPublisher = new EventPublisher();

    // Configuration
    this.config = {
      // Storage paths
      uploadPath: options.uploadPath || './uploads',
      processedPath: options.processedPath || './uploads/processed',
      tempPath: options.tempPath || './uploads/temp',

      // Image sizes for different use cases
      sizes: {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 },
        original: { maxWidth: 2048, maxHeight: 2048 }
      },

      // Quality settings
      quality: {
        jpeg: 85,
        webp: 80,
        png: 95
      },

      // Supported formats
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'bmp'],
      outputFormats: ['jpeg', 'webp'], // Generate both JPEG and WebP

      // Processing options
      enableWebP: true,
      enableProgressive: true,
      stripMetadata: true,
      enableSharpening: true,

      // Limits
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentJobs: 3,
      processingTimeout: 30000, // 30 seconds

      // CDN configuration
      cdnEnabled: false,
      cdnBaseUrl: process.env.CDN_BASE_URL || '',
      
      ...options
    };

    // State management
    this.state = {
      initialized: false,
      processingQueue: [],
      activeJobs: 0,
      totalProcessed: 0,
      totalErrors: 0
    };

    // Statistics
    this.stats = {
      totalImages: 0,
      totalSizeReduced: 0,
      averageCompressionRatio: 0,
      processingTimes: [],
      errorCount: 0,
      lastProcessed: null
    };
  }

  /**
   * Initialize the image processing service
   */
  async initialize() {
    try {
      this.logger.info('Initializing Image Processing Service...');

      // Create necessary directories
      await this.ensureDirectories();

      // Test Sharp library
      await this.testSharpLibrary();

      this.state.initialized = true;
      this.logger.info('Image Processing Service initialized successfully');

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Image Processing Service:', error);
      throw error;
    }
  }

  /**
   * Ensure all necessary directories exist
   */
  async ensureDirectories() {
    const directories = [
      this.config.uploadPath,
      this.config.processedPath,
      this.config.tempPath,
      path.join(this.config.processedPath, 'thumbnail'),
      path.join(this.config.processedPath, 'small'),
      path.join(this.config.processedPath, 'medium'),
      path.join(this.config.processedPath, 'large')
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Test Sharp library functionality
   */
  async testSharpLibrary() {
    try {
      // Create a simple test image
      const testBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      }).jpeg().toBuffer();

      this.logger.debug('Sharp library test successful');
      return true;
    } catch (error) {
      this.logger.error('Sharp library test failed:', error);
      throw new Error('Sharp library not working properly');
    }
  }

  /**
   * Process a single image file
   */
  async processImage(inputPath, options = {}) {
    const startTime = Date.now();
    const jobId = this.generateJobId();

    try {
      this.logger.info(`Starting image processing job ${jobId}`, {
        inputPath,
        options
      });

      // Validate input
      await this.validateImageFile(inputPath);

      // Get image metadata
      const metadata = await this.getImageMetadata(inputPath);
      
      // Generate output filename
      const outputName = options.outputName || this.generateOutputName(inputPath);
      
      // Process image in different sizes and formats
      const processedImages = await this.generateImageVariants(
        inputPath,
        outputName,
        metadata,
        options
      );

      // Calculate statistics
      const processingTime = Date.now() - startTime;
      await this.updateStatistics(metadata, processedImages, processingTime);

      // Publish processing completion event
      await this.publishProcessingEvent('image.processed', {
        jobId,
        inputPath,
        outputImages: processedImages,
        metadata,
        processingTime,
        compressionRatio: this.calculateCompressionRatio(metadata, processedImages)
      });

      this.logger.info(`Image processing completed for job ${jobId}`, {
        processingTime: `${processingTime}ms`,
        variants: processedImages.length
      });

      return {
        jobId,
        success: true,
        images: processedImages,
        metadata,
        processingTime
      };

    } catch (error) {
      this.logger.error(`Image processing failed for job ${jobId}:`, error);
      this.state.totalErrors++;
      
      await this.publishProcessingEvent('image.processing.failed', {
        jobId,
        inputPath,
        error: error.message
      });

      throw error;
    } finally {
      this.state.activeJobs--;
    }
  }

  /**
   * Process image from URL
   */
  async processImageFromUrl(imageUrl, options = {}) {
    const tempFilePath = path.join(
      this.config.tempPath,
      `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    try {
      // Download image
      this.logger.debug(`Downloading image from URL: ${imageUrl}`);
      await this.downloadImage(imageUrl, tempFilePath);

      // Process the downloaded image
      const result = await this.processImage(tempFilePath, options);

      return result;

    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        this.logger.warn('Failed to cleanup temp file:', error);
      }
    }
  }

  /**
   * Generate image variants in different sizes and formats
   */
  async generateImageVariants(inputPath, outputName, metadata, options = {}) {
    const variants = [];
    const sizesToGenerate = options.sizes || Object.keys(this.config.sizes);
    const formatsToGenerate = options.formats || this.config.outputFormats;

    for (const sizeName of sizesToGenerate) {
      const sizeConfig = this.config.sizes[sizeName];
      
      if (!sizeConfig) {
        this.logger.warn(`Unknown size configuration: ${sizeName}`);
        continue;
      }

      for (const format of formatsToGenerate) {
        try {
          const variant = await this.generateSingleVariant(
            inputPath,
            outputName,
            sizeName,
            sizeConfig,
            format,
            metadata
          );
          
          variants.push(variant);
        } catch (error) {
          this.logger.error(`Failed to generate variant ${sizeName}-${format}:`, error);
        }
      }
    }

    return variants;
  }

  /**
   * Generate a single image variant
   */
  async generateSingleVariant(inputPath, outputName, sizeName, sizeConfig, format, metadata) {
    const outputDir = path.join(this.config.processedPath, sizeName);
    const outputFileName = `${outputName}_${sizeName}.${format}`;
    const outputPath = path.join(outputDir, outputFileName);

    let sharpInstance = sharp(inputPath);

    // Configure processing pipeline
    if (this.config.stripMetadata) {
      sharpInstance = sharpInstance.withMetadata({ 
        exif: {},
        icc: format !== 'jpeg' // Keep ICC for non-JPEG formats
      });
    }

    // Resize image
    if (sizeName !== 'original') {
      sharpInstance = sharpInstance.resize(sizeConfig.width, sizeConfig.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    } else if (sizeConfig.maxWidth || sizeConfig.maxHeight) {
      // For original, just ensure it doesn't exceed max dimensions
      sharpInstance = sharpInstance.resize(sizeConfig.maxWidth, sizeConfig.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format-specific settings
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({
          quality: this.config.quality.jpeg,
          progressive: this.config.enableProgressive,
          mozjpeg: true
        });
        break;

      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: this.config.quality.webp,
          effort: 6
        });
        break;

      case 'png':
        sharpInstance = sharpInstance.png({
          quality: this.config.quality.png,
          compressionLevel: 9
        });
        break;
    }

    // Apply sharpening if enabled
    if (this.config.enableSharpening) {
      sharpInstance = sharpInstance.sharpen();
    }

    // Process and save
    const outputBuffer = await sharpInstance.toBuffer();
    await fs.writeFile(outputPath, outputBuffer);

    // Get processed image stats
    const processedMetadata = await sharp(outputBuffer).metadata();

    return {
      size: sizeName,
      format: format,
      path: outputPath,
      relativePath: path.relative(this.config.processedPath, outputPath),
      filename: outputFileName,
      width: processedMetadata.width,
      height: processedMetadata.height,
      fileSize: outputBuffer.length,
      url: this.generateImageUrl(outputPath),
      cdnUrl: this.generateCdnUrl(outputPath)
    };
  }

  /**
   * Validate image file
   */
  async validateImageFile(filePath) {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      
      // Check file size
      if (stats.size > this.config.maxFileSize) {
        throw new Error(`File size ${stats.size} exceeds maximum ${this.config.maxFileSize}`);
      }

      // Check file format using Sharp
      const metadata = await sharp(filePath).metadata();
      
      if (!this.config.supportedFormats.includes(metadata.format)) {
        throw new Error(`Unsupported format: ${metadata.format}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Image validation failed: ${error.message}`);
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      const stats = await fs.stat(filePath);

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        fileSize: stats.size,
        filename: path.basename(filePath)
      };
    } catch (error) {
      this.logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(url, outputPath) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 10000,
        maxContentLength: this.config.maxFileSize
      });

      const writer = require('fs').createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate output name from input path
   */
  generateOutputName(inputPath) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const hash = crypto.createHash('md5').update(inputPath + Date.now()).digest('hex').substr(0, 8);
    return `${basename}_${hash}`;
  }

  /**
   * Generate image URL
   */
  generateImageUrl(imagePath) {
    const relativePath = path.relative(this.config.processedPath, imagePath);
    return `/images/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Generate CDN URL if enabled
   */
  generateCdnUrl(imagePath) {
    if (!this.config.cdnEnabled || !this.config.cdnBaseUrl) {
      return null;
    }

    const relativePath = path.relative(this.config.processedPath, imagePath);
    return `${this.config.cdnBaseUrl}/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio(originalMetadata, processedImages) {
    const originalSize = originalMetadata.fileSize;
    const totalProcessedSize = processedImages.reduce((sum, img) => sum + img.fileSize, 0);
    
    if (originalSize === 0) return 0;
    return ((originalSize - totalProcessedSize) / originalSize) * 100;
  }

  /**
   * Update processing statistics
   */
  async updateStatistics(metadata, processedImages, processingTime) {
    this.stats.totalImages++;
    this.stats.lastProcessed = new Date();
    
    // Update processing times
    this.stats.processingTimes.push(processingTime);
    if (this.stats.processingTimes.length > 100) {
      this.stats.processingTimes = this.stats.processingTimes.slice(-100);
    }

    // Update compression statistics
    const sizeReduction = metadata.fileSize - processedImages.reduce((sum, img) => sum + img.fileSize, 0);
    this.stats.totalSizeReduced += sizeReduction;

    // Calculate average compression ratio
    const compressionRatio = this.calculateCompressionRatio(metadata, processedImages);
    this.stats.averageCompressionRatio = (
      (this.stats.averageCompressionRatio * (this.stats.totalImages - 1) + compressionRatio) / 
      this.stats.totalImages
    );
  }

  /**
   * Publish processing events
   */
  async publishProcessingEvent(eventType, data) {
    try {
      await this.eventPublisher.publish(eventType, {
        ...data,
        timestamp: new Date().toISOString(),
        service: 'image-processing'
      });
    } catch (error) {
      this.logger.error('Failed to publish processing event:', error);
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTimes.length > 0 
      ? this.stats.processingTimes.reduce((sum, time) => sum + time, 0) / this.stats.processingTimes.length
      : 0;

    return {
      ...this.stats,
      averageProcessingTime: Math.round(avgProcessingTime),
      currentState: {
        activeJobs: this.state.activeJobs,
        queueSize: this.state.processingQueue.length,
        initialized: this.state.initialized
      },
      config: {
        supportedFormats: this.config.supportedFormats,
        outputFormats: this.config.outputFormats,
        maxFileSize: this.config.maxFileSize,
        cdnEnabled: this.config.cdnEnabled
      }
    };
  }

  /**
   * Clean up old processed images
   */
  async cleanup(daysOld = 30) {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      const processDirectory = async (dirPath) => {
        try {
          const files = await fs.readdir(dirPath);
          
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
              await processDirectory(filePath);
            } else if (stats.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        } catch (error) {
          this.logger.warn(`Error processing directory ${dirPath}:`, error);
        }
      };

      await processDirectory(this.config.processedPath);
      
      this.logger.info(`Cleanup completed: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = ImageProcessingService;