import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { outreachBodySchema, parseBody, uuidSchema } from '@/lib/http/validate';
import { preparePitch } from '@/lib/pipeline/preparePitch';

export const dynamic = 'force-dynamic';
/** The audit inside this chain is the slow part; the rest takes seconds. */
export const maxDuration = 300;

/**
 * POST /api/prospects/{id}/prepare
 *
 * Audit, analyse, build the concept and draft the message — one call, in the
 * order the data requires.
 *
 * It runs inline rather than through the job queue because a person is waiting
 * on the result and wants to read it, not watch a progress bar; the whole
 * chain fits well inside the function budget. The queue stays the right tool
 * for bulk work across many businesses — this is the single-prospect path.
 */
export const POST = withGuard<[{ params: Promise<{ id: string }> }]>(
  'write',
  async (request, _ctx, { params }) => {
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

    // The body is the outreach shape; the rest of the chain takes no options.
    const parsed = parseBody(outreachBodySchema, raw);
    if (!parsed.success) return badRequest('Invalid request', parsed.errors);

    const result = await preparePitch(parsedId.data, parsed.data);
    if (!result) return notFound('Prospect not found');

    return ok(result);
  },
);
