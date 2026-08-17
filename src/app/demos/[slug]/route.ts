import { getDemoBySlug } from '@/lib/demo/generate';
import { demoSlugSchema } from '@/lib/http/validate';

export const dynamic = 'force-dynamic';

/**
 * Serves a generated demo as a standalone HTML document at its own URL.
 *
 * A route handler is used rather than a page so the concept renders exactly as
 * generated, without the application shell around it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const parsed = demoSlugSchema.safeParse(slug);
  if (!parsed.success) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const demo = await getDemoBySlug(parsed.data);
  if (!demo) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response(demo.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
