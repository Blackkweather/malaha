import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CrmControl, DeepAnalyzeButton, GenerateDemoButton } from '@/components/ProspectActions';
import { ScoreBadge, ScoreBar, Stars } from '@/components/Score';
import type { ClaudeAnalysis } from '@/lib/ai/claude';
import type { GroqAnalysis } from '@/lib/ai/groq';
import { CATEGORY_BY_KEY, OTHER_CATEGORY } from '@/lib/normalize/category';
import { getBusinessDetail } from '@/lib/repo/businesses';
import { AiPanels } from '@/components/AiPanels';
import { OutreachPanel } from '@/components/OutreachPanel';

export const dynamic = 'force-dynamic';

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-dim">{title}</h2>
      {subtitle ? <p className="mt-1 text-[12px] text-ink-dim">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-[12px] text-ink-dim">{label}</span>
      <span className="text-right text-[13px]">{value ?? '—'}</span>
    </div>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  high: 'text-danger',
  medium: 'text-warn',
  low: 'text-ink-dim',
};

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getBusinessDetail(id).catch(() => null);
  if (!detail) notFound();

  const category = CATEGORY_BY_KEY.get(detail.business.category) ?? OTHER_CATEGORY;
  const bestReview = detail.reviews[0] ?? null;
  const reasonsBlob = (detail.score?.reasons ?? {}) as {
    top?: string[];
    reasons?: { code: string; label: string; impact: string; points: number }[];
    qualified?: boolean;
    disqualification?: string[];
    websiteVerdict?: string;
  };
  const weights = (detail.score?.weights ?? {}) as Record<string, number>;

  const groq = detail.analyses.find((a) => a.provider === 'groq')?.output as GroqAnalysis | undefined;
  const claude = detail.analyses.find((a) => a.provider === 'claude')?.output as
    | ClaudeAnalysis
    | undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/prospects" className="text-[12px] text-ink-dim hover:text-ink">
        &larr; Back to prospects
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{detail.business.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            <span>{category.label}</span>
            <Stars rating={bestReview?.rating ?? null} />
            <span>
              {bestReview?.review_count ?? null
                ? `${bestReview?.review_count} reviews`
                : 'no public review data'}
            </span>
            <span
              className={detail.business.in_scope ? 'text-positive' : 'text-danger'}
              title={detail.business.scope_reason ?? undefined}
            >
              {detail.business.in_scope ? 'Malaga verified' : 'Malaga not verified'}
            </span>
          </div>
        </div>
        {detail.score ? <ScoreBadge score={detail.score.opportunity} label="opportunity" /> : null}
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {detail.score ? (
            <Panel title="Scores" subtitle="Every number is explained by the reasons below.">
              <div className="space-y-4">
                <ScoreBar
                  label="Business quality"
                  score={detail.score.business_quality}
                  weight={weights.businessQuality}
                />
                <ScoreBar
                  label="Commercial value"
                  score={detail.score.commercial_value}
                  weight={weights.commercialValue}
                />
                <ScoreBar
                  label="Digital opportunity"
                  score={detail.score.digital_opportunity}
                  weight={weights.digitalOpportunity}
                />
                <div className="border-t border-line pt-4">
                  <ScoreBar label="Opportunity score" score={detail.score.opportunity} />
                </div>
              </div>

              {reasonsBlob.reasons && reasonsBlob.reasons.length > 0 ? (
                <ul className="mt-5 space-y-2 border-t border-line pt-4">
                  {reasonsBlob.reasons.map((reason, index) => (
                    <li key={`${reason.code}-${index}`} className="flex gap-2.5 text-[12px]">
                      <span
                        className={
                          reason.impact === 'positive'
                            ? 'text-positive'
                            : reason.impact === 'negative'
                              ? 'text-danger'
                              : 'text-ink-dim'
                        }
                      >
                        {reason.impact === 'negative' ? '−' : '+'}
                      </span>
                      <span className="flex-1 text-ink-muted">{reason.label}</span>
                      <span className="font-mono text-[10px] text-ink-dim">
                        {Math.round(reason.points)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {reasonsBlob.disqualification && reasonsBlob.disqualification.length > 0 ? (
                <div className="mt-5 rounded-lg border border-warn/30 bg-warn/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-warn">
                    Excluded from the shortlist
                  </p>
                  <ul className="mt-2 space-y-1">
                    {reasonsBlob.disqualification.map((reason) => (
                      <li key={reason} className="text-[12px] text-ink-muted">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : null}

          <Panel
            title="Website audit"
            subtitle={detail.audit?.summary ?? 'No audit has been run for this prospect yet.'}
          >
            {detail.website ? (
              <>
                <Row
                  label="URL"
                  value={
                    <a
                      href={detail.website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {detail.website.domain}
                    </a>
                  }
                />
                <Row label="Reachable" value={detail.website.reachable ? 'yes' : 'no'} />
                <Row label="HTTP status" value={detail.website.http_status ?? '—'} />
                <Row label="HTTPS" value={detail.website.uses_https ? 'yes' : 'no'} />
                <Row
                  label="Response time"
                  value={
                    detail.website.response_time_ms ? `${detail.website.response_time_ms} ms` : '—'
                  }
                />
                <Row
                  label="Official-site confidence"
                  value={`${Math.round(detail.website.official_confidence * 100)}%`}
                />
                <Row label="Pages inspected" value={detail.audit?.pages_crawled ?? 0} />
              </>
            ) : (
              <p className="text-[13px] text-ink-muted">
                No official website was verified for this business.
              </p>
            )}

            {detail.issues.length > 0 ? (
              <ul className="mt-5 space-y-2 border-t border-line pt-4">
                {detail.issues.map((issue) => (
                  <li key={issue.code} className="flex gap-3 text-[12px]">
                    <span className={`w-14 shrink-0 ${SEVERITY_TONE[issue.severity] ?? ''}`}>
                      {issue.severity}
                    </span>
                    <span className="flex-1">
                      <span className="text-ink">{issue.title}</span>
                      {issue.detail ? <span className="block text-ink-dim">{issue.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <OutreachPanel businessId={detail.business.id} />

          <AiPanels groq={groq ?? null} claude={claude ?? null} />
        </div>

        <aside className="space-y-5">
          <Panel title="Location">
            <Row label="Address" value={detail.business.address} />
            <Row label="City" value={detail.business.city ?? detail.business.municipality} />
            <Row label="Postal code" value={detail.business.postal_code} />
            <Row label="Province" value={detail.business.province} />
            <Row
              label="Coordinates"
              value={
                detail.business.latitude && detail.business.longitude
                  ? `${detail.business.latitude.toFixed(5)}, ${detail.business.longitude.toFixed(5)}`
                  : '—'
              }
            />
            <Row
              label="Confidence"
              value={`${Math.round(detail.business.location_confidence * 100)}%`}
            />
          </Panel>

          <Panel title="Public contacts">
            <Row label="Phone" value={detail.business.primary_phone} />
            <Row label="Email" value={detail.business.primary_email} />
            <Row
              label="Website"
              value={
                detail.business.website_url ? (
                  <a
                    href={detail.business.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    visit
                  </a>
                ) : (
                  '—'
                )
              }
            />
            {detail.socials.map((social) => (
              <Row
                key={social.url}
                label={social.platform}
                value={
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    profile
                  </a>
                }
              />
            ))}
          </Panel>

          <Panel title="Actions">
            <div className="space-y-3">
              <DeepAnalyzeButton businessId={detail.business.id} />
              <GenerateDemoButton businessId={detail.business.id} />
            </div>
          </Panel>

          <Panel title="CRM">
            <CrmControl
              businessId={detail.business.id}
              initialStatus={detail.crm?.status ?? null}
              initialNotes={detail.crm?.notes ?? null}
            />
          </Panel>

          {detail.demos.length > 0 ? (
            <Panel title="Demos">
              {detail.demos.map((demo) => (
                <Row
                  key={demo.id}
                  label={new Date(demo.created_at).toLocaleDateString('en-GB')}
                  value={
                    <a
                      href={`/demos/${demo.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      open concept
                    </a>
                  }
                />
              ))}
            </Panel>
          ) : null}

          <Panel title="Sources" subtitle="Every fact is traceable.">
            {detail.sources.map((source, index) => (
              <Row
                key={`${source.source}-${index}`}
                label={source.source}
                value={
                  source.source_url ? (
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {new Date(source.retrieved_at).toLocaleDateString('en-GB')}
                    </a>
                  ) : (
                    new Date(source.retrieved_at).toLocaleDateString('en-GB')
                  )
                }
              />
            ))}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
