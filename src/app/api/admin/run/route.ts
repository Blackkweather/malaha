import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { parseBody, runBodySchema } from '@/lib/http/validate';
import { drainQueue, requeueStalledJobs } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';
/** Fluid Compute allows 300s; the default budget leaves headroom for one long job. */
export const maxDuration = 300;

/**
 * POST /api/admin/run
 *
 * Executes queued work inside one request, then reports how much is left.
 *
 * This is the serverless replacement for `npm run worker`. A long-lived worker
 * process does not exist on Vercel, so rather than pretending otherwise the
 * queue is drained in bounded slices: the caller (the ops page, or the cron
 * route) keeps calling while `remaining > 0`. Progress is durable in the
 * database, so an interrupted call loses at most the job it was running.
 */
export const POST = withGuard('write', async (request) => {
  await ensureSchema();

  let raw: unknown = {};
  try {
    const text = await request.text();
    raw = text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsed = parseBody(runBodySchema, raw);
  if (!parsed.success) return badRequest('Invalid run request', parsed.errors);

  // Anything still "running" from a killed invocation is nobody's work until
  // it is released, so reclaim it before deciding the queue is empty.
  const requeued = await requeueStalledJobs(15);

  const report = await drainQueue({
    budgetMs: parsed.data.budgetMs ?? 240_000,
    maxJobs: parsed.data.maxJobs ?? 200,
  });

  return ok({ ...report, requeued });
});
