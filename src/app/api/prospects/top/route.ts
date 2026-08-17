import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { parseQuery, topProspectsQuerySchema } from '@/lib/http/validate';
import { topProspects } from '@/lib/search/search';

export const dynamic = 'force-dynamic';

/** GET /api/prospects/top — the strongest Malaga prospects overall. */
export const GET = withGuard('read', async (request) => {
  const url = new URL(request.url);
  const parsed = parseQuery(topProspectsQuerySchema, url.searchParams);
  if (!parsed.success) return badRequest('Invalid parameters', parsed.errors);

  return ok(await topProspects(parsed.data.limit));
});
