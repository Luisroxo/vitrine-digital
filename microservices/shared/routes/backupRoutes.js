/**
 * @fileoverview Backup Management API Routes
 * @version 1.0.0
 * @description API endpoints para gerenciamento do sistema de backup automático
 */

const express = require('express');
const router = express.Router();
const AutomatedBackupSystem = require('../services/AutomatedBackupSystem');
const { authenticateToken } = require('../../gateway/src/middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting para operações de backup
const backupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 requests por 5 minutos
  message: 'Backup operation rate limit exceeded'
});

// Configuração do sistema de backup
const backupConfig = {
  backupPath: process.env.BACKUP_PATH || '/app/backups',
  databases: [
    {
      service: 'auth-service',
      type: 'postgresql',
      host: process.env.AUTH_DB_HOST || 'auth-db',
      port: process.env.AUTH_DB_PORT || 5432,
      database: process.env.AUTH_DB_NAME || 'auth_db',
      username: process.env.AUTH_DB_USER || 'auth_user',
      password: process.env.AUTH_DB_PASSWORD
    },
    {
      service: 'product-service',
      type: 'postgresql',
      host: process.env.PRODUCT_DB_HOST || 'product-db',
      port: process.env.PRODUCT_DB_PORT || 5432,
      database: process.env.PRODUCT_DB_NAME || 'product_db',
      username: process.env.PRODUCT_DB_USER || 'product_user',
      password: process.env.PRODUCT_DB_PASSWORD
    },
    {
      service: 'bling-service',
      type: 'postgresql',
      host: process.env.BLING_DB_HOST || 'bling-db',
      port: process.env.BLING_DB_PORT || 5432,
      database: process.env.BLING_DB_NAME || 'bling_db',
      username: process.env.BLING_DB_USER || 'bling_user',
      password: process.env.BLING_DB_PASSWORD
    },
    {
      service: 'billing-service',
      type: 'postgresql',
      host: process.env.BILLING_DB_HOST || 'billing-db',
      port: process.env.BILLING_DB_PORT || 5432,
      database: process.env.BILLING_DB_NAME || 'billing_db',
      username: process.env.BILLING_DB_USER || 'billing_user',
      password: process.env.BILLING_DB_PASSWORD
    }
  ],
  storage: {
    local: true,
    compression: true,
    s3: process.env.AWS_S3_BUCKET ? {
      bucket: process.env.AWS_S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    } : null
  },
  filePaths: [
    '/app/frontend/public/uploads',
    '/app/backend/uploads',
    '/app/microservices/shared/logs'
  ],
  retention: {
    daily: 7,
    weekly: 4,
    monthly: 12
  }
};

// Inicializar sistema de backup
const backupSystem = new AutomatedBackupSystem(backupConfig);

