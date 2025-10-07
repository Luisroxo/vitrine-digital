const express = require('express');
const rateLimit = require('express-rate-limit');
const { JWTUtils } = require('../../../shared');

module.exports = (authController) => {
  const router = express.Router();
  const jwtUtils = new JWTUtils();

  // Rate limiting for sensitive endpoints
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { 
      error: 'Too many attempts', 
      message: 'Please wait before trying again' 
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Tenant middleware - required for all routes
  const tenantMiddleware = authController.tenantMiddleware();

  // Authentication middleware
  const authMiddleware = jwtUtils.createAuthMiddleware();

  // Public routes (no auth required, but tenant required)
  
  // POST /auth/register
  router.post('/register', 
    tenantMiddleware,
    strictLimiter,
    authController.register.bind(authController)
  );

  // POST /auth/login  
  router.post('/login', 
    tenantMiddleware,
    strictLimiter,
    authController.login.bind(authController)
  );

  // POST /auth/refresh
  router.post('/refresh', 
    tenantMiddleware,
    authController.refreshToken.bind(authController)
  );

  // POST /auth/reset-password
  router.post('/reset-password', 
    tenantMiddleware,
    strictLimiter,
    authController.resetPassword.bind(authController)
  );

  // Protected routes (auth required)

  // GET /auth/me
  router.get('/me', 
    tenantMiddleware,
    authMiddleware,
    authController.getCurrentUser.bind(authController)
  );

  // POST /auth/logout
  router.post('/logout', 
    tenantMiddleware,
    authMiddleware,
    authController.logout.bind(authController)
  );

  // POST /auth/validate - Endpoint para Gateway validar tokens
  router.post('/validate',
    tenantMiddleware,
    authMiddleware,
    authController.validateToken.bind(authController)
  );

  // GET /auth/permissions
  router.get('/permissions', 
    tenantMiddleware,
    authMiddleware,
    authController.getUserPermissions.bind(authController)
  );

  // GET /auth/sessions
  router.get('/sessions', 
    tenantMiddleware,
    authMiddleware,
    authController.getUserSessions.bind(authController)
  );

  // DELETE /auth/sessions/:sessionId
  router.delete('/sessions/:sessionId', 
    tenantMiddleware,
    authMiddleware,
    authController.terminateSession.bind(authController)
  );

  // Admin routes (require admin role and specific permissions)

  // Permission-based routes examples
  router.get('/admin/users',
    tenantMiddleware,
    authMiddleware,
    authController.permissionMiddleware({
      resource: 'users',
      action: 'read',
      scope: 'tenant'
    }),
    async (req, res) => {
      // Admin can list users in their tenant
      const users = await req.db('users')
        .where({ tenant_id: req.tenantId, is_active: true })
        .select(['id', 'email', 'first_name', 'last_name', 'role', 'created_at', 'last_login']);

      res.json({
        success: true,
        data: { users }
      });
    }
  );

  router.post('/admin/users/:userId/permissions',
    tenantMiddleware,
    authMiddleware,
    authController.permissionMiddleware({
      resource: 'permissions',
      action: 'write',
      scope: 'tenant'
    }),
    async (req, res) => {
      // Admin can manage user permissions
      const { userId } = req.params;
      const { permissionId, action } = req.body; // action: 'grant' or 'revoke'

      if (!['grant', 'revoke'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'Action must be "grant" or "revoke"'
        });
      }

      try {
        if (action === 'grant') {
          await req.db('user_permissions').insert({
            id: require('crypto').randomUUID(),
            user_id: userId,
            permission_id: permissionId,
            tenant_id: req.tenantId,
            granted_by: req.user.userId,
            is_active: true,
            created_at: new Date()
          });
        } else {
          await req.db('user_permissions')
            .where({
              user_id: userId,
              permission_id: permissionId,
              tenant_id: req.tenantId
            })
            .update({
              is_active: false,
              revoked_by: req.user.userId,
              updated_at: new Date()
            });
        }

        // Publish permission change event
        await authController.eventPublisher.publish('user.permission.changed', {
          userId,
          tenantId: req.tenantId,
          permissionId,
          action,
          changedBy: req.user.userId
        });

        res.json({
          success: true,
          message: `Permission ${action}ed successfully`
        });

      } catch (error) {
        res.status(500).json({
          error: 'Permission update failed',
          message: error.message
        });
      }
    }
  );

  // System admin routes (require system-wide permissions)
  router.get('/system/health',
    authMiddleware,
    authController.permissionMiddleware({
      resource: 'system',
      action: 'read',
      scope: '*'
    }),
    async (req, res) => {
      // System admin can check system health
      const activeUsers = await req.db('users').where({ is_active: true }).count('* as count');
      const activeSessions = await req.db('user_sessions')
        .where({ is_active: true })
        .where('expires_at', '>', new Date())
        .count('* as count');

      res.json({
        success: true,
        data: {
          system: 'healthy',
          stats: {
            activeUsers: parseInt(activeUsers[0].count),
            activeSessions: parseInt(activeSessions[0].count),
            uptime: Math.floor(process.uptime())
          }
        }
      });
    }
  );

  return router;
};