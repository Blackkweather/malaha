import Link from 'next/link';
import { listDemos } from '@/lib/demo/generate';

export const dynamic = 'force-dynamic';

export default async function DemosPage() {
  const demos = await listDemos().catch(() => []);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Demos</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Original website concepts generated from public business facts. Each has its own URL you
          can share with the prospect.
        </p>
      </div>

      {demos.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-[14px] text-ink-muted">
          No demos yet. Open a prospect and use <span className="text-ink">Generate demo</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {demos.map((demo) => (
            <div
              key={demo.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5"
            >
              <div>
                <p className="text-[15px] font-medium">{demo.businessName}</p>
                <p className="mt-1 font-mono text-[12px] text-ink-dim">/demos/{demo.slug}</p>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <span className="text-ink-dim">
                  {new Date(demo.createdAt).toLocaleDateString('en-GB')}
                </span>
                <Link href={`/prospects/${demo.businessId}`} className="text-ink-muted hover:text-ink">
                  prospect
                </Link>
                <a
                  href={`/demos/${demo.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent px-3 py-1.5 font-semibold text-[#05202e]"
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
