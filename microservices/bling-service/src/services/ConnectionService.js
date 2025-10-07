const db = require('../database/connection');
const crypto = require('crypto');
const BlingAPI = require('./BlingAPI');
const { Logger } = require('../../shared');

class ConnectionService {
  constructor() {
    this.logger = new Logger('connection-service');
    this.blingAPI = new BlingAPI();
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';
  }

  // Encrypt sensitive data
  encrypt(text) {
    if (!text) return null;
    
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt sensitive data
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', { error: error.message });
      return null;
    }
  }

  // Create new Bling connection
  async createConnection(tenantId, clientId, clientSecret) {
    try {
      const existingConnection = await db('bling_connections')
        .where({ tenant_id: tenantId, client_id: clientId })
        .first();

      if (existingConnection) {
        throw new Error('Connection already exists for this tenant and client');
      }

      const connection = await db('bling_connections')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          client_secret_encrypted: this.encrypt(clientSecret),
          status: 'pending'
        })
        .returning('*');

      this.logger.info('Bling connection created', {
        tenantId,
        connectionId: connection[0].id
      });

      return connection[0];
    } catch (error) {
      this.logger.error('Error creating Bling connection', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  // Get connection by ID
  async getConnection(connectionId) {
    try {
      const connection = await db('bling_connections')
        .where({ id: connectionId })
        .first();

      if (!connection) {
        throw new Error('Connection not found');
      }

      return connection;
    } catch (error) {
      this.logger.error('Error getting connection', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  // Get active connection for tenant
  async getActiveConnection(tenantId) {
    try {
      const connection = await db('bling_connections')
        .where({ 
          tenant_id: tenantId,
          status: 'active'
        })
        .first();

      return connection;
    } catch (error) {
      this.logger.error('Error getting active connection', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  // Get all connections for tenant
  async getConnections(tenantId) {
    try {
      const connections = await db('bling_connections')
        .where({ tenant_id: tenantId })
        .orderBy('created_at', 'desc');

      return connections;
    } catch (error) {
      this.logger.error('Error getting connections', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  // Exchange authorization code for tokens
  async exchangeAuthCode(connectionId, code) {
    try {
      const connection = await this.getConnection(connectionId);
      
      if (connection.status !== 'pending') {
        throw new Error('Connection is not in pending state');
      }

      // Exchange code for tokens
      const tokenData = await this.blingAPI.exchangeCodeForToken(code, connection.tenant_id);
      
      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Update connection with tokens
      await db('bling_connections')
        .where({ id: connectionId })
        .update({
          access_token_encrypted: this.encrypt(tokenData.access_token),
          refresh_token_encrypted: this.encrypt(tokenData.refresh_token),
          token_expires_at: expiresAt,
          scopes: tokenData.scope ? tokenData.scope.split(' ') : null,
          status: 'active',
          error_count: 0,
          updated_at: new Date()
        });

      this.logger.info('Authorization code exchanged successfully', {
        connectionId,
        tenantId: connection.tenant_id,
        expiresAt
      });

      return { success: true, expiresAt };
    } catch (error) {
      // Update connection status to failed
      await db('bling_connections')
        .where({ id: connectionId })
        .update({
          status: 'failed',
          sync_errors: [{ error: error.message, timestamp: new Date() }],
          updated_at: new Date()
        });

      this.logger.error('Error exchanging authorization code', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(connection) {
    try {
      const now = new Date();
      const expiresAt = new Date(connection.token_expires_at);

      // Check if token is still valid (with 5 minute buffer)
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (expiresAt.getTime() - now.getTime() > bufferTime) {
        // Token is still valid
        return this.decrypt(connection.access_token_encrypted);
      }

      // Need to refresh token
      this.logger.info('Refreshing access token', {
        connectionId: connection.id,
        tenantId: connection.tenant_id
      });

      const refreshToken = this.decrypt(connection.refresh_token_encrypted);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const tokenData = await this.blingAPI.refreshToken(refreshToken, connection.tenant_id);
      
      // Calculate new expiration
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

      // Update connection with new tokens
      await db('bling_connections')
        .where({ id: connection.id })
        .update({
          access_token_encrypted: this.encrypt(tokenData.access_token),
          refresh_token_encrypted: this.encrypt(tokenData.refresh_token),
          token_expires_at: newExpiresAt,
          updated_at: new Date()
        });

      this.logger.info('Access token refreshed successfully', {
        connectionId: connection.id,
        tenantId: connection.tenant_id,
        newExpiresAt
      });

      return tokenData.access_token;
    } catch (error) {
      // Mark connection as expired
      await db('bling_connections')
        .where({ id: connection.id })
        .update({
          status: 'expired',
          sync_errors: [{ error: error.message, timestamp: new Date() }],
          updated_at: new Date()
        });

      this.logger.error('Error getting valid access token', {
        connectionId: connection.id,
        tenantId: connection.tenant_id,
        error: error.message
      });
      throw error;
    }
  }

  // Update sync status
  async updateSyncStatus(connectionId, updateData) {
    try {
      await db('bling_connections')
        .where({ id: connectionId })
        .update({
          ...updateData,
          updated_at: new Date()
        });

      this.logger.debug('Sync status updated', {
        connectionId,
        updateData
      });
    } catch (error) {
      this.logger.error('Error updating sync status', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  // Increment error count
  async incrementErrorCount(connectionId) {
    try {
      const connection = await this.getConnection(connectionId);
      const newErrorCount = (connection.error_count || 0) + 1;
      
      // If too many errors, mark as failed
      const maxErrors = 10;
      const status = newErrorCount >= maxErrors ? 'failed' : connection.status;

      await db('bling_connections')
        .where({ id: connectionId })
        .update({
          error_count: newErrorCount,
          status,
          updated_at: new Date()
        });

      if (status === 'failed') {
        this.logger.warn('Connection marked as failed due to too many errors', {
          connectionId,
          errorCount: newErrorCount
        });
      }
    } catch (error) {
      this.logger.error('Error incrementing error count', {
        connectionId,
        error: error.message
      });
    }
  }

  // Revoke connection
  async revokeConnection(connectionId) {
    try {
      await db('bling_connections')
        .where({ id: connectionId })
        .update({
          status: 'revoked',
          access_token_encrypted: null,
          refresh_token_encrypted: null,
          token_expires_at: null,
          updated_at: new Date()
        });

      this.logger.info('Connection revoked', { connectionId });
      return { success: true };
    } catch (error) {
      this.logger.error('Error revoking connection', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  // Delete connection
  async deleteConnection(connectionId) {
    try {
      // First revoke the connection
      await this.revokeConnection(connectionId);
      
      // Then delete related data
      await db.transaction(async (trx) => {
        // Delete webhook events
        await trx('webhook_events')
          .where({ connection_id: connectionId })
          .del();

        // Delete sync jobs
        await trx('sync_jobs')
          .where({ connection_id: connectionId })
          .del();

        // Delete connection
        await trx('bling_connections')
          .where({ id: connectionId })
          .del();
      });

      this.logger.info('Connection deleted', { connectionId });
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting connection', {
        connectionId,
        error: error.message
      });
      throw error;
    }
  }

  // Get connection statistics
  async getConnectionStats(tenantId) {
    try {
      const stats = await db('bling_connections')
        .where({ tenant_id: tenantId })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN status = 'active' THEN 1 END) as active"),
          db.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending"),
          db.raw("COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired"),
          db.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed"),
          db.raw("COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked")
        )
        .first();

      // Get recent sync jobs
      const recentSyncs = await db('sync_jobs')
        .join('bling_connections', 'sync_jobs.connection_id', 'bling_connections.id')
        .where('bling_connections.tenant_id', tenantId)
        .select(
          'sync_jobs.id',
          'sync_jobs.job_type',
          'sync_jobs.status',
          'sync_jobs.started_at',
          'sync_jobs.completed_at'
        )
        .orderBy('sync_jobs.created_at', 'desc')
        .limit(10);

      return {
        connections: stats,
        recentSyncs
      };
    } catch (error) {
      this.logger.error('Error getting connection stats', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  // Test connection
  async testConnection(connectionId) {
    try {
      const connection = await this.getConnection(connectionId);
      
      if (connection.status !== 'active') {
        throw new Error('Connection is not active');
      }

      const accessToken = await this.getValidAccessToken(connection);
      
      // Make a simple API call to test the connection
      await this.blingAPI.getProducts(accessToken, 1, 1);
      
      this.logger.info('Connection test successful', {
        connectionId,
        tenantId: connection.tenant_id
      });

      return { success: true, status: 'connected' };
    } catch (error) {
      this.logger.error('Connection test failed', {
        connectionId,
        error: error.message
      });
      
      return { 
        success: false, 
        status: 'error', 
        error: error.message 
      };
    }
  }
}

module.exports = ConnectionService;