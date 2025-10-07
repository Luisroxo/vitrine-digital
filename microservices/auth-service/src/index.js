require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const { DatabaseConnection, Logger, JWTUtils, ValidationSchemas, ErrorHandler, EventPublisher } = require('../../shared');

class AuthService {
  constructor() {
    this.app = express();
    this.port = process.env.AUTH_SERVICE_PORT || 3001;
    this.logger = new Logger('auth-service');
    this.jwtUtils = new JWTUtils();
    this.eventPublisher = new EventPublisher(process.env.REDIS_URL);
    
    this.setupDatabase();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  async setupDatabase() {
    try {
      this.db = DatabaseConnection.createFromUrl(
        process.env.DATABASE_URL || 'postgresql://postgres:password@auth-db:5432/auth_db'
      );
      
      const isConnected = await DatabaseConnection.testConnection(this.db);
      if (!isConnected) {
        throw new Error('Failed to connect to database');
      }

      // Run migrations on startup
      await DatabaseConnection.runMigrations(this.db);
      
    } catch (error) {
      this.logger.error('Database setup failed', error);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(this.logger.middleware());
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'Auth Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Authentication routes
    this.app.post('/register', 
      ValidationSchemas.createMiddleware(ValidationSchemas.user.register),
      this.register.bind(this)
    );
    
    this.app.post('/login', 
      ValidationSchemas.createMiddleware(ValidationSchemas.user.login),
      this.login.bind(this)
    );
    
    this.app.post('/refresh', this.refresh.bind(this));
    this.app.post('/logout', this.logout.bind(this));
    this.app.post('/reset-password', 
      ValidationSchemas.createMiddleware(ValidationSchemas.user.resetPassword),
      this.resetPassword.bind(this)
    );
    
    // Protected routes
    const authMiddleware = this.jwtUtils.createAuthMiddleware();
    this.app.get('/me', authMiddleware, this.getProfile.bind(this));
    this.app.put('/me', authMiddleware, this.updateProfile.bind(this));
  }

  async register(req, res, next) {
    try {
      const { email, password, role, tenant_id } = req.validated.body;
      
      // Check if user already exists
      const existingUser = await this.db('users').where({ email }).first();
      if (existingUser) {
        throw ErrorHandler.errors.ALREADY_EXISTS('User with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      const [user] = await this.db('users').insert({
        email,
        password_hash: passwordHash,
        role: role || 'user',
        tenant_id
      }).returning(['id', 'email', 'role', 'tenant_id', 'created_at']);

      // Generate tokens
      const accessToken = this.jwtUtils.generateAccessToken(user);
      const refreshToken = this.jwtUtils.generateRefreshToken(user);
      
      // Store session
      await this.db('user_sessions').insert({
        user_id: user.id,
        token_jti: this.jwtUtils.decodeToken(accessToken).payload.jti,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      // Publish user created event
      await this.eventPublisher.publishUserEvent('created', user.id, {
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id
      }, { correlationId: req.correlationId });

      this.logger.logUserAction(user.id, 'register', 'user', { email }, req.correlationId);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.validated.body;
      
      // Find user
      const user = await this.db('users')
        .where({ email, is_active: true })
        .first();
      
      if (!user) {
        throw ErrorHandler.errors.UNAUTHORIZED('Invalid credentials');
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw ErrorHandler.errors.UNAUTHORIZED('Invalid credentials');
      }

      // Generate tokens
      const accessToken = this.jwtUtils.generateAccessToken(user);
      const refreshToken = this.jwtUtils.generateRefreshToken(user);
      
      // Store session
      await this.db('user_sessions').insert({
        user_id: user.id,
        token_jti: this.jwtUtils.decodeToken(accessToken).payload.jti,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      // Update last login
      await this.db('users')
        .where({ id: user.id })
        .update({ last_login_at: new Date() });

      // Publish login event
      await this.eventPublisher.publishUserEvent('login', user.id, {
        email: user.email,
        ip_address: req.ip
      }, { correlationId: req.correlationId });

      this.logger.logUserAction(user.id, 'login', 'user', { email }, req.correlationId);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        throw ErrorHandler.errors.INVALID_TOKEN('Refresh token required');
      }

      // Verify refresh token
      const decoded = this.jwtUtils.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        throw ErrorHandler.errors.INVALID_TOKEN('Invalid token type');
      }

      // Find session
      const session = await this.db('user_sessions')
        .where({ 
          refresh_token: refreshToken,
          is_active: true
        })
        .where('expires_at', '>', new Date())
        .first();

      if (!session) {
        throw ErrorHandler.errors.INVALID_TOKEN('Session not found or expired');
      }

      // Get user
      const user = await this.db('users')
        .where({ id: session.user_id, is_active: true })
        .first();

      if (!user) {
        throw ErrorHandler.errors.UNAUTHORIZED('User not found');
      }

      // Generate new tokens
      const newAccessToken = this.jwtUtils.generateAccessToken(user);
      const newRefreshToken = this.jwtUtils.generateRefreshToken(user);

      // Update session
      await this.db('user_sessions')
        .where({ id: session.id })
        .update({
          token_jti: this.jwtUtils.decodeToken(newAccessToken).payload.jti,
          refresh_token: newRefreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

      res.json({
        message: 'Token refreshed successfully',
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = this.jwtUtils.extractTokenFromHeader(authHeader);
      
      if (token) {
        const decoded = this.jwtUtils.verifyToken(token);
        
        // Deactivate session
        await this.db('user_sessions')
          .where({ token_jti: decoded.jti })
          .update({ is_active: false });

        this.logger.logUserAction(decoded.userId, 'logout', 'user', {}, req.correlationId);
      }

      res.json({ message: 'Logout successful' });

    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await this.db('users')
        .where({ id: req.user.userId })
        .select(['id', 'email', 'role', 'tenant_id', 'created_at', 'last_login_at'])
        .first();

      if (!user) {
        throw ErrorHandler.errors.NOT_FOUND('User');
      }

      res.json({ user });

    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { email } = req.body;
      const userId = req.user.userId;

      // Check if email already exists (for other users)
      if (email) {
        const existingUser = await this.db('users')
          .where({ email })
          .whereNot({ id: userId })
          .first();
        
        if (existingUser) {
          throw ErrorHandler.errors.ALREADY_EXISTS('User with this email');
        }
      }

      // Update user
      const [updatedUser] = await this.db('users')
        .where({ id: userId })
        .update({ email })
        .returning(['id', 'email', 'role', 'tenant_id']);

      // Publish user updated event
      await this.eventPublisher.publishUserEvent('updated', userId, {
        email: updatedUser.email
      }, { correlationId: req.correlationId });

      this.logger.logUserAction(userId, 'update_profile', 'user', { email }, req.correlationId);

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { email } = req.validated.body;
      
      // Find user
      const user = await this.db('users')
        .where({ email, is_active: true })
        .first();

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({
          message: 'If this email exists, a password reset link has been sent',
          code: 'RESET_EMAIL_SENT'
        });
      }

      // Generate reset token (JWT with short expiry)
      const resetToken = this.jwtUtils.generateToken({
        userId: user.id,
        email: user.email,
        type: 'password_reset'
      }, { expiresIn: '15m' });

      // In a real implementation, you would:
      // 1. Store reset token in database with expiry
      // 2. Send email with reset link
      // 3. Implement endpoint to verify token and update password
      
      // For now, we'll just log it (in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Password reset token for ${email}: ${resetToken}`);
      }

      // Publish password reset event
      await this.eventPublisher.publishUserEvent('password_reset_requested', user.id, {
        email: user.email,
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : '[HIDDEN]'
      }, { correlationId: req.correlationId });

      this.logger.logUserAction(user.id, 'password_reset_request', 'user', { email }, req.correlationId);

      res.json({
        message: 'If this email exists, a password reset link has been sent',
        code: 'RESET_EMAIL_SENT',
        ...(process.env.NODE_ENV === 'development' && { 
          debug: {
            resetToken,
            resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
          }
        })
      });

    } catch (error) {
      next(error);
    }
  }

  setupErrorHandling() {
    this.app.use(ErrorHandler.notFoundHandler());
    this.app.use(ErrorHandler.globalHandler());
  }

  async start() {
    try {
      this.app.listen(this.port, () => {
        this.logger.logStartup(this.port, process.env.NODE_ENV);
        console.log(`
🔐 Auth Service started successfully!
📊 Port: ${this.port}
🗄️ Database: Connected
📈 Health: http://localhost:${this.port}/health
        `);
      });

      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
      
    } catch (error) {
      this.logger.error('Failed to start Auth Service', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    this.logger.logShutdown(signal);
    
    if (this.db) {
      await DatabaseConnection.closeConnection(this.db);
    }
    
    if (this.eventPublisher) {
      await this.eventPublisher.close();
    }
    
    process.exit(0);
  }
}

// Start the service
if (require.main === module) {
  const authService = new AuthService();
  authService.start();
}

module.exports = AuthService;