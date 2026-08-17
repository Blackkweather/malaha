import Link from 'next/link';
import { config } from '@/lib/config';
import { query } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

interface AuditRow {
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
}

export default async function AuditsPage() {
  const audits = await query<AuditRow>(
    `SELECT a.id, a.business_id AS "businessId", b.name AS "businessName", w.domain,
            a.verdict, a.summary, a.pages_crawled AS "pagesCrawled", a.ok,
            (SELECT count(*) FROM website_issues i WHERE i.audit_id = a.id)::text AS "issueCount",
            (SELECT count(*) FROM website_issues i WHERE i.audit_id = a.id AND i.severity = 'high')::text AS "highSeverity",
            a.created_at AS "createdAt"
       FROM website_audits a
       JOIN businesses b ON b.id = a.business_id
       LEFT JOIN websites w ON w.id = a.website_id
      WHERE a.audit_version = $1
      ORDER BY a.created_at DESC LIMIT 100`,
    [config.audit.version],
  ).catch(() => [] as AuditRow[]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Website audits</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Technical audits run by the background pipeline. Audit version {config.audit.version}.
        </p>
      </div>

      {audits.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-[14px] text-ink-muted">
          No audits yet. Run <code className="font-mono">npm run pipeline</code> to audit the
          discovered websites.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface text-[11px] uppercase tracking-[0.12em] text-ink-dim">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Verdict</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">Issues</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface/40">
              {audits.map((audit) => (
                <tr key={audit.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/prospects/${audit.businessId}`} className="hover:text-accent">
                      {audit.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ink-muted">
                    {audit.domain ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={audit.ok ? 'text-ink-muted' : 'text-danger'}>
                      {audit.verdict ?? (audit.ok ? 'audited' : 'failed')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink-muted">{audit.pagesCrawled}</td>
                  <td className="px-4 py-3 font-mono">
                    <span className="text-ink-muted">{audit.issueCount}</span>
                    {Number(audit.highSeverity) > 0 ? (
                      <span className="ml-2 text-danger">{audit.highSeverity} high</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-dim">
                    {new Date(audit.createdAt).toLocaleString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
