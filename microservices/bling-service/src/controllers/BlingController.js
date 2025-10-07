const BlingAPI = require('../services/BlingAPI');
const ConnectionService = require('../services/ConnectionService');
const SyncService = require('../services/SyncService');
const { Logger } = require('../../shared');

class BlingController {
  constructor() {
    this.blingAPI = new BlingAPI();
    this.connectionService = new ConnectionService();
    this.syncService = new SyncService();
    this.logger = new Logger('bling-controller');
  }

  // Generate OAuth authorization URL
  async getAuthURL(req, res) {
    try {
      const { tenantId } = req.user; // From auth middleware
      const { state } = req.query;

      const authURL = this.blingAPI.generateAuthURL(tenantId, state);

      res.json({
        success: true,
        data: {
          authURL,
          instructions: 'Visit this URL to authorize Bling integration'
        }
      });
    } catch (error) {
      this.logger.error('Error generating auth URL', {
        tenantId: req.user?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
        message: error.message
      });
    }
  }

  // Handle OAuth callback
  async handleCallback(req, res) {
    try {
      const { code, state, error } = req.query;

      if (error) {
        this.logger.warn('OAuth authorization denied', { error });
        return res.status(400).json({
          success: false,
          error: 'Authorization denied',
          message: error
        });
      }

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'Code and state are required'
        });
      }

      // Parse state to get tenant ID and connection ID
      const [tenantId, stateParam] = state.split(':');
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid state parameter'
        });
      }

      // Find pending connection for this tenant
      const connections = await this.connectionService.getConnections(tenantId);
      const pendingConnection = connections.find(conn => conn.status === 'pending');
      
      if (!pendingConnection) {
        return res.status(404).json({
          success: false,
          error: 'No pending connection found for this tenant'
        });
      }

      // Exchange code for tokens
      await this.connectionService.exchangeAuthCode(pendingConnection.id, code);

      res.json({
        success: true,
        message: 'Bling integration authorized successfully',
        data: {
          connectionId: pendingConnection.id
        }
      });
    } catch (error) {
      this.logger.error('Error handling OAuth callback', {
        error: error.message,
        query: req.query
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to complete authorization',
        message: error.message
      });
    }
  }

  // Create new Bling connection
  async createConnection(req, res) {
    try {
      const { tenantId } = req.user;
      const { clientId, clientSecret } = req.body;

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'Client ID and Client Secret are required'
        });
      }

      const connection = await this.connectionService.createConnection(
        tenantId,
        clientId,
        clientSecret
      );

      // Generate authorization URL
      const authURL = this.blingAPI.generateAuthURL(tenantId);

      res.status(201).json({
        success: true,
        data: {
          connection: {
            id: connection.id,
            status: connection.status,
            createdAt: connection.created_at
          },
          authURL,
          message: 'Connection created. Please visit the authorization URL to complete setup.'
        }
      });
    } catch (error) {
      this.logger.error('Error creating connection', {
        tenantId: req.user?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to create connection',
        message: error.message
      });
    }
  }

  // Get connections
  async getConnections(req, res) {
    try {
      const { tenantId } = req.user;
      const connections = await this.connectionService.getConnections(tenantId);

      // Remove sensitive data
      const sanitizedConnections = connections.map(conn => ({
        id: conn.id,
        clientId: conn.client_id,
        status: conn.status,
        lastSyncAt: conn.last_sync_at,
        errorCount: conn.error_count,
        createdAt: conn.created_at,
        updatedAt: conn.updated_at
      }));

      res.json({
        success: true,
        data: sanitizedConnections
      });
    } catch (error) {
      this.logger.error('Error getting connections', {
        tenantId: req.user?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get connections',
        message: error.message
      });
    }
  }

  // Get connection details
  async getConnection(req, res) {
    try {
      const { tenantId } = req.user;
      const { connectionId } = req.params;

      const connection = await this.connectionService.getConnection(connectionId);
      
      // Verify ownership
      if (connection.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          id: connection.id,
          clientId: connection.client_id,
          status: connection.status,
          scopes: connection.scopes,
          lastSyncAt: connection.last_sync_at,
          syncErrors: connection.sync_errors,
          errorCount: connection.error_count,
          tokenExpiresAt: connection.token_expires_at,
          createdAt: connection.created_at,
          updatedAt: connection.updated_at
        }
      });
    } catch (error) {
      this.logger.error('Error getting connection', {
        tenantId: req.user?.tenantId,
        connectionId: req.params?.connectionId,
        error: error.message
      });
      
      res.status(404).json({
        success: false,
        error: 'Connection not found',
        message: error.message
      });
    }
  }

  // Test connection
  async testConnection(req, res) {
    try {
      const { tenantId } = req.user;
      const { connectionId } = req.params;

      const connection = await this.connectionService.getConnection(connectionId);
      
      // Verify ownership
      if (connection.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const testResult = await this.connectionService.testConnection(connectionId);

      res.json({
        success: true,
        data: testResult
      });
    } catch (error) {
      this.logger.error('Error testing connection', {
        tenantId: req.user?.tenantId,
        connectionId: req.params?.connectionId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to test connection',
        message: error.message
      });
    }
  }

  // Delete connection
  async deleteConnection(req, res) {
    try {
      const { tenantId } = req.user;
      const { connectionId } = req.params;

      const connection = await this.connectionService.getConnection(connectionId);
      
      // Verify ownership
      if (connection.tenant_id !== tenantId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      await this.connectionService.deleteConnection(connectionId);

      res.json({
        success: true,
        message: 'Connection deleted successfully'
      });
    } catch (error) {
      this.logger.error('Error deleting connection', {
        tenantId: req.user?.tenantId,
        connectionId: req.params?.connectionId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete connection',
        message: error.message
      });
    }
  }

  // Start sync job
  async startSync(req, res) {
    try {
      const { tenantId } = req.user;
      const { jobType } = req.params;
      const { config = {} } = req.body;

      const validJobTypes = ['products', 'orders', 'inventory', 'contacts'];
      if (!validJobTypes.includes(jobType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid job type',
          validTypes: validJobTypes
        });
      }

      const result = await this.syncService.scheduleSyncJob(tenantId, jobType, config);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error starting sync', {
        tenantId: req.user?.tenantId,
        jobType: req.params?.jobType,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to start sync',
        message: error.message
      });
    }
  }

  // Get sync job status
  async getSyncStatus(req, res) {
    try {
      const { jobId } = req.params;
      const status = await this.syncService.getSyncJobStatus(jobId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      this.logger.error('Error getting sync status', {
        jobId: req.params?.jobId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
        message: error.message
      });
    }
  }

  // Cancel sync job
  async cancelSync(req, res) {
    try {
      const { jobId } = req.params;
      const result = await this.syncService.cancelSyncJob(jobId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error canceling sync', {
        jobId: req.params?.jobId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to cancel sync',
        message: error.message
      });
    }
  }

  // Get sync statistics
  async getSyncStats(req, res) {
    try {
      const { tenantId } = req.user;
      const stats = await this.syncService.getSyncStats(tenantId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Error getting sync stats', {
        tenantId: req.user?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get sync statistics',
        message: error.message
      });
    }
  }

  // Get dashboard data
  async getDashboard(req, res) {
    try {
      const { tenantId } = req.user;
      
      // Get connection stats
      const connectionStats = await this.connectionService.getConnectionStats(tenantId);
      
      // Get sync stats
      const syncStats = await this.syncService.getSyncStats(tenantId);

      res.json({
        success: true,
        data: {
          connections: connectionStats,
          sync: syncStats,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Error getting dashboard data', {
        tenantId: req.user?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard data',
        message: error.message
      });
    }
  }

  // Handle webhooks from Bling
  async handleWebhook(req, res) {
    try {
      const { tenantId } = req.params;
      const payload = req.body;
      
      this.logger.info('Webhook received', {
        tenantId,
        eventType: payload.event_type,
        eventId: payload.event_id
      });

      // TODO: Implement webhook processing logic
      // This would involve:
      // 1. Validating the webhook signature
      // 2. Processing the event based on type
      // 3. Updating local data accordingly
      
      res.status(200).json({
        success: true,
        message: 'Webhook received'
      });
    } catch (error) {
      this.logger.error('Error handling webhook', {
        tenantId: req.params?.tenantId,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }

  // Health check
  async healthCheck(req, res) {
    try {
      // Check database connection
      const db = require('../database/connection');
      await db.raw('SELECT 1');

      // Check Redis connection (for queues)
      // TODO: Add Redis health check

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          redis: 'connected', // TODO: Implement actual check
          bling_api: 'available'
        }
      });
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
}

module.exports = BlingController;