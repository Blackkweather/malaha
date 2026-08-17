import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getPool } from './pool';
import { logger } from '../logger';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations');

export interface AppliedMigration {
  name: string;
  checksum: string;
  applied_at: Date;
}

async function ensureMigrationsTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function readMigrationFiles(): { name: string; sql: string; checksum: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
    });
}

/**
 * Applies pending migrations inside a transaction each. Already-applied
 * migrations are skipped; a changed checksum is reported but not re-run, so a
 * deployed schema is never silently rewritten.
 */
export async function migrate(): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureMigrationsTable();
  const pool = getPool();
  const { rows } = await pool.query<AppliedMigration>('SELECT name, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  const result = { applied: [] as string[], skipped: [] as string[] };

  for (const file of readMigrationFiles()) {
    const existing = applied.get(file.name);
    if (existing) {
      if (existing !== file.checksum) {
        logger.warn('migration checksum changed since it was applied', { migration: file.name });
      }
      result.skipped.push(file.name);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(file.sql);
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
        file.name,
        file.checksum,
      ]);
      await client.query('COMMIT');
      result.applied.push(file.name);
      logger.info('migration applied', { migration: file.name });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(
        `Migration ${file.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }

  return result;
}

/** Drops every application table. Destructive; used by `npm run db:reset`. */
export async function resetSchema(): Promise<void> {
  await getPool().query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  logger.warn('schema dropped and recreated');
}
