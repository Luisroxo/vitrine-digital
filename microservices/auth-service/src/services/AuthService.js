const { ValidationSchemas, ErrorHandler } = require('../../../shared');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor(db, logger, eventPublisher, jwtUtils) {
    this.db = db;
    this.logger = logger;
    this.eventPublisher = eventPublisher;
    this.jwtUtils = jwtUtils;
  }

  async register(userData, tenantId) {
    const { error, value } = ValidationSchemas.userRegistration.validate(userData);
    if (error) {
      throw ErrorHandler.validationError('Invalid registration data', error.details);
    }

    // Check if user already exists
    const existingUser = await this.db('users')
      .where({ email: value.email, tenant_id: tenantId })
      .first();

    if (existingUser) {
      throw ErrorHandler.conflictError('User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 12);

    const trx = await this.db.transaction();

    try {
      // Create user
      const [user] = await trx('users')
        .insert({
          ...value,
          password_hash: passwordHash,
          tenant_id: tenantId,
          id: uuidv4(),
          email_verified: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning(['id', 'email', 'first_name', 'last_name', 'role', 'tenant_id', 'created_at']);

      // Assign default permissions based on role
      await this.assignDefaultPermissions(trx, user.id, user.role, tenantId);

      await trx.commit();

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Create session
      await this.createSession(user.id, tokens.refreshToken, {
        ip: userData.ip,
        userAgent: userData.userAgent
      });

      // Publish event
      await this.eventPublisher.publish('user.created', {
        userId: user.id,
        tenantId,
        email: user.email,
        role: user.role
      });

      this.logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        tenantId,
        role: user.role
      });

      return {
        user: this.sanitizeUser(user),
        tokens
      };

    } catch (error) {
      await trx.rollback();
      this.logger.error('Registration failed', {
        error: error.message,
        email: value.email,
        tenantId
      });
      throw error;
    }
  }

  async login(credentials, tenantId, sessionInfo = {}) {
    const { error, value } = ValidationSchemas.userLogin.validate(credentials);
    if (error) {
      throw ErrorHandler.validationError('Invalid login credentials', error.details);
    }

    // Find user in specific tenant
    const user = await this.db('users')
      .where({ 
        email: value.email, 
        tenant_id: tenantId,
        is_active: true 
      })
      .first();

    if (!user) {
      throw ErrorHandler.unauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(value.password, user.password_hash);
    if (!isValidPassword) {
      await this.logFailedLogin(user.id, tenantId, sessionInfo);
      throw ErrorHandler.unauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Create session
    await this.createSession(user.id, tokens.refreshToken, sessionInfo);

    // Update last login
    await this.db('users')
      .where({ id: user.id })
      .update({ 
        last_login: new Date(),
        updated_at: new Date()
      });

    // Get user permissions
    const permissions = await this.getUserPermissions(user.id, tenantId);

    // Publish event
    await this.eventPublisher.publish('user.logged_in', {
      userId: user.id,
      tenantId,
      email: user.email,
      sessionInfo
    });

    this.logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      tenantId
    });

    return {
      user: {
        ...this.sanitizeUser(user),
        permissions
      },
      tokens
    };
  }

  async refreshToken(refreshToken, tenantId) {
    // Verify refresh token
    let payload;
    try {
      payload = await this.jwtUtils.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw ErrorHandler.unauthorizedError('Invalid refresh token');
    }

    // Check if session exists and is valid
    const session = await this.db('user_sessions')
      .where({
        user_id: payload.userId,
        refresh_token: refreshToken,
        is_active: true
      })
      .where('expires_at', '>', new Date())
      .first();

    if (!session) {
      throw ErrorHandler.unauthorizedError('Session expired or invalid');
    }

    // Get user with tenant validation
    const user = await this.db('users')
      .where({ 
        id: payload.userId, 
        tenant_id: tenantId,
        is_active: true 
      })
      .first();

    if (!user) {
      throw ErrorHandler.unauthorizedError('User not found');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Update session with new refresh token
    await this.db('user_sessions')
      .where({ id: session.id })
      .update({
        refresh_token: tokens.refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updated_at: new Date()
      });

    // Get user permissions
    const permissions = await this.getUserPermissions(user.id, tenantId);

    this.logger.info('Token refreshed successfully', {
      userId: user.id,
      tenantId,
      sessionId: session.id
    });

    return {
      user: {
        ...this.sanitizeUser(user),
        permissions
      },
      tokens
    };
  }

  async logout(userId, refreshToken, tenantId) {
    // Deactivate session
    await this.db('user_sessions')
      .where({
        user_id: userId,
        refresh_token: refreshToken,
        is_active: true
      })
      .update({
        is_active: false,
        updated_at: new Date()
      });

    // Publish event
    await this.eventPublisher.publish('user.logged_out', {
      userId,
      tenantId
    });

    this.logger.info('User logged out successfully', {
      userId,
      tenantId
    });
  }

  async getUserPermissions(userId, tenantId) {
    const permissions = await this.db('user_permissions as up')
      .join('permissions as p', 'up.permission_id', 'p.id')
      .where({
        'up.user_id': userId,
        'up.tenant_id': tenantId,
        'up.is_active': true,
        'p.is_active': true
      })
      .select('p.name', 'p.resource', 'p.action', 'p.scope');

    return permissions.map(p => ({
      name: p.name,
      resource: p.resource,
      action: p.action,
      scope: p.scope
    }));
  }

  async assignDefaultPermissions(trx, userId, role, tenantId) {
    // Get default permissions for role
    const defaultPermissions = await trx('role_permissions as rp')
      .join('permissions as p', 'rp.permission_id', 'p.id')
      .where({
        'rp.role': role,
        'rp.is_active': true,
        'p.is_active': true
      })
      .select('p.id');

    if (defaultPermissions.length > 0) {
      const userPermissions = defaultPermissions.map(permission => ({
        id: uuidv4(),
        user_id: userId,
        permission_id: permission.id,
        tenant_id: tenantId,
        granted_by: 'system',
        is_active: true,
        created_at: new Date()
      }));

      await trx('user_permissions').insert(userPermissions);
    }
  }

  async createSession(userId, refreshToken, sessionInfo) {
    await this.db('user_sessions').insert({
      id: uuidv4(),
      user_id: userId,
      refresh_token: refreshToken,
      ip_address: sessionInfo.ip,
      user_agent: sessionInfo.userAgent,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      is_active: true,
      created_at: new Date()
    });
  }

  async logFailedLogin(userId, tenantId, sessionInfo) {
    // Log failed login attempt for security monitoring
    this.logger.warn('Failed login attempt', {
      userId,
      tenantId,
      ip: sessionInfo.ip,
      userAgent: sessionInfo.userAgent
    });
  }

  async generateTokens(user) {
    const accessToken = await this.jwtUtils.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    });

    const refreshToken = await this.jwtUtils.generateRefreshToken({
      userId: user.id,
      tenantId: user.tenant_id
    });

    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // Tenant isolation middleware
  createTenantMiddleware() {
    return (req, res, next) => {
      const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'Missing tenant ID',
          message: 'x-tenant-id header or tenant_id query parameter is required'
        });
      }

      req.tenantId = parseInt(tenantId);
      next();
    };
  }

  // Permission middleware
  createPermissionMiddleware(requiredPermission) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'User must be authenticated'
          });
        }

        const permissions = await this.getUserPermissions(req.user.userId, req.tenantId);
        
        const hasPermission = permissions.some(permission => {
          return this.checkPermission(permission, requiredPermission);
        });

        if (!hasPermission) {
          this.logger.warn('Permission denied', {
            userId: req.user.userId,
            tenantId: req.tenantId,
            requiredPermission,
            userPermissions: permissions.map(p => `${p.resource}:${p.action}`)
          });

          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'You do not have permission to access this resource',
            required: requiredPermission
          });
        }

        req.userPermissions = permissions;
        next();
      } catch (error) {
        this.logger.error('Permission check failed', {
          error: error.message,
          userId: req.user?.userId,
          tenantId: req.tenantId
        });
        
        res.status(500).json({
          error: 'Permission check failed',
          message: 'Internal server error'
        });
      }
    };
  }

  checkPermission(userPermission, requiredPermission) {
    const { resource, action, scope } = requiredPermission;

    // Check resource match (exact or wildcard)
    const resourceMatch = userPermission.resource === '*' || userPermission.resource === resource;
    
    // Check action match (exact or wildcard)  
    const actionMatch = userPermission.action === '*' || userPermission.action === action;

    // Check scope match
    let scopeMatch = true;
    if (scope && userPermission.scope) {
      scopeMatch = userPermission.scope === '*' || userPermission.scope === scope;
    }

    return resourceMatch && actionMatch && scopeMatch;
  }
}

module.exports = AuthService;