import pg from 'pg';
import { beforeAll, afterAll } from 'vitest';
import { closePool } from '../src/lib/db/pool';
import { migrate } from '../src/lib/db/migrate';

/**
 * Creates the dedicated test database if it does not exist, then applies the
 * migrations. Runs once because the suite is pinned to a single fork.
 */
async function ensureTestDatabase(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL as string);
  const databaseName = url.pathname.replace(/^\//, '');

  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);
    if (rows.length === 0) {
      // The name comes from our own configuration, never from user input.
      await client.query('CREATE DATABASE "' + databaseName.replace(/"/g, '') + '"');
    }
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await ensureTestDatabase();
  await migrate();
}, 60000);

afterAll(async () => {
  await closePool();
});
