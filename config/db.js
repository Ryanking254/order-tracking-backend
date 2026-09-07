import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

const common = {
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
};

// Prefer single DATABASE_URL (TiDB Cloud). Falls back to DB_* for local dev.
const pool = process.env.DATABASE_URL
  ? mysql.createPool({
      uri: process.env.DATABASE_URL.trim(),
      // TiDB Cloud enforces TLS
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      ...common,
    })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '#Ryanking254',
      database: process.env.DB_NAME || 'water_tracking',
      ...(process.env.DB_SSL === 'true'
        ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }
        : {}),
      ...common,
    });

export default pool;
