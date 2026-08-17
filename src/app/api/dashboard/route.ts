import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';
import { getDashboard } from '@/lib/repo/dashboard';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard — system-wide counts, costs and pipeline state. */
export const GET = withGuard('read', async () => ok(await getDashboard()));
