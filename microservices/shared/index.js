/**
 * Vitrine Digital - Shared Libraries
 * Centralized utilities for all microservices
 */

// Database utilities
const DatabaseConnection = require('./database/connection');

// Event system
const EventPublisher = require('./events/EventPublisher');
const EventSubscriber = require('./events/EventSubscriber');

// Services
const CacheService = require('./services/CacheService');
const ImageProcessingService = require('./services/ImageProcessingService');

// Common utilities
const JWTUtils = require('./utils/jwt');
const ValidationSchemas = require('./utils/validation');
const ErrorHandler = require('./utils/error-handler');
const Logger = require('./utils/logger');

module.exports = {
  // Database
  DatabaseConnection,

  // Events
  EventPublisher,
  EventSubscriber,

  // Services
  CacheService,
  ImageProcessingService,

  // Utils
  JWTUtils,
  ValidationSchemas,
  ErrorHandler,
  Logger
};