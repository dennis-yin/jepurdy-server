require("dotenv").config();

const { Pool } = require("pg");

const db = new Pool({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
});

module.exports = { db };
