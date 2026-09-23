import { Pool } from 'pg';

import type { Db } from '@/lib/db-types';
import { toPostgresPlaceholders } from '@/lib/sql-placeholders';

declare global {
  var __petolifePgPool: Pool | undefined;
}

function openPool(connectionString: string): Pool {
  // Cache on `global` for the same reason the SQLite driver does: survive
  // Next.js dev's module hot-reload without leaking connections. In a real
  // serverless deployment the module is only evaluated once per cold start,
  // so a plain module-level singleton (the else branch below) is already
  // correctly reused across warm invocations without this trick.
  if (process.env.NODE_ENV !== 'production') {
    if (!global.__petolifePgPool) global.__petolifePgPool = new Pool(poolConfig(connectionString));
    return global.__petolifePgPool;
  }
  return new Pool(poolConfig(connectionString));
}

function poolConfig(connectionString: string) {
  return {
    connectionString,
    // Serverless functions spin up many concurrent instances, each with its
    // own pool - a small per-instance cap avoids exhausting the database's
    // total connection limit. For real production traffic, prefer pointing
    // DATABASE_URL at a provider-side pooler (e.g. Neon/Vercel Postgres's
    // built-in PgBouncer-style pooling) rather than raising this further.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    // Full certificate verification by default - managed Postgres providers
    // (Neon, Supabase, Vercel Postgres, RDS, etc.) use publicly-trusted CAs,
    // so this works out of the box. Only opt out via `sslmode=disable` in
    // the connection string for a plaintext local/test instance; never
    // disable verification (rejectUnauthorized: false) against a real
    // deployment - that accepts any certificate and defeats TLS entirely.
    ssl: connectionString.includes('sslmode=disable')
      ? undefined
      : { rejectUnauthorized: true },
  };
}

export function createPostgresDb(connectionString: string): Db {
  const pool = openPool(connectionString);

  return {
    async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const result = await pool.query(toPostgresPlaceholders(sql), params);
      return result.rows[0] as T | undefined;
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await pool.query(toPostgresPlaceholders(sql), params);
      return result.rows as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const result = await pool.query(toPostgresPlaceholders(sql), params);
      return { changes: result.rowCount ?? 0 };
    },
  };
}
