import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { importBodySchema, parseBody } from '@/lib/http/validate';
import { scoreAllBusinesses } from '@/lib/pipeline/score';
import { refreshSearchIndex } from '@/lib/pipeline/searchIndex';
import { getAdapter, runAdapter } from '@/lib/sources/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/import
 *
 * Imports CSV, JSON or manually entered business records through the same
 * adapter contract every other source uses, then rescores and reindexes so the
 * new data is immediately searchable.
 */
export const POST = withGuard('write', async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsed = parseBody(importBodySchema, body);
  if (!parsed.success) return badRequest('Invalid import payload', parsed.errors);

  const adapterKey = parsed.data.format === 'csv' ? 'csv' : parsed.data.format === 'manual' ? 'manual' : 'json';
  const adapter = getAdapter(adapterKey);
  if (!adapter) return badRequest(`No adapter is registered for format "${parsed.data.format}"`);

  const report = await runAdapter(adapter, {
    content: parsed.data.content,
    records: parsed.data.records,
  });

  const scored = await scoreAllBusinesses();
  const index = await refreshSearchIndex();

  return ok({
    source: report.source,
    discovered: report.discovered,
    parsed: report.parsed,
    inserted: report.result.inserted,
    merged: report.result.merged,
    rejected: report.result.rejected,
    rejections: report.result.rejections.slice(0, 50),
    scored: scored.length,
    indexed: index.indexed,
    skippedFromIndex: index.skipped,
  });
});
