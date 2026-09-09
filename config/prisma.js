import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';

function buildAdapter() {
  // Prefer single DATABASE_URL (TiDB Cloud). Falls back to DB_* for local dev.
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL.trim());
    return new PrismaMariaDb({
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || undefined,
      connectionLimit: 5,
      // TiDB Cloud enforces TLS
      ssl: { rejectUnauthorized: true },
    });
  }

  const useSsl = process.env.DB_SSL === 'true';
  return new PrismaMariaDb({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'water_tracking',
    connectionLimit: 5,
    ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({ adapter: buildAdapter() });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
