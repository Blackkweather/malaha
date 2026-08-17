import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { outreachBodySchema, parseBody, uuidSchema } from '@/lib/http/validate';
import { generateOutreach, listOutreachForBusiness } from '@/lib/outreach/generate';
import { getBusiness } from '@/lib/repo/businesses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** GET /api/prospects/{id}/outreach — messages already drafted for this prospect. */
export const GET = withGuard<[Params]>('read', async (_request, _ctx, { params }) => {
  await ensureSchema();
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  return ok({ messages: await listOutreachForBusiness(parsed.data) });
});

/**
 * POST /api/prospects/{id}/outreach — drafts a message from the audit.
 *
 * Drafts only. Nothing is ever sent from this application: contacting a
 * business is a decision a person makes, and an automated mailer pointed at
 * scraped addresses is exactly what this project should not become.
 */
export const POST = withGuard<[Params]>('write', async (request, _ctx, { params }) => {
  await ensureSchema();
  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return badRequest('Invalid prospect id');

  let raw: unknown = {};
  try {
    const text = await request.text();
    raw = text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const parsed = parseBody(outreachBodySchema, raw);
  if (!parsed.success) return badRequest('Invalid outreach request', parsed.errors);

  const business = await getBusiness(parsedId.data);
  if (!business) return notFound('Prospect not found');

  const record = await generateOutreach(parsedId.data, parsed.data);
  if (!record) return notFound('Prospect not found');

  return ok(record);
});
