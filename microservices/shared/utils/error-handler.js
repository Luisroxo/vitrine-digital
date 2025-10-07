/**
 * Standardized Error Handling for Microservices
 * Provides consistent error responses across all services
 */
class ErrorHandler {
  
  /**
   * Custom Application Error
   */
  static AppError = class extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
      this.isOperational = true;
      
      Error.captureStackTrace(this, this.constructor);
    }
  };

  /**
   * Common Error Types
   */
  static errors = {
    // Authentication Errors
    UNAUTHORIZED: (message = 'Unauthorized access') => 
      new ErrorHandler.AppError(message, 401, 'UNAUTHORIZED'),
    
    FORBIDDEN: (message = 'Access forbidden') => 
      new ErrorHandler.AppError(message, 403, 'FORBIDDEN'),
    
    TOKEN_EXPIRED: (message = 'Token has expired') => 
      new ErrorHandler.AppError(message, 401, 'TOKEN_EXPIRED'),
    
    INVALID_TOKEN: (message = 'Invalid token provided') => 
      new ErrorHandler.AppError(message, 401, 'INVALID_TOKEN'),

    // Validation Errors
    VALIDATION_ERROR: (details) => 
      new ErrorHandler.AppError('Validation failed', 400, 'VALIDATION_ERROR', details),
    
    MISSING_REQUIRED_FIELD: (field) => 
      new ErrorHandler.AppError(`Required field missing: ${field}`, 400, 'MISSING_FIELD'),

    // Resource Errors
    NOT_FOUND: (resource = 'Resource') => 
      new ErrorHandler.AppError(`${resource} not found`, 404, 'NOT_FOUND'),
    
    ALREADY_EXISTS: (resource = 'Resource') => 
      new ErrorHandler.AppError(`${resource} already exists`, 409, 'ALREADY_EXISTS'),
    
    RESOURCE_CONFLICT: (message) => 
      new ErrorHandler.AppError(message, 409, 'RESOURCE_CONFLICT'),

    // Business Logic Errors
    INSUFFICIENT_CREDITS: (available, required) => 
      new ErrorHandler.AppError(
        `Insufficient credits. Available: ${available}, Required: ${required}`, 
        400, 
        'INSUFFICIENT_CREDITS',
        { available, required }
      ),
    
    PRODUCT_OUT_OF_STOCK: (productId) => 
      new ErrorHandler.AppError(
        `Product ${productId} is out of stock`, 
        400, 
        'OUT_OF_STOCK',
        { productId }
      ),
    
    INVALID_OPERATION: (message) => 
      new ErrorHandler.AppError(message, 400, 'INVALID_OPERATION'),

    // Integration Errors
    BLING_API_ERROR: (message, details = null) => 
      new ErrorHandler.AppError(`Bling API Error: ${message}`, 500, 'BLING_API_ERROR', details),
    
    EXTERNAL_SERVICE_ERROR: (service, message) => 
      new ErrorHandler.AppError(
        `External service error (${service}): ${message}`, 
        502, 
        'EXTERNAL_SERVICE_ERROR'
      ),

    // System Errors
    DATABASE_ERROR: (message) => 
      new ErrorHandler.AppError(`Database error: ${message}`, 500, 'DATABASE_ERROR'),
    
    RATE_LIMIT_EXCEEDED: () => 
      new ErrorHandler.AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED'),
    
    SERVICE_UNAVAILABLE: (service = 'Service') => 
      new ErrorHandler.AppError(`${service} is unavailable`, 503, 'SERVICE_UNAVAILABLE')
  };

  /**
   * Global error handling middleware
   */
  static globalHandler() {
    return (error, req, res, next) => {
      console.error('🚨 Error occurred:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Handle operational errors
      if (error.isOperational) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          details: error.details,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }

      // Handle validation errors (Joi)
      if (error.isJoi) {
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }

      // Handle database errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({
          error: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }

      if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({
          error: 'Referenced resource not found',
          code: 'FOREIGN_KEY_VIOLATION',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
      }

      // Handle unexpected errors
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message,
          stack: error.stack 
        })
      });
    };
  }

  /**
   * Async error wrapper
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * 404 handler
   */
  static notFoundHandler() {
    return (req, res, next) => {
      const error = new ErrorHandler.AppError(
        `Route ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
      );
      next(error);
    };
  }

  /**
   * Service health check error
   */
  static healthCheckError(service, error) {
    console.error(`🏥 Health check failed for ${service}:`, error.message);
    return {
      service,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log and rethrow error for inter-service communication
   */
  static handleServiceError(serviceName, operation, error) {
    console.error(`🔗 Service communication error:`, {
      service: serviceName,
      operation,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    throw ErrorHandler.errors.EXTERNAL_SERVICE_ERROR(serviceName, error.message);
  }
}

module.exports = ErrorHandler;