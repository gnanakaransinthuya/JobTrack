const mysql = require('mysql2/promise');
require('dotenv').config();

function buildPoolConfig() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    const isRemote =
      parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1';
    const wantSsl =
      process.env.DB_SSL === 'true' ||
      databaseUrl.toLowerCase().includes('ssl') ||
      isRemote;

    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      ...(wantSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  const host = process.env.DB_HOST || '127.0.0.1';
  const isRemote = host !== 'localhost' && host !== '127.0.0.1';
  const wantSsl = process.env.DB_SSL === 'true' || isRemote;

  return {
    host,
    port: Number(process.env.DB_PORT) || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workflow_career_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    ...(wantSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

const pool = mysql.createPool(buildPoolConfig());

module.exports = pool;
