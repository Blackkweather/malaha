import '../src/lib/env';
import { closePool } from '../src/lib/db/pool';
import { migrate, resetSchema } from '../src/lib/db/migrate';

/**
 * Applies pending migrations.
 *   npm run db:migrate
 *   npm run db:reset    (drops and recreates the schema first)
 */
async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');

  /*
   * The deploy build runs this with --if-configured. A build for a project
   * that has no database attached yet should still produce a deployable
   * artifact; the app applies migrations lazily on first use anyway. A
   * database that is configured but broken still fails the build loudly.
   */
  if (process.argv.includes('--if-configured') && !process.env.DATABASE_URL) {
    process.stdout.write('DATABASE_URL is not set — skipping migrations for this build.\n');
    return;
  }

  if (reset) {
    process.stdout.write('Dropping and recreating the public schema...\n');
    await resetSchema();
  }

  const result = await migrate();

  if (result.applied.length === 0) {
    process.stdout.write(`No pending migrations (${result.skipped.length} already applied).\n`);
  } else {
    process.stdout.write(`Applied ${result.applied.length} migration(s):\n`);
    for (const name of result.applied) process.stdout.write(`  - ${name}\n`);
  }
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
