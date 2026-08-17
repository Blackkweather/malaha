import { query } from '@/lib/db/pool';
import { withGuard } from '@/lib/http/guard';
import { badRequest, ok } from '@/lib/http/respond';
import { uuidSchema } from '@/lib/http/validate';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/prospects/{id}/analysis — stored AI analyses, newest per provider. */
export const GET = withGuard<[Params]>('read', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  const rows = await query<{
    provider: string;
    stage: string;
    model: string;
    output: unknown;
    created_at: Date;
    latency_ms: number | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    estimated_cost_usd: string | null;
  }>(
    `SELECT DISTINCT ON (provider, stage)
            provider, stage, model, output, created_at, latency_ms,
            prompt_tokens, completion_tokens, estimated_cost_usd
       FROM ai_analyses WHERE business_id = $1
      ORDER BY provider, stage, created_at DESC`,
    [parsed.data],
  );

  const groq = rows.find((r) => r.provider === 'groq') ?? null;
  const claude = rows.find((r) => r.provider === 'claude') ?? null;

  return ok({
    businessId: parsed.data,
    groq: groq
      ? {
          model: groq.model,
          createdAt: groq.created_at,
          latencyMs: groq.latency_ms,
          estimatedCostUsd: groq.estimated_cost_usd === null ? null : Number(groq.estimated_cost_usd),
          output: groq.output,
        }
      : null,
    claude: claude
      ? {
          model: claude.model,
          createdAt: claude.created_at,
          latencyMs: claude.latency_ms,
          estimatedCostUsd:
            claude.estimated_cost_usd === null ? null : Number(claude.estimated_cost_usd),
          output: claude.output,
        }
      : null,
    hasAnalysis: rows.length > 0,
  });
});
