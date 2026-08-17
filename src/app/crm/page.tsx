import Link from 'next/link';
import { ScoreBadge } from '@/components/Score';
import { crmCounts, listCrm, CRM_STATUSES } from '@/lib/repo/crm';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  const [entries, counts] = await Promise.all([
    listCrm().catch(() => []),
    crmCounts().catch(() => ({}) as Record<string, number>),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">CRM</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Pipeline state for prospects you have started working. Status is set from the prospect page.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {CRM_STATUSES.map((status) => (
          <div key={status} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <p className="font-mono text-[17px] font-semibold">{counts[status] ?? 0}</p>
            <p className="mt-0.5 text-[11px] text-ink-dim">{status}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-[14px] text-ink-muted">
          No prospects in the pipeline yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface text-[11px] uppercase tracking-[0.12em] text-ink-dim">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface/40">
              {entries.map((entry) => (
                <tr key={entry.businessId} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/prospects/${entry.businessId}`} className="hover:text-accent">
                      {entry.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">{entry.status}</td>
                  <td className="px-4 py-3 text-ink-muted">{entry.owner ?? '—'}</td>
                  <td className="max-w-[280px] truncate px-4 py-3 text-ink-dim">
                    {entry.notes ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {entry.opportunity !== null ? (
                      <ScoreBadge score={entry.opportunity} />
                    ) : (
                      <span className="text-ink-dim">—</span>
                    )}
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
