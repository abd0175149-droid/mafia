import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';
import * as schema from '../schemas/drizzle.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function connectDB() {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000, // 3 ثواني timeout
  });

  // محاولة اتصال مع timeout
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
    return drizzle(pool, { schema });
  } catch (err: any) {
    console.log('⚠️ PostgreSQL unavailable. Stats/surveys will be disabled.');
    pool = null;
    return null;
  }
}

export function getPool(): pg.Pool | null {
  return pool;
}

export type Database = Awaited<ReturnType<typeof connectDB>>;
