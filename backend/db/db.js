const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

let db;
let pool;

async function initDb() {
  if (db) return db;

  const host = process.env.MYSQL_HOST || 'localhost';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'taskflow';

  const dbName = String(database);
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error('MYSQL_DATABASE must contain only letters, numbers, and underscores.');
  }

  const bootstrap = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  db = {
    async get(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows[0] || null;
    },
    async all(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async run(sql, params = []) {
      const [result] = await pool.query(sql, params);
      return result;
    },
  };

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  initDb,
  getDb,
  parseJson,
};
