import '../src/lib/env';
import { closePool, pingDatabase } from '../src/lib/db/pool';
import { migrate } from '../src/lib/db/migrate';

/**
 * One-command setup check: verifies the database connection and applies
 * migrations. Run before `npm run seed`.
 */
async function main(): Promise<void> {
  const ping = await pingDatabase();
  if (!ping.ok) {
    process.stderr.write(
      `Cannot reach the database: ${ping.error}\n` +
        'Start it with `docker compose up -d`, or point DATABASE_URL at your own Postgres.\n',
    );
    process.exit(1);
  }
  process.stdout.write(`Database reachable in ${ping.latencyMs} ms\n`);

  const result = await migrate();
  process.stdout.write(
    `Migrations: ${result.applied.length} applied, ${result.skipped.length} already present\n`,
  );
  process.stdout.write('Ready. Next: npm run seed\n');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    process.stderr.write(`Bootstrap failed: ${err instanceof Error ? err.message : String(err)}\n`);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
