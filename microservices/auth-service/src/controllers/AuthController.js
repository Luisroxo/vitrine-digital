const AuthService = require('../services/AuthService');
const { JWTUtils, EventPublisher } = require('../../../shared');

class AuthController {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.eventPublisher = new EventPublisher();
    this.jwtUtils = new JWTUtils();
    this.authService = new AuthService(db, logger, this.eventPublisher, this.jwtUtils);
  }

  // POST /auth/register
  async register(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const sessionInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      const result = await this.authService.register({
        ...req.body,
        ip: sessionInfo.ip,
        userAgent: sessionInfo.userAgent
      }, tenantId);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/login  
  async login(req, res, next) {
    try {
      const tenantId = req.tenantId;
      const sessionInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      const result = await this.authService.login(req.body, tenantId, sessionInfo);

      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/refresh
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tenantId = req.tenantId;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Missing refresh token',
          message: 'Refresh token is required'
        });
      }

      const result = await this.authService.refreshToken(refreshToken, tenantId);

      res.json({
        success: true,
        message: 'Token refreshed successfully', 
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/logout
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      await this.authService.logout(userId, refreshToken, tenantId);

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/me
  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      const user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist'
        });
      }

      const permissions = await this.authService.getUserPermissions(userId, tenantId);

      const { password_hash, ...sanitizedUser } = user;

      res.json({
        success: true,
        data: {
          user: sanitizedUser,
          permissions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/reset-password
  async resetPassword(req, res, next) {
    try {
      const { email } = req.body;
      const tenantId = req.tenantId;

      if (!email) {
        return res.status(400).json({
          error: 'Missing email',
          message: 'Email is required'
        });
      }

      // Find user
      const user = await this.db('users')
        .where({ email, tenant_id: tenantId, is_active: true })
        .first();

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({
          success: true,
          message: 'If the email exists, a password reset link will be sent'
        });
      }

      // Generate reset token (in a real app, you'd send this via email)
      const resetToken = await this.jwtUtils.generateResetToken({
        userId: user.id,
        email: user.email,
        tenantId
      });

      // Store reset token (in a real app, you'd store this in database with expiration)
      // For now, just log it
      this.logger.info('Password reset requested', {
        userId: user.id,
        email: user.email,
        tenantId,
        resetToken // In production, don't log sensitive tokens
      });

      // Publish event
      await this.eventPublisher.publish('user.password_reset_requested', {
        userId: user.id,
        email: user.email,
        tenantId,
        resetToken
      });

      res.json({
        success: true,
        message: 'If the email exists, a password reset link will be sent'
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/permissions
  async getUserPermissions(req, res, next) {
    try {
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      const permissions = await this.authService.getUserPermissions(userId, tenantId);

      res.json({
        success: true,
        data: { permissions }
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/sessions
  async getUserSessions(req, res, next) {
    try {
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      const sessions = await this.db('user_sessions')
        .where({ 
          user_id: userId,
          is_active: true 
        })
        .where('expires_at', '>', new Date())
        .select(['id', 'ip_address', 'user_agent', 'created_at', 'expires_at'])
        .orderBy('created_at', 'desc');

      res.json({
        success: true,
        data: { sessions }
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /auth/sessions/:sessionId
  async terminateSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.userId;

      const result = await this.db('user_sessions')
        .where({
          id: sessionId,
          user_id: userId,
          is_active: true
        })
        .update({
          is_active: false,
          updated_at: new Date()
        });

      if (result === 0) {
        return res.status(404).json({
          error: 'Session not found',
          message: 'Session does not exist or already terminated'
        });
      }

      // Publish event
      await this.eventPublisher.publish('user.session_terminated', {
        userId,
        sessionId,
        tenantId: req.tenantId
      });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/validate - Endpoint para validação de token (usado pelo gateway)
  async validateToken(req, res, next) {
    try {
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      // Buscar dados atualizados do usuário
      const user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId, is_active: true })
        .first();

      if (!user) {
        return res.status(401).json({
          error: 'User not found or inactive',
          valid: false
        });
      }

      // Buscar permissões do usuário
      const permissions = await this.authService.getUserPermissions(userId, tenantId);

      const { password_hash, ...sanitizedUser } = user;

      res.json({
        valid: true,
        user: sanitizedUser,
        permissions
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method: Get user by ID
  async getUserById(userId, tenantId) {
    try {
      return await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();
    } catch (error) {
      throw error;
    }
  }

  // Helper method: Get user permissions
  async getUserPermissions(userId, tenantId) {
    try {
      return await this.authService.getUserPermissions(userId, tenantId);
    } catch (error) {
      throw error;
    }
  }

  // Middleware methods
  tenantMiddleware() {
    return this.authService.createTenantMiddleware();
  }

  permissionMiddleware(requiredPermission) {
    return this.authService.createPermissionMiddleware(requiredPermission);
  }
}

module.exports = AuthController;