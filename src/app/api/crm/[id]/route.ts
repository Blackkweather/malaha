import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { crmUpdateSchema, parseBody, uuidSchema } from '@/lib/http/validate';
import { getBusiness } from '@/lib/repo/businesses';
import { getCrmEntry, setCrmStatus } from '@/lib/repo/crm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/crm/{id} — the CRM record for one prospect. */
export const GET = withGuard<[Params]>('read', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  const entry = await getCrmEntry(parsed.data);
  if (!entry) return notFound('No CRM record for this prospect yet');
  return ok(entry);
});

/** PUT /api/crm/{id} — sets pipeline status, owner, notes and next action. */
export const PUT = withGuard<[Params]>('write', async (request, _ctx, { params }) => {
  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return badRequest('Invalid prospect id');

  const business = await getBusiness(parsedId.data);
  if (!business) return notFound('Prospect not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsed = parseBody(crmUpdateSchema, body);
  if (!parsed.success) return badRequest('Invalid CRM payload', parsed.errors);

  const entry = await setCrmStatus({
    businessId: parsedId.data,
    status: parsed.data.status,
    owner: parsed.data.owner ?? null,
    notes: parsed.data.notes ?? null,
    nextActionAt: parsed.data.nextActionAt ?? null,
  });

  return ok(entry);
});
