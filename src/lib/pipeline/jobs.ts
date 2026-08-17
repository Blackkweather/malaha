import { query, queryOne, withTransaction } from '../db/pool';
import { logger } from '../logger';

export type JobType =
  | 'ingest_source'
  | 'enqueue_audits'
  | 'website_discovery_audit'
  | 'rescore_all'
  | 'refresh_index'
  | 'deep_analyze'
  | 'generate_outreach';

export interface CrawlJob {
  id: string;
  job_type: JobType;
  target_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export async function enqueueJob(input: {
  jobType: JobType;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO crawl_jobs (job_type, target_id, payload, priority, max_attempts)
     VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`,
    [
      input.jobType,
      input.targetId ?? null,
      JSON.stringify(input.payload ?? {}),
      input.priority ?? 100,
      input.maxAttempts ?? 3,
    ],
  );
  if (!row) throw new Error('Failed to enqueue job');
  return row.id;
}

/**
 * Claims the next runnable job.
 *
 * `FOR UPDATE SKIP LOCKED` lets several workers share the queue without ever
 * handing the same job to two of them.
 */
export async function claimNextJob(): Promise<CrawlJob | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<CrawlJob>(
      `SELECT id, job_type, target_id, payload, attempts, max_attempts
         FROM crawl_jobs
        WHERE status = 'queued' AND scheduled_at <= now()
        ORDER BY priority ASC, scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
    );
    if (rows.length === 0) return null;

    const job = rows[0];
    await client.query(
      `UPDATE crawl_jobs
          SET status = 'running', started_at = now(), attempts = attempts + 1, updated_at = now()
        WHERE id = $1`,
      [job.id],
    );
    return { ...job, attempts: job.attempts + 1 };
  });
}

export async function completeJob(jobId: string, message: string): Promise<void> {
  await query(
    `UPDATE crawl_jobs SET status = 'done', finished_at = now(), error = NULL, updated_at = now() WHERE id = $1`,
    [jobId],
  );
  await recordEvent(jobId, 'job.completed', message, 'info');
}

/**
 * Marks a job failed. Attempts below the limit are requeued with a backoff so a
 * transient network problem does not permanently lose the work.
 */
export async function failJob(job: CrawlJob, error: string): Promise<void> {
  const exhausted = job.attempts >= job.max_attempts;
  if (exhausted) {
    await query(
      `UPDATE crawl_jobs SET status = 'failed', finished_at = now(), error = $2, updated_at = now() WHERE id = $1`,
      [job.id, error],
    );
  } else {
    const backoffSeconds = Math.min(300, 15 * 2 ** (job.attempts - 1));
    await query(
      `UPDATE crawl_jobs
          SET status = 'queued', error = $2, scheduled_at = now() + ($3 || ' seconds')::interval, updated_at = now()
        WHERE id = $1`,
      [job.id, error, String(backoffSeconds)],
    );
  }
  await recordEvent(job.id, 'job.failed', error, 'error');
}

export async function recordEvent(
  jobId: string | null,
  eventType: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
  businessId: string | null = null,
): Promise<void> {
  await query(
    'INSERT INTO crawl_events (job_id, business_id, event_type, level, message) VALUES ($1, $2, $3, $4, $5)',
    [jobId, businessId, eventType, level, message],
  ).catch((err) => logger.warn('failed to record crawl event', { error: String(err) }));
}

export async function listRecentEvents(limit = 100): Promise<
  { event_type: string; level: string; message: string; created_at: Date; business_id: string | null }[]
> {
  return query(
    `SELECT event_type, level, message, created_at, business_id
       FROM crawl_events ORDER BY created_at DESC LIMIT $1`,
    [limit],
  ) as Promise<
    { event_type: string; level: string; message: string; created_at: Date; business_id: string | null }[]
  >;
}

/**
 * Queues a website discovery+audit job for every business that needs one.
 *
 * `staleAfterDays` keeps the periodic refresh cheap: a business audited inside
 * the window is left alone, so a scheduled run only picks up new businesses and
 * genuinely aged audits instead of re-crawling the whole city every time.
 * Pass `null` to force a full re-audit.
 */
export async function enqueueWebsiteJobsForAll(
  limit = 200,
  staleAfterDays: number | null = null,
): Promise<number> {
  const freshnessClause =
    staleAfterDays === null
      ? ''
      : `AND NOT EXISTS (
            SELECT 1 FROM website_audits a
             WHERE a.business_id = b.id
               AND a.created_at > now() - ($2 || ' days')::interval
          )`;

  const params: unknown[] = staleAfterDays === null ? [limit] : [limit, String(staleAfterDays)];

  const rows = await query<{ id: string }>(
    `SELECT b.id FROM businesses b
      WHERE b.status = 'active' AND b.in_scope
        AND NOT EXISTS (
          SELECT 1 FROM crawl_jobs j
           WHERE j.target_id = b.id AND j.job_type = 'website_discovery_audit'
             AND j.status IN ('queued', 'running')
        )
        ${freshnessClause}
      ORDER BY b.updated_at DESC
      LIMIT $1`,
    params,
  );

  for (const row of rows) {
    await enqueueJob({ jobType: 'website_discovery_audit', targetId: row.id, priority: 50 });
  }
  return rows.length;
}
