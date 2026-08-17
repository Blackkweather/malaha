import { query } from '@/lib/db/pool';
import { ensureSchema } from '@/lib/db/ensure';
import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';
import { listRecentEvents } from '@/lib/pipeline/jobs';
import { queueSnapshot } from '@/lib/pipeline/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/jobs
 *
 * Everything the operations page needs in one poll: queue state, the live
 * event log, and the dataset counts that tell you whether the work is actually
 * producing prospects rather than merely completing jobs.
 */
export const GET = withGuard('read', async () => {
  await ensureSchema();

  const [snapshot, events, counts] = await Promise.all([
    queueSnapshot(),
    listRecentEvents(60),
    query<{ businesses: string; in_scope: string; audited: string; indexed: string }>(
      `SELECT
         (SELECT count(*) FROM businesses WHERE status = 'active')::text              AS businesses,
         (SELECT count(*) FROM businesses WHERE status = 'active' AND in_scope)::text AS in_scope,
         (SELECT count(DISTINCT business_id) FROM website_audits)::text               AS audited,
         (SELECT count(*) FROM search_index)::text                                    AS indexed`,
    ),
  ]);

  const row = counts[0];

  return ok({
    queue: snapshot,
    dataset: {
      businesses: Number(row?.businesses ?? '0'),
      inScope: Number(row?.in_scope ?? '0'),
      audited: Number(row?.audited ?? '0'),
      indexed: Number(row?.indexed ?? '0'),
    },
    events: events.map((e) => ({
      eventType: e.event_type,
      level: e.level,
      message: e.message,
      businessId: e.business_id,
      createdAt: new Date(e.created_at).toISOString(),
    })),
  });
});