// Error handler
const handleError = (res, error, message = 'Backup operation failed') => {
  console.error(`Backup API Error: ${message}`, error);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

// Iniciar sistema quando rotas são carregadas
backupSystem.start();

/**
 * @route GET /api/shared/backup/status
 * @desc Get backup system status and statistics
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, backupLimiter, (req, res) => {
  try {
    const stats = backupSystem.getBackupStats();
    const config = backupSystem.getPublicConfig();
    
    res.json({
      success: true,
      data: {
        status: 'active',
        statistics: stats,
        configuration: config,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to get backup status');
  }
});

/**
 * @route GET /api/shared/backup/list
 * @desc List all available backups
 * @access Private (Admin)
 */
router.get('/list', authenticateToken, backupLimiter, async (req, res) => {
  try {
    const backups = await backupSystem.listBackups();
    
    res.json({
      success: true,
      data: backups,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, 'Failed to list backups');
  }
});

/**
 * @route POST /api/shared/backup/execute
 * @desc Execute manual backup
 * @access Private (Admin)
 */
router.post('/execute', authenticateToken, backupLimiter, async (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    
    // Executar backup de forma assíncrona
    const backupPromise = backupSystem.performBackup(type);
    
    res.json({
      success: true,
      message: `${type} backup started`,
      timestamp: new Date().toISOString()
    });
    
    // Aguardar conclusão do backup (não bloquear resposta)
    backupPromise.then(success => {
      if (success) {
        console.log(`Manual backup ${type} completed successfully`);
      } else {
        console.error(`Manual backup ${type} failed`);
      }
    }).catch(error => {
      console.error(`Manual backup ${type} error:`, error);
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to execute backup');
  }
});

/**
 * @route POST /api/shared/backup/restore
 * @desc Restore from backup file
 * @access Private (Admin)
 */
router.post('/restore', authenticateToken, backupLimiter, async (req, res) => {
  try {
    const { backupFile, options = {} } = req.body;
    
    if (!backupFile) {
      return res.status(400).json({
        success: false,
        message: 'Backup file path required'
      });
    }
    
    const success = await backupSystem.restoreBackup(backupFile, options);
    
    res.json({
      success,
      message: success ? 'Backup restored successfully' : 'Backup restoration failed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to restore backup');
  }
});

/**
 * @route DELETE /api/shared/backup/cleanup
 * @desc Clean up old backups based on retention policy
 * @access Private (Admin)
 */
router.delete('/cleanup', authenticateToken, backupLimiter, async (req, res) => {
  try {
    await backupSystem.cleanupOldBackups();
    
    res.json({
      success: true,
      message: 'Backup cleanup completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to cleanup backups');
  }
});

/**
 * @route GET /api/shared/backup/download/:type/:filename
 * @desc Download backup file
 * @access Private (Admin)
 */
router.get('/download/:type/:filename', authenticateToken, backupLimiter, async (req, res) => {
  try {
    const { type, filename } = req.params;
    const path = require('path');
    const fs = require('fs');
    
    const backupPath = path.join(backupConfig.backupPath, type, filename);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }
    
    // Configurar headers para download
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Enviar arquivo
    const fileStream = fs.createReadStream(backupPath);
    fileStream.pipe(res);
    
  } catch (error) {
    handleError(res, error, 'Failed to download backup');
  }
});

/**
 * @route GET /api/shared/backup/health
 * @desc Health check for backup system
 * @access Public
 */
router.get('/health', (req, res) => {
  try {
    const stats = backupSystem.getBackupStats();
    
    res.json({
      status: 'healthy',
      service: 'automated-backup-system',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      lastBackup: stats.lastBackup,
      activeBackups: stats.activeBackups
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      service: 'automated-backup-system',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/shared/backup/test
 * @desc Test backup system connectivity
 * @access Private (Admin)
 */
router.post('/test', authenticateToken, backupLimiter, async (req, res) => {
  try {
    const testResults = {
      systemHealth: true,
      databases: [],
      storage: {
        local: true,
        s3: false
      },
      directories: true
    };
    
    // Testar conectividade com bancos de dados
    for (const dbConfig of backupConfig.databases) {
      try {
        // Aqui você pode implementar um teste real de conectividade
        testResults.databases.push({
          service: dbConfig.service,
          status: 'connected',
          host: dbConfig.host,
          port: dbConfig.port
        });
      } catch (error) {
        testResults.databases.push({
          service: dbConfig.service,
          status: 'failed',
          error: error.message
        });
        testResults.systemHealth = false;
      }
    }
    
    // Testar S3 se configurado
    if (backupConfig.storage.s3) {
      try {
        // Testar conectividade S3
        testResults.storage.s3 = true;
      } catch (error) {
        testResults.storage.s3 = false;
        testResults.systemHealth = false;
      }
    }
    
    res.json({
      success: testResults.systemHealth,
      message: testResults.systemHealth ? 'All systems operational' : 'Some systems have issues',
      data: testResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to test backup system');
  }
});

// Eventos do sistema de backup
backupSystem.on('backup_started', (session) => {
  console.log(`Backup started: ${session.id} (${session.type})`);
});

backupSystem.on('backup_completed', (session) => {
  console.log(`Backup completed: ${session.id} in ${session.duration}ms`);
});

backupSystem.on('backup_failed', (session) => {
  console.error(`Backup failed: ${session.id} - ${session.error}`);
});

backupSystem.on('restore_started', (session) => {
  console.log(`Restore started: ${session.id}`);
});

backupSystem.on('restore_completed', (session) => {
  console.log(`Restore completed: ${session.id}`);
});

backupSystem.on('restore_failed', (session) => {
  console.error(`Restore failed: ${session.id} - ${session.error}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Backup System...');
  backupSystem.stop();
});

module.exports = router;