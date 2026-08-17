import pg from 'pg';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

// `pg` ships as CommonJS, so the constructor is taken off the default export
// rather than imported as a named binding.
const { Pool: PgPool } = pg;
import { config } from '../config';
import { logger } from '../logger';

/**
 * A single pooled connection per process. Next.js hot-reloads modules in dev,
 * so the pool is cached on globalThis to avoid exhausting Postgres connections.
 */
const globalForPool = globalThis as unknown as { __prospectPool?: Pool };

export function getPool(): Pool {
  if (!globalForPool.__prospectPool) {
    const pool = new PgPool({
      connectionString: config.db.url,
      max: config.db.poolMax,
      idleTimeoutMillis: config.db.idleTimeoutMs,
      connectionTimeoutMillis: config.db.connectionTimeoutMs,
      application_name: 'malaga-prospect-finder',
    });
    pool.on('error', (err) => logger.error('pg pool error', { error: err.message }));
    globalForPool.__prospectPool = pool;
  }
  return globalForPool.__prospectPool;
}

/**
 * Run a parameterised query. Every call site passes values as bound parameters;
 * string interpolation of user input into SQL is never used in this codebase.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as unknown[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken; the pool will discard it */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (globalForPool.__prospectPool) {
    await globalForPool.__prospectPool.end();
    globalForPool.__prospectPool = undefined;
  }
}

export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
