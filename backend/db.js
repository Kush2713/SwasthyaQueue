const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "swasthyaqueue",
  password: process.env.DB_PASSWORD || "1234",
  port: Number(process.env.DB_PORT) || 5432,
});

module.exports = pool;
