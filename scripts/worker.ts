import '../src/lib/env';
import { closePool } from '../src/lib/db/pool';
import { logger } from '../src/lib/logger';
import { deepAnalyze } from '../src/lib/ai/deepAnalyze';
import {
  claimNextJob,
  completeJob,
  enqueueWebsiteJobsForAll,
  failJob,
  type CrawlJob,
} from '../src/lib/pipeline/jobs';
import { scoreAllBusinesses } from '../src/lib/pipeline/score';
import { refreshSearchIndex } from '../src/lib/pipeline/searchIndex';
import { runWebsiteJob } from '../src/lib/pipeline/websiteJob';
import { getAdapter, runAdapter } from '../src/lib/sources/registry';

/**
 * Background worker.
 *
 * Drains the crawl_jobs queue. Search never depends on this process â€” it only
 * updates the precomputed tables that search reads.
 *
 *   npm run worker
 *   npm run worker -- --once          drain the queue then exit
 *   npm run worker -- --enqueue-audits
 */
const IDLE_DELAY_MS = 2000;
let shuttingDown = false;

async function handle(job: CrawlJob): Promise<string> {
  switch (job.job_type) {
    case 'ingest_source': {
      const key = String(job.payload.source ?? '');
      const adapter = getAdapter(key);
      if (!adapter) throw new Error(`Unknown source adapter "${key}"`);
      const report = await runAdapter(adapter, job.payload);
      return `${adapter.key}: inserted ${report.result.inserted}, merged ${report.result.merged}`;
    }

    case 'website_discovery_audit': {
      if (!job.target_id) throw new Error('website_discovery_audit requires a target business');
      const result = await runWebsiteJob(job.target_id);
      return result.skipped ?? `audited ${result.audit?.pages.length ?? 0} pages`;
    }

    case 'rescore_all': {
      const scored = await scoreAllBusinesses();
      return `scored ${scored.length} businesses`;
    }

    case 'refresh_index': {
      const report = await refreshSearchIndex();
      return `indexed ${report.indexed}, skipped ${report.skipped}, removed ${report.removed}`;
    }

    case 'deep_analyze': {
      if (!job.target_id) throw new Error('deep_analyze requires a target business');
      const result = await deepAnalyze(job.target_id);
      return `deep analysis ${result.completed ? 'completed' : 'incomplete'}`;
    }

    default:
      throw new Error(`Unhandled job type "${job.job_type}"`);
  }
}

async function drain(): Promise<number> {
  let processed = 0;
  for (;;) {
    if (shuttingDown) return processed;
    const job = await claimNextJob();
    if (!job) return processed;

    try {
      const message = await handle(job);
      await completeJob(job.id, message);
      logger.info('job done', { jobId: job.id, jobType: job.job_type, message });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job, message);
      logger.error('job failed', { jobId: job.id, jobType: job.job_type, error: message });
    }
    processed += 1;
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--enqueue-audits')) {
    const queued = await enqueueWebsiteJobsForAll();
    process.stdout.write(`Queued ${queued} website audit jobs\n`);
  }

  const once = process.argv.includes('--once');

  if (once) {
    const processed = await drain();
    process.stdout.write(`Processed ${processed} job(s)\n`);
    return;
  }

  process.stdout.write('Worker started. Ctrl+C to stop.\n');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      shuttingDown = true;
      process.stdout.write('\nShutting down after the current job...\n');
    });
  }

  while (!shuttingDown) {
    const processed = await drain();
    if (processed === 0) {
      await new Promise((resolve) => setTimeout(resolve, IDLE_DELAY_MS));
    }
  }
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error('worker crashed', { error: err instanceof Error ? err.message : String(err) });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
