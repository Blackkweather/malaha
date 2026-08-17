import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';
import { crmCounts, isCrmStatus, listCrm } from '@/lib/repo/crm';

export const dynamic = 'force-dynamic';

/** GET /api/crm?status=contacted — the pipeline board. */
export const GET = withGuard('read', async (request) => {
  const statusParam = new URL(request.url).searchParams.get('status');
  const status = isCrmStatus(statusParam) ? statusParam : undefined;
  const [entries, counts] = await Promise.all([listCrm(status), crmCounts()]);
  return ok({ entries, counts, filter: status ?? null });
});
