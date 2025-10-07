const { Logger } = require('../../../shared');

/**
 * Request Sanitization Middleware for security
 */
class RequestSanitizer {
  constructor(options = {}) {
    this.logger = new Logger('request-sanitizer');
    
    this.config = {
      // XSS protection
      removeScriptTags: options.removeScriptTags !== false,
      removeEventHandlers: options.removeEventHandlers !== false,
      
      // SQL injection protection  
      blockSqlKeywords: options.blockSqlKeywords !== false,
      
      // NoSQL injection protection
      blockNoSqlOperators: options.blockNoSqlOperators !== false,
      
      // File path traversal protection
      blockPathTraversal: options.blockPathTraversal !== false,
      
      // Command injection protection
      blockCommandInjection: options.blockCommandInjection !== false,
      
      // Size limits
      maxStringLength: options.maxStringLength || 10000,
      maxArrayLength: options.maxArrayLength || 1000,
      maxObjectDepth: options.maxObjectDepth || 10,
      
      // Whitelist mode
      strictMode: options.strictMode || false,
      allowedFields: options.allowedFields || [],
      
      // Logging
      logSanitization: options.logSanitization !== false,
      logBlocked: options.logBlocked !== false
    };

    // Dangerous patterns
    this.patterns = {
      xss: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<img[^>]+src[\s]*=[\s]*["\'][\s]*javascript:/gi
      ],
      
      sql: [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
        /(--|\/\*|\*\/|;)/g,
        /(\b(OR|AND)\s+\w+\s*=\s*\w+)/gi,
        /'(\s*(OR|AND)\s+)'?\w+/gi
      ],
      
      nosql: [
        /\$where/gi,
        /\$regex/gi,
        /\$gt/gi,
        /\$lt/gi,
        /\$ne/gi,
        /\$in/gi,
        /\$nin/gi,
        /\$exists/gi
      ],
      
      pathTraversal: [
        /\.\.\//g,
        /\.\.\\/g,
        /%2e%2e%2f/gi,
        /%2e%2e%5c/gi,
        /\.\.%2f/gi,
        /\.\.%5c/gi
      ],
      
      commandInjection: [
        /[;&|`$()]/g,
        /\b(bash|sh|cmd|powershell|eval|exec)\b/gi,
        /[\r\n\x00]/g
      ]
    };

    this.logger.info('Request sanitizer initialized', this.config);
  }

  /**
   * Sanitize string value
   */
  sanitizeString(value, fieldName = '') {
    if (typeof value !== 'string') {
      return value;
    }

    let sanitized = value;
    let modified = false;
    const violations = [];

    // Check string length
    if (sanitized.length > this.config.maxStringLength) {
      sanitized = sanitized.substring(0, this.config.maxStringLength);
      modified = true;
      violations.push('max_length_exceeded');
    }

    // XSS protection
    if (this.config.removeScriptTags) {
      const originalLength = sanitized.length;
      this.patterns.xss.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
      
      if (sanitized.length !== originalLength) {
        modified = true;
        violations.push('xss_removed');
      }
    }

    // SQL injection protection
    if (this.config.blockSqlKeywords) {
      this.patterns.sql.forEach(pattern => {
        if (pattern.test(sanitized)) {
          violations.push('sql_injection_detected');
        }
      });
    }

    // NoSQL injection protection
    if (this.config.blockNoSqlOperators) {
      this.patterns.nosql.forEach(pattern => {
        if (pattern.test(sanitized)) {
          violations.push('nosql_injection_detected');
        }
      });
    }

    // Path traversal protection
    if (this.config.blockPathTraversal) {
      const originalLength = sanitized.length;
      this.patterns.pathTraversal.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
      
      if (sanitized.length !== originalLength) {
        modified = true;
        violations.push('path_traversal_removed');
      }
    }

    // Command injection protection
    if (this.config.blockCommandInjection) {
      this.patterns.commandInjection.forEach(pattern => {
        if (pattern.test(sanitized)) {
          violations.push('command_injection_detected');
        }
      });
    }

    // Log if violations found
    if (violations.length > 0) {
      if (this.config.logBlocked) {
        this.logger.warn('Security violations detected', {
          fieldName,
          violations,
          originalValue: value.substring(0, 100), // Limit logging
          sanitizedValue: sanitized.substring(0, 100)
        });
      }

      // Block request if dangerous patterns found
      const dangerousViolations = [
        'sql_injection_detected',
        'nosql_injection_detected', 
        'command_injection_detected'
      ];
      
      if (violations.some(v => dangerousViolations.includes(v))) {
        throw new Error(`Security violation detected: ${violations.join(', ')}`);
      }
    }

    if (modified && this.config.logSanitization) {
      this.logger.debug('String sanitized', {
        fieldName,
        originalLength: value.length,
        sanitizedLength: sanitized.length,
        violations
      });
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj, depth = 0, path = '') {
    if (depth > this.config.maxObjectDepth) {
      throw new Error(`Maximum object depth exceeded: ${this.config.maxObjectDepth}`);
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length > this.config.maxArrayLength) {
        throw new Error(`Maximum array length exceeded: ${this.config.maxArrayLength}`);
      }

      return obj.map((item, index) => 
        this.sanitizeObject(item, depth + 1, `${path}[${index}]`)
      );
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;
        
        // Strict mode: only allow whitelisted fields
        if (this.config.strictMode && 
            this.config.allowedFields.length > 0 && 
            !this.config.allowedFields.includes(key)) {
          this.logger.debug('Field blocked in strict mode', {
            fieldName: key,
            path: fieldPath
          });
          continue;
        }

        // Sanitize key name
        const sanitizedKey = this.sanitizeString(key, `${fieldPath}[key]`);
        
        // Sanitize value
        sanitized[sanitizedKey] = this.sanitizeObject(value, depth + 1, fieldPath);
      }

      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, path);
    }

    return obj;
  }

  /**
   * Create Express middleware
   */
  middleware(options = {}) {
    const routeConfig = { ...this.config, ...options };

    return (req, res, next) => {
      try {
        const startTime = Date.now();

        // Sanitize request body
        if (req.body && Object.keys(req.body).length > 0) {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && Object.keys(req.params).length > 0) {
          req.params = this.sanitizeObject(req.params);
        }

        // Sanitize headers (specific ones)
        const headersToSanitize = ['user-agent', 'referer', 'x-forwarded-for'];
        headersToSanitize.forEach(header => {
          if (req.headers[header]) {
            req.headers[header] = this.sanitizeString(req.headers[header], `header.${header}`);
          }
        });

        const duration = Date.now() - startTime;

        if (duration > 100) { // Log slow sanitization
          this.logger.warn('Slow sanitization detected', {
            url: req.url,
            method: req.method,
            duration,
            correlationId: req.correlationId
          });
        }

        next();

      } catch (error) {
        this.logger.error('Request sanitization failed', {
          error: error.message,
          url: req.url,
          method: req.method,
          correlationId: req.correlationId
        });

        res.status(400).json({
          error: 'Request validation failed',
          code: 'INVALID_REQUEST',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Validate file upload security
   */
  validateFileUpload(file, allowedTypes = [], maxSize = 10485760) { // 10MB default
    const violations = [];

    // Check file size
    if (file.size > maxSize) {
      violations.push('file_too_large');
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      violations.push('invalid_file_type');
    }

    // Check filename for path traversal
    this.patterns.pathTraversal.forEach(pattern => {
      if (pattern.test(file.originalname)) {
        violations.push('unsafe_filename');
      }
    });

    // Check for executable extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.js', '.vbs'];
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    
    if (dangerousExtensions.includes(`.${fileExtension}`)) {
      violations.push('dangerous_file_type');
    }

    if (violations.length > 0) {
      this.logger.warn('File upload security violations', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        violations
      });

      throw new Error(`File security violations: ${violations.join(', ')}`);
    }

    return true;
  }

  /**
   * Get sanitization statistics
   */
  getStats() {
    return {
      config: this.config,
      patterns: {
        xss: this.patterns.xss.length,
        sql: this.patterns.sql.length,
        nosql: this.patterns.nosql.length,
        pathTraversal: this.patterns.pathTraversal.length,
        commandInjection: this.patterns.commandInjection.length
      }
    };
  }
}

module.exports = RequestSanitizer;