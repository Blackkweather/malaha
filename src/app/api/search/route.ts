import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { parseQuery, searchQuerySchema } from '@/lib/http/validate';
import { search } from '@/lib/search/search';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=dentist&limit=10
 *
 * Reads the precomputed search index and nothing else: no AI call, no crawl,
 * no external request. The Malaga scope is enforced inside the query.
 */
export const GET = withGuard('read', async (request) => {
  const url = new URL(request.url);
  const parsed = parseQuery(searchQuerySchema, url.searchParams);
  if (!parsed.success) return badRequest('Invalid search parameters', parsed.errors);

  const response = await search({
    q: parsed.data.q,
    limit: parsed.data.limit,
    category: parsed.data.category,
  });

  return ok(response);
});
