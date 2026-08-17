import { getPool } from './pool';
import { migrate } from './migrate';
import { logger } from '../logger';

/**
 * Lazy schema setup for serverless deployments.
 *
 * The build step runs migrations too, but a build can be skipped (a rollback,
 * a promoted deployment, a database provisioned after the fact), so the
 * operational routes verify the schema themselves before doing any work.
 *
 * Two things make this safe to call from a request handler:
 *
 *  - it is memoised per process, so it costs one query per cold start, not one
 *    per request;
 *  - it holds a Postgres advisory lock, so several instances starting at once
 *    cannot apply the same migration twice.
 */
const LOCK_KEY = 4_073_120_251; // arbitrary, stable, app-specific

let inflight: Promise<void> | null = null;

async function runOnce(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    const result = await migrate();
    if (result.applied.length > 0) {
      logger.info('schema brought up to date', { applied: result.applied });
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

export function ensureSchema(): Promise<void> {
  if (!inflight) {
    // A failure must not be cached — the next request should retry rather than
    // inherit a transient connection error for the life of the instance.
    inflight = runOnce().catch((err) => {
      inflight = null;
      throw err;
    });
  }
  return inflight;
}

/** Test hook: forget the memoised result. */
export function resetSchemaCache(): void {
  inflight = null;
}
