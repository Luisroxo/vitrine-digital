const knex = require('knex');

/**
 * Database Connection Utility for Microservices
 * Provides standardized database connections across all services
 */
class DatabaseConnection {
  constructor() {
    this.connection = null;
  }

  /**
   * Create a new database connection
   * @param {Object} config - Database configuration
   * @param {string} config.host - Database host
   * @param {number} config.port - Database port
   * @param {string} config.database - Database name
   * @param {string} config.user - Database user
   * @param {string} config.password - Database password
   */
  static create(config) {
    const defaultConfig = {
      client: 'pg',
      connection: {
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || process.env.DB_PORT || 5432,
        database: config.database || process.env.DB_NAME,
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100
      },
      migrations: {
        directory: './src/database/migrations',
        tableName: 'knex_migrations'
      },
      seeds: {
        directory: './src/database/seeds'
      }
    };

    return knex(defaultConfig);
  }

  /**
   * Create connection from DATABASE_URL
   * @param {string} databaseUrl - Full database URL
   */
  static createFromUrl(databaseUrl) {
    return knex({
      client: 'pg',
      connection: databaseUrl,
      pool: {
        min: 2,
        max: 10
      }
    });
  }

  /**
   * Test database connection
   * @param {Object} db - Knex connection instance
   */
  static async testConnection(db) {
    try {
      await db.raw('SELECT 1');
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  /**
   * Close database connection
   * @param {Object} db - Knex connection instance
   */
  static async closeConnection(db) {
    if (db) {
      await db.destroy();
      console.log('🔒 Database connection closed');
    }
  }

  /**
   * Run migrations for a service
   * @param {Object} db - Knex connection instance
   */
  static async runMigrations(db) {
    try {
      await db.migrate.latest();
      console.log('✅ Migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Run seeds for a service
   * @param {Object} db - Knex connection instance
   */
  static async runSeeds(db) {
    try {
      await db.seed.run();
      console.log('✅ Seeds completed');
    } catch (error) {
      console.error('❌ Seeds failed:', error.message);
      throw error;
    }
  }
}

module.exports = DatabaseConnection;