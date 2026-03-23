const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "swasthyaqueue",
  password: "8467",   // use YOUR password
  port: 5432,
});

module.exports = pool;