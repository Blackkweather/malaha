import '../src/lib/env';
import { closePool, query } from '../src/lib/db/pool';
import { config } from '../src/lib/config';
import { scoreAllBusinesses } from '../src/lib/pipeline/score';
import { refreshSearchIndex } from '../src/lib/pipeline/searchIndex';
import { runWebsiteJob } from '../src/lib/pipeline/websiteJob';

/**
 * Runs the enrichment pipeline over the stored businesses:
 * website discovery -> audit -> rescore -> reindex.
 *
 *   npm run pipeline
 *   npm run pipeline -- --limit=50
 */
function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

/** Runs tasks with bounded concurrency so a crawl stays polite and predictable. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const limit = Number(arg('limit') ?? '100');

  const targets = await query<{ id: string; name: string }>(
    `SELECT id, name FROM businesses
      WHERE status = 'active' AND in_scope AND website_url IS NOT NULL
      ORDER BY updated_at DESC LIMIT $1`,
    [limit],
  );

  process.stdout.write(`Auditing ${targets.length} websites with concurrency ${config.audit.concurrency}\n`);

  let done = 0;
  await mapWithConcurrency(targets, config.audit.concurrency, async (target) => {
    try {
      const result = await runWebsiteJob(target.id);
      done += 1;
      const status = result.skipped ?? `${result.audit?.issueCodes.length ?? 0} issues`;
      process.stdout.write(`  [${done}/${targets.length}] ${target.name}: ${status}\n`);
    } catch (err) {
      done += 1;
      process.stdout.write(
        `  [${done}/${targets.length}] ${target.name}: FAILED ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  });

  const scored = await scoreAllBusinesses();
  const index = await refreshSearchIndex();
  process.stdout.write(
    `\nScored ${scored.length}; index now holds ${index.indexed} qualified prospects (${index.skipped} filtered out)\n`,
  );
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    process.stderr.write(`Pipeline failed: ${err instanceof Error ? err.message : String(err)}\n`);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
