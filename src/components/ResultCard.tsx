import Link from 'next/link';
import { ScoreBadge, Stars } from './Score';

export interface ResultCardData {
  businessId: string;
  name: string;
  categoryLabel: string;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  websiteDomain: string | null;
  websiteVerdict: string | null;
  opportunity: number;
  /** The three components behind `opportunity`, so the list can be reranked by any of them. */
  businessQuality: number;
  commercialValue: number;
  digitalOpportunity: number;
  reasons: string[];
}

function verdictTone(verdict: string | null, hasWebsite: boolean): string {
  if (!hasWebsite) return 'text-warn';
  if (!verdict) return 'text-ink-muted';
  if (['solid', 'minor issues'].includes(verdict)) return 'text-positive';
  if (verdict === 'unreachable') return 'text-danger';
  return 'text-warn';
}

/** Compact result card. Raw data stays on the detail page. */
export function ResultCard({ rank, data }: { rank: number; data: ResultCardData }) {
  return (
    <Link
      href={`/prospects/${data.businessId}`}
      className="group block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex items-start gap-4">
        <span className="mt-0.5 w-6 shrink-0 font-mono text-[13px] text-ink-dim">{rank}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold tracking-tight group-hover:text-accent">
              {data.name}
            </h3>
            <span className="text-[12px] text-ink-dim">{data.categoryLabel}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
            <Stars rating={data.rating} />
            <span>
              {data.reviewCount === null ? 'no review data' : `${data.reviewCount} reviews`}
            </span>
            <span className={verdictTone(data.websiteVerdict, data.hasWebsite)}>
              Website: {data.hasWebsite ? (data.websiteVerdict ?? 'audited') : 'none found'}
            </span>
            {data.city ? <span className="text-ink-dim">{data.city}</span> : null}
          </div>

          {data.reasons.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {data.reasons.slice(0, 3).map((reason) => (
                <li key={reason} className="flex gap-2 text-[12px] text-ink-muted">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span className="leading-relaxed">{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <ScoreBadge score={data.opportunity} label="score" />
      </div>
    </Link>
  );
}
