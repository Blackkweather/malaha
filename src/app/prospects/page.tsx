import Link from 'next/link';
import { ResultCard } from '@/components/ResultCard';
import { topProspects } from '@/lib/search/search';

export const dynamic = 'force-dynamic';

export default async function TopProspectsPage() {
  const data = await topProspects(25);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Top prospects</h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            The highest-opportunity businesses in {data.city}, across every category.
          </p>
        </div>
        <span className="font-mono text-[11px] text-ink-dim">
          {data.count} qualified · {data.tookMs} ms
        </span>
      </div>

      {data.results.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-[14px] text-ink-muted">
            {data.note ?? 'Nothing has been indexed yet.'}
          </p>
          <p className="mt-2 text-[12px] text-ink-dim">
            Open{' '}
            <Link href="/data" className="text-accent underline-offset-4 hover:underline">
              Data
            </Link>{' '}
            to fetch real Málaga businesses from OpenStreetMap and run the pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.results.map((result, index) => (
            <ResultCard key={result.businessId} rank={index + 1} data={result} />
          ))}
        </div>
      )}
    </div>
  );
}
