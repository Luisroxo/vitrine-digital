const jwt = require('jsonwebtoken');

/**
 * JWT Utility Functions
 * Standardized JWT operations across all microservices
 */
class JWTUtils {
  constructor(secret = process.env.JWT_SECRET || 'default-secret') {
    this.secret = secret;
    this.defaultOptions = {
      expiresIn: '24h',
      issuer: 'vitrine-digital',
      algorithm: 'HS256'
    };
  }

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {Object} options - JWT options (optional)
   * @returns {string} JWT token
   */
  generateToken(payload, options = {}) {
    const tokenOptions = { ...this.defaultOptions, ...options };
    
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateTokenId()
    };

    return jwt.sign(tokenPayload, this.secret, tokenOptions);
  }

  /**
   * Generate access token
   * @param {Object} user - User object
   * @param {Object} options - Token options
   */
  generateAccessToken(user, options = {}) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      type: 'access'
    };

    return this.generateToken(payload, {
      expiresIn: '1h',
      ...options
    });
  }

  /**
   * Generate refresh token
   * @param {Object} user - User object
   * @param {Object} options - Token options
   */
  generateRefreshToken(user, options = {}) {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return this.generateToken(payload, {
      expiresIn: '30d',
      ...options
    });
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token
   * @param {Object} options - Verification options
   * @returns {Object} Decoded payload
   */
  verifyToken(token, options = {}) {
    const verifyOptions = {
      issuer: 'vitrine-digital',
      algorithms: ['HS256'],
      ...options
    };

    try {
      return jwt.verify(token, this.secret, verifyOptions);
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {Object} Decoded token
   */
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} JWT token or null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Generate unique token ID
   * @returns {string} Unique token ID
   */
  generateTokenId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create middleware for JWT verification
   * @param {Object} options - Middleware options
   */
  createAuthMiddleware(options = {}) {
    return (req, res, next) => {
      try {
        const token = this.extractTokenFromHeader(req.headers.authorization);
        
        if (!token) {
          return res.status(401).json({
            error: 'Access token required',
            code: 'TOKEN_MISSING'
          });
        }

        const decoded = this.verifyToken(token, options);
        
        // Check token type
        if (decoded.type !== 'access') {
          return res.status(401).json({
            error: 'Invalid token type',
            code: 'INVALID_TOKEN_TYPE'
          });
        }

        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Token verification failed',
          code: 'TOKEN_INVALID',
          details: error.message
        });
      }
    };
  }

  /**
   * Create middleware for role-based access
   * @param {Array} allowedRoles - Array of allowed roles
   */
  createRoleMiddleware(allowedRoles = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'ACCESS_DENIED',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
      }

      next();
    };
  }
}

module.exports = JWTUtils;