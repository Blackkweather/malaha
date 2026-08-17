import { deepAnalyze } from '../ai/deepAnalyze';
import { logger } from '../logger';
import {
  claimNextJob,
  completeJob,
  enqueueWebsiteJobsForAll,
  failJob,
  type CrawlJob,
} from './jobs';
import { scoreAllBusinesses } from './score';
import { refreshSearchIndex } from './searchIndex';
import { runWebsiteJob } from './websiteJob';
import { getAdapter, runAdapter } from '../sources/registry';
import { generateOutreach } from '../outreach/generate';
import { query } from '../db/pool';

/**
 * The one place a queued job is turned into work.
 *
 * This used to live inside `scripts/worker.ts`, which meant a deployment with
 * no long-running process — every serverless deployment — could enqueue jobs
 * but never execute one. It is shared now, so the CLI worker and the HTTP
 * runner behave identically.
 */
export async function handleJob(job: CrawlJob): Promise<string> {
  switch (job.job_type) {
    case 'ingest_source': {
      const key = String(job.payload.source ?? '');
      const adapter = getAdapter(key);
      if (!adapter) throw new Error(`Unknown source adapter "${key}"`);
      const report = await runAdapter(adapter, job.payload);
      return (
        `${adapter.key}: discovered ${report.discovered}, inserted ${report.result.inserted}, ` +
        `merged ${report.result.merged}, rejected ${report.result.rejected}`
      );
    }

    /**
     * Fans out audits *after* ingestion has run, which is the only way to reach
     * businesses that did not exist when the batch was queued.
     */
    case 'enqueue_audits': {
      const limit = Number(job.payload.limit ?? 500);
      const staleAfterDays =
        job.payload.staleAfterDays === null || job.payload.staleAfterDays === undefined
          ? null
          : Number(job.payload.staleAfterDays);
      const queued = await enqueueWebsiteJobsForAll(limit, staleAfterDays);
      return `queued ${queued} website audits`;
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

    case 'generate_outreach': {
      if (!job.target_id) throw new Error('generate_outreach requires a target business');
      const record = await generateOutreach(job.target_id, {
        language: job.payload.language === 'en' ? 'en' : 'es',
        channel: (job.payload.channel as never) ?? 'email',
        senderName: typeof job.payload.senderName === 'string' ? job.payload.senderName : undefined,
      });
      if (!record) throw new Error('Business not found');
      return `outreach drafted (${record.generator}, angle: ${record.angle})`;
    }

    default:
      throw new Error(`Unhandled job type "${job.job_type}"`);
  }
}

export interface DrainOptions {
  /**
   * Wall-clock budget. The runner stops claiming new work once this is spent,
   * which is what makes the queue safe to drive from a request handler that
   * must return before the platform's function timeout.
   */
  budgetMs?: number;
  /** Hard cap on jobs per call, independent of the time budget. */
  maxJobs?: number;
}

export interface DrainReport {
  processed: number;
  succeeded: number;
  failed: number;
  /** True when the runner stopped because it ran out of budget, not out of work. */
  budgetExhausted: boolean;
  remaining: number;
  messages: { jobType: string; message: string; ok: boolean }[];
}

/**
 * Drains queued jobs until the queue is empty or the budget is spent.
 *
 * A single job is never abandoned part-way: the budget is only checked between
 * jobs, so the worst case is one job's duration over budget. Callers size the
 * budget with that in mind.
 */
export async function drainQueue(options: DrainOptions = {}): Promise<DrainReport> {
  const budgetMs = options.budgetMs ?? 45_000;
  const maxJobs = options.maxJobs ?? 100;
  const deadline = Date.now() + budgetMs;

  const report: DrainReport = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    budgetExhausted: false,
    remaining: 0,
    messages: [],
  };

  while (report.processed < maxJobs) {
    if (Date.now() >= deadline) {
      report.budgetExhausted = true;
      break;
    }

    const job = await claimNextJob();
    if (!job) break;

    try {
      const message = await handleJob(job);
      await completeJob(job.id, message);
      report.succeeded += 1;
      report.messages.push({ jobType: job.job_type, message, ok: true });
      logger.info('job done', { jobId: job.id, jobType: job.job_type, message });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job, message);
      report.failed += 1;
      report.messages.push({ jobType: job.job_type, message, ok: false });
      logger.error('job failed', { jobId: job.id, jobType: job.job_type, error: message });
    }
    report.processed += 1;
  }

  report.remaining = await countQueued();
  return report;
}

/** Jobs still waiting to run — what the UI polls to know whether to keep going. */
export async function countQueued(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM crawl_jobs WHERE status IN ('queued', 'running')`,
  );
  return Number(rows[0]?.count ?? '0');
}

export interface QueueSnapshot {
  queued: number;
  running: number;
  done: number;
  failed: number;
  byType: { jobType: string; status: string; count: number }[];
  recentFailures: { jobType: string; error: string; finishedAt: string | null }[];
}

/** Aggregate queue state for the operations page. */
export async function queueSnapshot(): Promise<QueueSnapshot> {
  const rows = await query<{ job_type: string; status: string; count: string }>(
    `SELECT job_type, status, count(*)::text AS count FROM crawl_jobs GROUP BY job_type, status`,
  );

  const byType = rows.map((r) => ({
    jobType: r.job_type,
    status: r.status,
    count: Number(r.count),
  }));

  const total = (status: string): number =>
    byType.filter((r) => r.status === status).reduce((sum, r) => sum + r.count, 0);

  const failures = await query<{ job_type: string; error: string | null; finished_at: Date | null }>(
    `SELECT job_type, error, finished_at FROM crawl_jobs
      WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10`,
  );

  return {
    queued: total('queued'),
    running: total('running'),
    done: total('done'),
    failed: total('failed'),
    byType,
    recentFailures: failures.map((f) => ({
      jobType: f.job_type,
      error: f.error ?? 'unknown error',
      finishedAt: f.finished_at ? new Date(f.finished_at).toISOString() : null,
    })),
  };
}

/**
 * Releases jobs stuck in `running`.
 *
 * A serverless function can be killed mid-job (timeout, redeploy), leaving a
 * claimed row nobody will ever finish. Anything running longer than the cutoff
 * is returned to the queue so the work is not lost.
 */
export async function requeueStalledJobs(olderThanMinutes = 15): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE crawl_jobs
        SET status = 'queued', updated_at = now(), error = 'requeued after stalling'
      WHERE status = 'running'
        AND started_at < now() - ($1 || ' minutes')::interval
      RETURNING id`,
    [String(olderThanMinutes)],
  );
  if (rows.length > 0) logger.warn('requeued stalled jobs', { count: rows.length });
  return rows.length;
}
