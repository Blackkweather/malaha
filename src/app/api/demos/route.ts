import { listDemos } from '@/lib/demo/generate';
import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';

export const dynamic = 'force-dynamic';

/** GET /api/demos — every generated concept, newest first. */
export const GET = withGuard('read', async () => ok({ demos: await listDemos() }));
