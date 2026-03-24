const { Pool } = require("pg");
require("dotenv").config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "swasthyaqueue",
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
    };

const pool = new Pool(poolConfig);

module.exports = pool;
