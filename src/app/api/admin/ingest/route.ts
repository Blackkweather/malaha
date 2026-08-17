import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { ingestBodySchema, parseBody } from '@/lib/http/validate';
import { enqueueJob } from '@/lib/pipeline/jobs';
import { OSM_SELECTORS, selectorsForCategories } from '@/lib/sources/overpassTags';
import { getAdapter } from '@/lib/sources/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/ingest
 *
 * Queues real ingestion from a public source. This is what makes a deployed
 * instance usable: without it the only way to load data was a CLI script on
 * someone's laptop, so a hosted deployment could never be anything but empty.
 *
 * Nothing is fetched inside this request. One job is queued per category so a
 * single slow Overpass call cannot take the whole batch down with it, and the
 * runner executes them within its own time budget.
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

  const parsed = parseBody(ingestBodySchema, raw);
  if (!parsed.success) return badRequest('Invalid ingest request', parsed.errors);
  const { source, categories, query, limit, enrich } = parsed.data;

  const adapter = getAdapter(source);
  if (!adapter) return badRequest(`No adapter is registered for "${source}"`);
  if (!adapter.isConfigured()) {
    return badRequest(
      `${adapter.displayName} is not configured. Google Places needs GOOGLE_PLACES_API_KEY; OpenStreetMap needs no key.`,
    );
  }

  // Unknown taxonomy keys are rejected rather than ignored, so a typo does not
  // quietly produce an ingest that fetches nothing.
  const unknown = (categories ?? []).filter((key) => OSM_SELECTORS[key] === undefined);
  if (source === 'openstreetmap' && unknown.length > 0) {
    return badRequest(`Unknown categories: ${unknown.join(', ')}`);
  }

  const jobIds: string[] = [];

  if (categories && categories.length > 0) {
    for (const category of categories) {
      jobIds.push(
        await enqueueJob({
          jobType: 'ingest_source',
          priority: 10,
          payload: {
            source,
            query: category,
            ...(source === 'openstreetmap' ? { selectors: selectorsForCategories([category]) } : {}),
            ...(limit === undefined ? {} : { limit }),
          },
        }),
      );
    }
  } else {
    jobIds.push(
      await enqueueJob({
        jobType: 'ingest_source',
        priority: 10,
        payload: {
          source,
          ...(query === undefined ? {} : { query }),
          ...(limit === undefined ? {} : { limit }),
        },
      }),
    );
  }

  // Priorities order the whole batch: ingest (10) finishes before the fan-out
  // (20) queues audits (50), which finish before scoring (200) and indexing
  // (210) read their results.
  if (enrich) {
    jobIds.push(await enqueueJob({ jobType: 'enqueue_audits', priority: 20, payload: { limit: 500 } }));
    jobIds.push(await enqueueJob({ jobType: 'rescore_all', priority: 200 }));
    jobIds.push(await enqueueJob({ jobType: 'refresh_index', priority: 210 }));
  }

  return ok({
    queued: jobIds.length,
    jobIds,
    source: adapter.key,
    categories: categories ?? null,
    enrich,
    note: 'Jobs are queued. Call POST /api/admin/run repeatedly until `remaining` reaches 0.',
  });
});
