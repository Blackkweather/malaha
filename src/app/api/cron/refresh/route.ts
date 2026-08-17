import crypto from 'node:crypto';
import { ensureSchema } from '@/lib/db/ensure';
import { logger } from '@/lib/logger';
import { ok, unauthorized } from '@/lib/http/respond';
import { enqueueJob } from '@/lib/pipeline/jobs';
import { countQueued, drainQueue, requeueStalledJobs } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/refresh
 *
 * The scheduled heartbeat. Two responsibilities, in this order:
 *
 *  1. drain whatever is already queued, so a batch a human started keeps
 *     progressing without anyone holding a browser tab open;
 *  2. if nothing is queued, top up the dataset — re-audit sites whose audit has
 *     aged past the freshness window, then rescore and reindex.
 *
 * Re-auditing is deliberately incremental. A cron that re-crawled every site in
 * Málaga on every tick would be both wasteful and impolite to those servers.
 *
 * This route does not use `withGuard`: Vercel Cron authenticates with
 * CRON_SECRET, not with an application API token.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  // With no secret set, only Vercel's own cron invocation is accepted; an
  // open, unauthenticated job runner on a public URL would be a liability.
  if (secret === '') return request.headers.get('x-vercel-cron') !== null;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '').trim();
  if (provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return unauthorized('This endpoint is only callable by the scheduler');

  await ensureSchema();
  const requeued = await requeueStalledJobs(15);

  let toppedUp = false;
  if ((await countQueued()) === 0) {
    const staleAfterDays = Number(process.env.REFRESH_STALE_AFTER_DAYS ?? '14');
    await enqueueJob({
      jobType: 'enqueue_audits',
      priority: 20,
      payload: { limit: 200, staleAfterDays },
    });
    await enqueueJob({ jobType: 'rescore_all', priority: 200 });
    await enqueueJob({ jobType: 'refresh_index', priority: 210 });
    toppedUp = true;
  }

  const report = await drainQueue({ budgetMs: 240_000, maxJobs: 200 });
  logger.info('cron refresh complete', {
    processed: report.processed,
    remaining: report.remaining,
    toppedUp,
  });

  return ok({ ...report, requeued, toppedUp });
}
