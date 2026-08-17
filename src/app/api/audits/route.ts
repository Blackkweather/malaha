import { config } from '@/lib/config';
import { query } from '@/lib/db/pool';
import { withGuard } from '@/lib/http/guard';
import { ok } from '@/lib/http/respond';

export const dynamic = 'force-dynamic';

/** GET /api/audits — recent website audits with their headline findings. */
export const GET = withGuard('read', async () => {
  const audits = await query<{
    id: string;
    businessId: string;
    businessName: string;
    domain: string | null;
    verdict: string | null;
    summary: string | null;
    pagesCrawled: number;
    ok: boolean;
    issueCount: string;
    highSeverity: string;
    createdAt: Date;
  }>(
    `SELECT a.id, a.business_id AS "businessId", b.name AS "businessName", w.domain,
            a.verdict, a.summary, a.pages_crawled AS "pagesCrawled", a.ok,
            (SELECT count(*) FROM website_issues i WHERE i.audit_id = a.id)::text AS "issueCount",
            (SELECT count(*) FROM website_issues i WHERE i.audit_id = a.id AND i.severity = 'high')::text AS "highSeverity",
            a.created_at AS "createdAt"
       FROM website_audits a
       JOIN businesses b ON b.id = a.business_id
       LEFT JOIN websites w ON w.id = a.website_id
      WHERE a.audit_version = $1
      ORDER BY a.created_at DESC
      LIMIT 100`,
    [config.audit.version],
  );

  return ok({
    auditVersion: config.audit.version,
    audits: audits.map((a) => ({
      ...a,
      issueCount: Number(a.issueCount),
      highSeverity: Number(a.highSeverity),
    })),
  });
});
