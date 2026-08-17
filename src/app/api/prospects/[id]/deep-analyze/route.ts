import { deepAnalyze } from '@/lib/ai/deepAnalyze';
import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { uuidSchema } from '@/lib/http/validate';
import { getBusiness } from '@/lib/repo/businesses';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/prospects/{id}/deep-analyze
 *
 * The expensive path, run only on explicit request: refresh the website
 * evidence, re-audit, re-score, then Groq and — for strong prospects — Claude.
 */
export const POST = withGuard<[Params]>('write', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  const business = await getBusiness(parsed.data);
  if (!business) return notFound('Prospect not found');

  const result = await deepAnalyze(parsed.data);

  return ok({
    businessId: result.businessId,
    completed: result.completed,
    opportunity: result.opportunity,
    steps: result.steps,
    groq: result.groq ? { model: result.groq.model, cacheHit: result.groq.cacheHit, output: result.groq.output } : null,
    claude: result.claude
      ? { model: result.claude.model, cacheHit: result.claude.cacheHit, output: result.claude.output }
      : null,
  });
});
