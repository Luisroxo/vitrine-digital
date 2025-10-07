/**
 * @fileoverview Automated Backup System
 * @version 1.0.0
 * @description Sistema automático de backup para dados críticos dos microserviços
 * Inclui backup de banco de dados, configurações e assets com rotação inteligente
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const cron = require('node-cron');
const AWS = require('aws-sdk');
const { EventEmitter } = require('events');
const { Logger } = require('../utils/Logger');

const execAsync = promisify(exec);

/**
 * Sistema de backup automático enterprise-grade
 */
class AutomatedBackupSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Configurações gerais
      backupPath: config.backupPath || '/app/backups',
      retention: {
        daily: config.retention?.daily || 7,   // 7 dias
        weekly: config.retention?.weekly || 4, // 4 semanas
        monthly: config.retention?.monthly || 12 // 12 meses
      },
      
      // Configurações de banco de dados
      databases: config.databases || [],
      
      // Configurações de armazenamento
      storage: {
        local: config.storage?.local !== false,
        s3: config.storage?.s3 || null,
        compression: config.storage?.compression !== false
      },
      
      // Configurações de agendamento
      schedule: {
        daily: config.schedule?.daily || '0 2 * * *',     // 2:00 AM daily
        weekly: config.schedule?.weekly || '0 3 * * 0',   // 3:00 AM Sunday
        monthly: config.schedule?.monthly || '0 4 1 * *'  // 4:00 AM 1st of month
      },
      
      // Notificações
      notifications: config.notifications || {},
      
      // Retry configuration
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000
    };
    
    this.logger = new Logger('BackupSystem');
    this.s3Client = null;
    this.backupStats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackup: null,
      totalSize: 0
    };
    
    this.activeBackups = new Set();
    
    this.initializeS3();
    this.setupDirectories();
  }

  /**
   * Inicializa cliente S3 se configurado
   */
  initializeS3() {
    if (this.config.storage.s3) {
      this.s3Client = new AWS.S3({
        accessKeyId: this.config.storage.s3.accessKeyId,
        secretAccessKey: this.config.storage.s3.secretAccessKey,
        region: this.config.storage.s3.region
      });
      
      this.logger.info('S3 client initialized for backup storage');
    }
  }

  /**
   * Configura diretórios de backup
   */
  async setupDirectories() {
    const directories = [
      this.config.backupPath,
      path.join(this.config.backupPath, 'daily'),
      path.join(this.config.backupPath, 'weekly'),
      path.join(this.config.backupPath, 'monthly'),
      path.join(this.config.backupPath, 'temp')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.error(`Failed to create backup directory: ${dir}`, error);
      }
    }
  }

  /**
   * Inicia o sistema de backup
   */
  start() {
    this.logger.info('Starting Automated Backup System');
    
    // Agendar backups
    this.scheduleBackups();
    
    // Executar limpeza inicial
    this.cleanupOldBackups();
    
    this.emit('system_started', {
      timestamp: new Date().toISOString(),
      config: this.getPublicConfig()
    });
    
    this.logger.info('Backup system started successfully');
  }

  /**
   * Para o sistema de backup
   */
  stop() {
    this.logger.info('Stopping Automated Backup System');
    
    // Parar todos os cron jobs
    cron.getTasks().forEach(task => task.stop());
    
    this.emit('system_stopped', {
      timestamp: new Date().toISOString(),
      stats: this.backupStats
    });
    
    this.logger.info('Backup system stopped');
  }

  /**
   * Agenda backups automáticos
   */
  scheduleBackups() {
    // Backup diário
    cron.schedule(this.config.schedule.daily, async () => {
      await this.performBackup('daily');
    });

    // Backup semanal
    cron.schedule(this.config.schedule.weekly, async () => {
      await this.performBackup('weekly');
    });

    // Backup mensal
    cron.schedule(this.config.schedule.monthly, async () => {
      await this.performBackup('monthly');
    });

    this.logger.info('Backup schedules configured', {
      daily: this.config.schedule.daily,
      weekly: this.config.schedule.weekly,
      monthly: this.config.schedule.monthly
    });
  }

  /**
   * Executa backup baseado no tipo
   */
  async performBackup(type = 'manual') {
    const backupSession = {
      id: `backup_${type}_${Date.now()}`,
      type,
      startTime: Date.now(),
      status: 'in_progress'
    };

    if (this.activeBackups.has(type)) {
      this.logger.warn(`Backup ${type} already in progress, skipping`);
      return false;
    }

    this.activeBackups.add(type);
    this.logger.info(`Starting ${type} backup`, { sessionId: backupSession.id });

    try {
      // Emitir evento de início
      this.emit('backup_started', backupSession);

      // Executar backup de banco de dados
      const dbBackups = await this.backupDatabases(backupSession);
      
      // Executar backup de arquivos
      const fileBackups = await this.backupFiles(backupSession);
      
      // Executar backup de configurações
      const configBackups = await this.backupConfigurations(backupSession);

      // Comprimir backups se configurado
      let finalBackupPath = null;
      if (this.config.storage.compression) {
        finalBackupPath = await this.compressBackups(backupSession, {
          databases: dbBackups,
          files: fileBackups,
          configs: configBackups
        });
      }

      // Upload para S3 se configurado
      if (this.s3Client && finalBackupPath) {
        await this.uploadToS3(finalBackupPath, backupSession);
      }

      // Atualizar estatísticas
      backupSession.status = 'completed';
      backupSession.endTime = Date.now();
      backupSession.duration = backupSession.endTime - backupSession.startTime;
      
      this.updateStats(backupSession, true);
      
      // Emitir evento de sucesso
      this.emit('backup_completed', backupSession);
      
      this.logger.info(`${type} backup completed successfully`, {
        sessionId: backupSession.id,
        duration: `${backupSession.duration}ms`
      });

      return true;

    } catch (error) {
      backupSession.status = 'failed';
      backupSession.error = error.message;
      backupSession.endTime = Date.now();
      
      this.updateStats(backupSession, false);
      
      // Emitir evento de erro
      this.emit('backup_failed', { ...backupSession, error });
      
      this.logger.error(`${type} backup failed`, error, { sessionId: backupSession.id });
      
      // Tentar novamente se configurado
      if (this.config.retryAttempts > 0) {
        return await this.retryBackup(backupSession);
      }
      
      return false;

    } finally {
      this.activeBackups.delete(type);
    }
  }

  /**
   * Backup de bancos de dados
   */
  async backupDatabases(session) {
    const dbBackups = [];
    
    for (const dbConfig of this.config.databases) {
      try {
        const backupFile = await this.createDatabaseBackup(dbConfig, session);
        dbBackups.push({
          service: dbConfig.service,
          database: dbConfig.database,
          file: backupFile,
          size: await this.getFileSize(backupFile)
        });
        
        this.logger.info(`Database backup created: ${dbConfig.service}/${dbConfig.database}`);
        
      } catch (error) {
        this.logger.error(`Failed to backup database: ${dbConfig.service}/${dbConfig.database}`, error);
        throw error;
      }
    }
    
    return dbBackups;
  }

  /**
   * Cria backup de um banco de dados específico
   */
  async createDatabaseBackup(dbConfig, session) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${dbConfig.service}_${dbConfig.database}_${timestamp}.sql`;
    const backupPath = path.join(this.config.backupPath, 'temp', backupFileName);
    
    let command;
    
    if (dbConfig.type === 'postgresql') {
      command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} > ${backupPath}`;
    } else if (dbConfig.type === 'mysql') {
      command = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.username} -p${dbConfig.password} ${dbConfig.database} > ${backupPath}`;
    } else {
      throw new Error(`Unsupported database type: ${dbConfig.type}`);
    }
    
    // Executar comando de backup
    await execAsync(command, {
      env: {
        ...process.env,
        PGPASSWORD: dbConfig.password
      }
    });
    
    return backupPath;
  }

  /**
   * Backup de arquivos importantes
   */
  async backupFiles(session) {
    const fileBackups = [];
    
    if (this.config.filePaths) {
      for (const filePath of this.config.filePaths) {
        try {
          const backupFile = await this.createFileBackup(filePath, session);
          fileBackups.push({
            source: filePath,
            backup: backupFile,
            size: await this.getFileSize(backupFile)
          });
          
        } catch (error) {
          this.logger.error(`Failed to backup files: ${filePath}`, error);
        }
      }
    }
    
    return fileBackups;
  }

  /**
   * Backup de configurações dos serviços
   */
  async backupConfigurations(session) {
    const configBackups = [];
    
    // Backup de .env files
    const envFiles = [
      '/app/.env',
      '/app/backend/.env',
      '/app/microservices/auth-service/.env',
      '/app/microservices/product-service/.env',
      '/app/microservices/bling-service/.env',
      '/app/microservices/billing-service/.env'
    ];
    
    for (const envFile of envFiles) {
      try {
        const exists = await fs.access(envFile).then(() => true).catch(() => false);
        if (exists) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(
            this.config.backupPath, 
            'temp', 
            `env_${path.basename(path.dirname(envFile))}_${timestamp}.env`
          );
          
          await fs.copyFile(envFile, backupFile);
          configBackups.push({
            source: envFile,
            backup: backupFile,
            size: await this.getFileSize(backupFile)
          });
        }
      } catch (error) {
        this.logger.warn(`Could not backup env file: ${envFile}`, error);
      }
    }
    
    return configBackups;
  }

  /**
   * Comprime todos os backups em um arquivo
   */
  async compressBackups(session, backups) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `backup_${session.type}_${timestamp}.tar.gz`;
    const archivePath = path.join(this.config.backupPath, session.type, archiveName);
    
    // Criar lista de arquivos para comprimir
    const filesToCompress = [];
    
    if (backups.databases) {
      filesToCompress.push(...backups.databases.map(db => db.file));
    }
    if (backups.files) {
      filesToCompress.push(...backups.files.map(file => file.backup));
    }
    if (backups.configs) {
      filesToCompress.push(...backups.configs.map(config => config.backup));
    }
    
    if (filesToCompress.length === 0) {
      throw new Error('No files to compress');
    }
    
    // Comprimir arquivos
    const command = `tar -czf ${archivePath} -C ${path.join(this.config.backupPath, 'temp')} ${filesToCompress.map(f => path.basename(f)).join(' ')}`;
    await execAsync(command);
    
    // Limpar arquivos temporários
    for (const file of filesToCompress) {
      try {
        await fs.unlink(file);
      } catch (error) {
        this.logger.warn(`Could not delete temp file: ${file}`, error);
      }
    }
    
    session.backupFile = archivePath;
    session.backupSize = await this.getFileSize(archivePath);
    
    this.logger.info(`Backup compressed: ${archiveName}`, {
      size: this.formatFileSize(session.backupSize)
    });
    
    return archivePath;
  }

  /**
   * Upload para S3
   */
  async uploadToS3(filePath, session) {
    if (!this.s3Client) return;
    
    const fileName = path.basename(filePath);
    const s3Key = `backups/${session.type}/${fileName}`;
    
    const fileContent = await fs.readFile(filePath);
    
    const uploadParams = {
      Bucket: this.config.storage.s3.bucket,
      Key: s3Key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'backup-type': session.type,
        'session-id': session.id,
        'created-at': new Date().toISOString()
      }
    };
    
    const result = await this.s3Client.upload(uploadParams).promise();
    
    session.s3Location = result.Location;
    session.s3Key = s3Key;
    
    this.logger.info(`Backup uploaded to S3: ${s3Key}`);
  }

  /**
   * Retry backup em caso de falha
   */
  async retryBackup(session, attempt = 1) {
    if (attempt > this.config.retryAttempts) {
      this.logger.error(`Backup retry limit exceeded for ${session.type}`);
      return false;
    }
    
    this.logger.info(`Retrying backup ${session.type}, attempt ${attempt}`);
    
    // Aguardar antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
    
    try {
      return await this.performBackup(session.type);
    } catch (error) {
      return await this.retryBackup(session, attempt + 1);
    }
  }

  /**
   * Limpa backups antigos baseado na política de retenção
   */
  async cleanupOldBackups() {
    const retentionPolicies = [
      { type: 'daily', days: this.config.retention.daily },
      { type: 'weekly', days: this.config.retention.weekly * 7 },
      { type: 'monthly', days: this.config.retention.monthly * 30 }
    ];
    
    for (const policy of retentionPolicies) {
      try {
        await this.cleanupBackupType(policy.type, policy.days);
      } catch (error) {
        this.logger.error(`Failed to cleanup ${policy.type} backups`, error);
      }
    }
  }

  /**
   * Limpa backups de um tipo específico
   */
  async cleanupBackupType(type, retentionDays) {
    const backupDir = path.join(this.config.backupPath, type);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    try {
      const files = await fs.readdir(backupDir);
      
      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          this.logger.info(`Deleted old backup: ${file}`);
        }
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Atualiza estatísticas de backup
   */
  updateStats(session, success) {
    this.backupStats.totalBackups++;
    
    if (success) {
      this.backupStats.successfulBackups++;
      this.backupStats.lastBackup = new Date().toISOString();
      if (session.backupSize) {
        this.backupStats.totalSize += session.backupSize;
      }
    } else {
      this.backupStats.failedBackups++;
    }
  }

  /**
   * Execução manual de backup
   */
  async executeManualBackup() {
    return await this.performBackup('manual');
  }

  /**
   * Restaura backup a partir de arquivo
   */
  async restoreBackup(backupFile, options = {}) {
    this.logger.info(`Starting backup restoration from: ${backupFile}`);
    
    const restoreSession = {
      id: `restore_${Date.now()}`,
      backupFile,
      startTime: Date.now(),
      status: 'in_progress'
    };
    
    try {
      // Emitir evento de início
      this.emit('restore_started', restoreSession);
      
      // Extrair backup se necessário
      let extractedFiles = [];
      if (backupFile.endsWith('.tar.gz')) {
        extractedFiles = await this.extractBackup(backupFile);
      }
      
      // Restaurar bancos de dados
      if (options.restoreDatabases !== false) {
        await this.restoreDatabases(extractedFiles);
      }
      
      // Restaurar arquivos
      if (options.restoreFiles !== false) {
        await this.restoreFiles(extractedFiles);
      }
      
      restoreSession.status = 'completed';
      restoreSession.endTime = Date.now();
      
      this.emit('restore_completed', restoreSession);
      this.logger.info('Backup restoration completed successfully');
      
      return true;
      
    } catch (error) {
      restoreSession.status = 'failed';
      restoreSession.error = error.message;
      restoreSession.endTime = Date.now();
      
      this.emit('restore_failed', { ...restoreSession, error });
      this.logger.error('Backup restoration failed', error);
      
      return false;
    }
  }

  /**
   * Extrai arquivo de backup comprimido
   */
  async extractBackup(backupFile) {
    const extractDir = path.join(this.config.backupPath, 'temp', `extract_${Date.now()}`);
    await fs.mkdir(extractDir, { recursive: true });
    
    const command = `tar -xzf ${backupFile} -C ${extractDir}`;
    await execAsync(command);
    
    const files = await fs.readdir(extractDir);
    return files.map(file => path.join(extractDir, file));
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups() {
    const backupTypes = ['daily', 'weekly', 'monthly', 'manual'];
    const backupsList = {};
    
    for (const type of backupTypes) {
      const backupDir = path.join(this.config.backupPath, type);
      
      try {
        const files = await fs.readdir(backupDir);
        const backups = [];
        
        for (const file of files) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
            type
          });
        }
        
        backupsList[type] = backups.sort((a, b) => b.created - a.created);
        
      } catch (error) {
        backupsList[type] = [];
      }
    }
    
    return backupsList;
  }

  /**
   * Obtém estatísticas do sistema de backup
   */
  getBackupStats() {
    return {
      ...this.backupStats,
      totalSizeFormatted: this.formatFileSize(this.backupStats.totalSize),
      successRate: this.backupStats.totalBackups > 0 
        ? ((this.backupStats.successfulBackups / this.backupStats.totalBackups) * 100).toFixed(2) + '%'
        : '0%',
      isActive: this.activeBackups.size > 0,
      activeBackups: Array.from(this.activeBackups)
    };
  }

  /**
   * Obtém configuração pública (sem credenciais)
   */
  getPublicConfig() {
    return {
      backupPath: this.config.backupPath,
      retention: this.config.retention,
      schedule: this.config.schedule,
      storage: {
        local: this.config.storage.local,
        s3: !!this.config.storage.s3,
        compression: this.config.storage.compression
      },
      databaseCount: this.config.databases.length
    };
  }

  /**
   * Utilitários
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async createFileBackup(sourcePath, session) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `files_${path.basename(sourcePath)}_${timestamp}.tar.gz`;
    const backupPath = path.join(this.config.backupPath, 'temp', backupFileName);
    
    const command = `tar -czf ${backupPath} -C ${path.dirname(sourcePath)} ${path.basename(sourcePath)}`;
    await execAsync(command);
    
    return backupPath;
  }

  async restoreDatabases(extractedFiles) {
    // Implementar restauração de banco de dados
    this.logger.info('Database restoration not implemented yet');
  }

  async restoreFiles(extractedFiles) {
    // Implementar restauração de arquivos
    this.logger.info('File restoration not implemented yet');
  }
}

module.exports = AutomatedBackupSystem;