module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: './dev_database.sqlite3'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: __dirname + '/src/database/migrations'
    },
    useNullAsDefault: true
  },
  
  development_postgres: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_NAME || 'vitrine_digital',
      port: process.env.DB_PORT || 5432
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: __dirname + '/src/database/migrations'
    },
    useNullAsDefault: true
  },
  
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 5432
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: __dirname + '/src/database/migrations'
    }
  }
};