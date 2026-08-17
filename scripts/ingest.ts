import '../src/lib/env';
import { closePool } from '../src/lib/db/pool';
import { logger } from '../src/lib/logger';
import { scoreAllBusinesses } from '../src/lib/pipeline/score';
import { refreshSearchIndex } from '../src/lib/pipeline/searchIndex';
import { getAdapter, listAutomaticAdapters, runAdapter } from '../src/lib/sources/registry';

/**
 * Ingests from the public sources.
 *
 *   npm run ingest                        every configured automatic source
 *   npm run ingest -- --source=openstreetmap --query=dentist
 *   npm run ingest -- --source=csv --file=./my-list.csv
 */
function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const sourceKey = arg('source');
  const queryTerm = arg('query');
  const filePath = arg('file');
  const limit = arg('limit') ? Number(arg('limit')) : undefined;

  const adapters = sourceKey
    ? [getAdapter(sourceKey)].filter((a): a is NonNullable<typeof a> => a !== null)
    : listAutomaticAdapters();

  if (adapters.length === 0) {
    process.stdout.write(
      sourceKey
        ? `No adapter registered for "${sourceKey}".\n`
        : 'No automatic sources are configured. Set GOOGLE_PLACES_API_KEY, or pass --source=csv --file=...\n',
    );
    return;
  }

  for (const adapter of adapters) {
    process.stdout.write(`\n--- ${adapter.displayName} ---\n`);
    const report = await runAdapter(adapter, { query: queryTerm, filePath, limit });

    if (report.skipped) {
      process.stdout.write(`skipped: ${report.skipped}\n`);
      continue;
    }

    process.stdout.write(
      `discovered ${report.discovered}, parsed ${report.parsed}, inserted ${report.result.inserted}, ` +
        `merged ${report.result.merged}, rejected ${report.result.rejected}\n`,
    );

    const sample = report.result.rejections.slice(0, 10);
    for (const rejection of sample) {
      process.stdout.write(`  rejected: ${rejection.name} â€” ${rejection.reasons[0]}\n`);
    }
    if (report.result.rejections.length > sample.length) {
      process.stdout.write(`  ...and ${report.result.rejections.length - sample.length} more\n`);
    }
  }

  const scored = await scoreAllBusinesses();
  const index = await refreshSearchIndex();
  process.stdout.write(`\nScored ${scored.length}; indexed ${index.indexed}, skipped ${index.skipped}\n`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error('ingest failed', { error: err instanceof Error ? err.message : String(err) });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
