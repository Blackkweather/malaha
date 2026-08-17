import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { uuidSchema } from '@/lib/http/validate';
import { getBusinessDetail } from '@/lib/repo/businesses';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/businesses/{id} — the full stored record, including provenance. */
export const GET = withGuard<[Params]>('read', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid business id');

  const detail = await getBusinessDetail(parsed.data);
  if (!detail) return notFound('Business not found');

  return ok(detail);
});
