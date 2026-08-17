import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { parseBody, pipelineBodySchema } from '@/lib/http/validate';
import { enqueueJob } from '@/lib/pipeline/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/pipeline
 *
 * Runs enrichment over businesses that are already stored: discover and audit
 * their websites, rescore, reindex. No ingestion.
 *
 * This is the half of the pipeline that was otherwise unreachable from a
 * deployment. Ingesting stores a business and scores what is known about it,
 * but until its website has actually been crawled every prospect looks like it
 * has no web presence — which is the difference between a list of businesses
 * and a list of opportunities.
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

  const parsed = parseBody(pipelineBodySchema, raw);
  if (!parsed.success) return badRequest('Invalid pipeline request', parsed.errors);

  const limit = parsed.data.limit ?? 500;
  // `null` means re-audit everything; a number skips anything audited inside
  // that window, which is what keeps a scheduled run cheap.
  const staleAfterDays = parsed.data.staleAfterDays ?? null;

  const jobIds = [
    await enqueueJob({
      jobType: 'enqueue_audits',
      priority: 20,
      payload: { limit, staleAfterDays },
    }),
    await enqueueJob({ jobType: 'rescore_all', priority: 200 }),
    await enqueueJob({ jobType: 'refresh_index', priority: 210 }),
  ];

  return ok({
    queued: jobIds.length,
    jobIds,
    limit,
    staleAfterDays,
    note: 'Jobs are queued. Call POST /api/admin/run repeatedly until `remaining` reaches 0.',
  });
});
