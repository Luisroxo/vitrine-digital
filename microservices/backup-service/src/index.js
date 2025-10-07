require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const AutomatedBackupSystem = require('../../shared/services/AutomatedBackupSystem');
const backupRoutes = require('../../shared/routes/backupRoutes');

/**
 * Backup Service - Standalone service for automated backup operations
 */
class BackupService {
  constructor() {
    this.app = express();
    this.port = process.env.BACKUP_SERVICE_PORT || 3005;
    
    // Initialize backup system
    this.backupSystem = new AutomatedBackupSystem({
      backupPath: process.env.BACKUP_PATH || '/app/backups',
      databases: this.getDatabaseConfigs(),
      storage: this.getStorageConfig(),
      retention: {
        daily: parseInt(process.env.BACKUP_RETENTION_DAILY) || 7,
        weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY) || 4,
        monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY) || 12
      },
      schedule: {
        daily: process.env.BACKUP_SCHEDULE_DAILY || '0 2 * * *',
        weekly: process.env.BACKUP_SCHEDULE_WEEKLY || '0 3 * * 0',
        monthly: process.env.BACKUP_SCHEDULE_MONTHLY || '0 4 1 * *'
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  getDatabaseConfigs() {
    const databases = [];
    
    // Auth Service Database
    if (process.env.AUTH_DB_HOST) {
      databases.push({
        service: 'auth-service',
        type: 'postgresql',
        host: process.env.AUTH_DB_HOST,
        port: process.env.AUTH_DB_PORT || 5432,
        database: process.env.AUTH_DB_NAME || 'auth_db',
        username: process.env.AUTH_DB_USER,
        password: process.env.AUTH_DB_PASSWORD
      });
    }
    
    // Product Service Database
    if (process.env.PRODUCT_DB_HOST) {
      databases.push({
        service: 'product-service',
        type: 'postgresql',
        host: process.env.PRODUCT_DB_HOST,
        port: process.env.PRODUCT_DB_PORT || 5432,
        database: process.env.PRODUCT_DB_NAME || 'product_db',
        username: process.env.PRODUCT_DB_USER,
        password: process.env.PRODUCT_DB_PASSWORD
      });
    }
    
    // Bling Service Database
    if (process.env.BLING_DB_HOST) {
      databases.push({
        service: 'bling-service',
        type: 'postgresql',
        host: process.env.BLING_DB_HOST,
        port: process.env.BLING_DB_PORT || 5432,
        database: process.env.BLING_DB_NAME || 'bling_db',
        username: process.env.BLING_DB_USER,
        password: process.env.BLING_DB_PASSWORD
      });
    }
    
    // Billing Service Database
    if (process.env.BILLING_DB_HOST) {
      databases.push({
        service: 'billing-service',
        type: 'postgresql',
        host: process.env.BILLING_DB_HOST,
        port: process.env.BILLING_DB_PORT || 5432,
        database: process.env.BILLING_DB_NAME || 'billing_db',
        username: process.env.BILLING_DB_USER,
        password: process.env.BILLING_DB_PASSWORD
      });
    }
    
    return databases;
  }

  getStorageConfig() {
    const storage = {
      local: process.env.BACKUP_LOCAL_STORAGE !== 'false',
      compression: process.env.BACKUP_COMPRESSION !== 'false'
    };
    
    // S3 Configuration
    if (process.env.AWS_S3_BUCKET) {
      storage.s3 = {
        bucket: process.env.AWS_S3_BUCKET,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      };
    }
    
    return storage;
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());
    this.app.use(compression());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      credentials: true
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      const stats = this.backupSystem.getBackupStats();
      res.json({
        status: 'healthy',
        service: 'backup-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        stats: {
          totalBackups: stats.totalBackups,
          successRate: stats.successRate,
          lastBackup: stats.lastBackup,
          isActive: stats.isActive
        }
      });
    });
    
    // Backup routes
    this.app.use('/api/backup', backupRoutes);
    
    // Service info
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Automated Backup Service',
        version: '1.0.0',
        description: 'Enterprise backup system for microservices',
        endpoints: {
          health: '/health',
          api: '/api/backup',
          status: '/api/backup/status',
          execute: '/api/backup/execute',
          list: '/api/backup/list'
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
    
    // Error handler
    this.app.use((error, req, res, next) => {
      console.error('Backup Service Error:', error);
      
      res.status(error.status || 500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
    });
  }

  async start() {
    try {
      // Start backup system
      this.backupSystem.start();
      
      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log(`🔄 Backup Service running on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔧 API endpoint: http://localhost:${this.port}/api/backup`);
      });
      
      // Graceful shutdown handlers
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
      
    } catch (error) {
      console.error('Failed to start Backup Service:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('Shutting down Backup Service...');
    
    if (this.backupSystem) {
      this.backupSystem.stop();
    }
    
    if (this.server) {
      this.server.close(() => {
        console.log('Backup Service shutdown complete');
        process.exit(0);
      });
    }
  }
}

// Start service if run directly
if (require.main === module) {
  const service = new BackupService();
  service.start();
}

module.exports = BackupService;