module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.PRODUCT_DB_HOST || 'localhost',
      port: process.env.PRODUCT_DB_PORT || 5432,
      database: process.env.PRODUCT_DB_NAME || 'product_db',
      user: process.env.PRODUCT_DB_USER || 'postgres',
      password: process.env.PRODUCT_DB_PASSWORD || 'postgres'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/database/seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.PRODUCT_DB_HOST,
      port: process.env.PRODUCT_DB_PORT,
      database: process.env.PRODUCT_DB_NAME,
      user: process.env.PRODUCT_DB_USER,
      password: process.env.PRODUCT_DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 5,
      max: 20
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations'
    },
    acquireConnectionTimeout: 60000,
    timeout: 30000,
    keepAlive: true
  }
};