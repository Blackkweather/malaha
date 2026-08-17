import { generateDemo } from '@/lib/demo/generate';
import { withGuard } from '@/lib/http/guard';
import { badRequest, notFound, ok } from '@/lib/http/respond';
import { uuidSchema } from '@/lib/http/validate';
import { getBusiness } from '@/lib/repo/businesses';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/** POST /api/prospects/{id}/generate-demo — builds an original website concept. */
export const POST = withGuard<[Params]>('write', async (_request, _ctx, { params }) => {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return badRequest('Invalid prospect id');

  const business = await getBusiness(parsed.data);
  if (!business) return notFound('Prospect not found');

  const demo = await generateDemo(parsed.data);

  return ok({
    id: demo.id,
    slug: demo.slug,
    title: demo.title,
    url: demo.url,
    createdAt: demo.createdAt,
    generatedFrom: demo.concept.generatedFrom,
  });
});
