import type { ClaudeAnalysis } from '@/lib/ai/claude';
import type { GroqAnalysis } from '@/lib/ai/groq';

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-dim">{title}</h2>
      {subtitle ? <p className="mt-1 text-[12px] text-ink-dim">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-3 last:border-0">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">{label}</p>
      <div className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-ink-dim">—</span>;
  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders the stored AI analyses. When a provider has not run, the panel says
 * so plainly rather than showing an empty shell.
 */
export function AiPanels({
  groq,
  claude,
}: {
  groq: GroqAnalysis | null;
  claude: ClaudeAnalysis | null;
}) {
  return (
    <>
      <Card
        title="Groq analysis"
        subtitle="Fast classification and signal extraction over the evidence package."
      >
        {groq ? (
          <>
            <Field label="Website summary">{groq.websiteSummary || '—'}</Field>
            <Field label="Services">
              <Bullets items={groq.services} />
            </Field>
            <Field label="Target customer">{groq.targetCustomer || '—'}</Field>
            <Field label="Opportunity signals">
              <Bullets items={groq.opportunitySignals} />
            </Field>
            <Field label="Estimated project value">
              <span className="font-mono">{groq.estimatedProjectValue}</span>
              <span className="ml-3 text-ink-dim">
                confidence {Math.round(groq.confidence * 100)}%
              </span>
            </Field>
          </>
        ) : (
          <p className="text-[13px] text-ink-muted">
            Not run yet. Use <span className="text-ink">Deep analyze</span> — it requires a
            configured <code className="font-mono text-[12px]">GROQ_API_KEY</code>.
          </p>
        )}
      </Card>

      <Card title="Claude analysis" subtitle="Deep prospect brief for the strongest candidates.">
        {claude ? (
          <>
            <Field label="Verdict">
              <span
                className={
                  claude.verdict === 'strong'
                    ? 'font-semibold text-positive'
                    : claude.verdict === 'weak'
                      ? 'font-semibold text-danger'
                      : 'font-semibold text-warn'
                }
              >
                {claude.verdict}
              </span>
              <span className="ml-3 text-ink-dim">
                confidence {Math.round(claude.confidence * 100)}%
              </span>
            </Field>
            <Field label="Current website experience">{claude.currentWebsiteExperience}</Field>
            <Field label="Business positioning">{claude.businessPositioning}</Field>
            <Field label="Why this is a strong prospect">{claude.whyWorthApproaching}</Field>
            <Field label="Strongest opportunities">
              <ul className="space-y-2">
                {claude.strongestOpportunities.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <span className="text-ink">{item.title}</span>
                    <span className="ml-2 font-mono text-[10px] text-ink-dim">{item.impact}</span>
                    <span className="block">{item.why}</span>
                  </li>
                ))}
              </ul>
            </Field>
            <Field label="Customer journey friction">
              <Bullets items={claude.customerJourneyFriction} />
            </Field>
            <Field label="Redesign priorities">
              <ol className="space-y-1.5">
                {claude.redesignPriorities.map((item) => (
                  <li key={`${item.priority}-${item.item}`} className="flex gap-2.5">
                    <span className="font-mono text-[11px] text-ink-dim">{item.priority}</span>
                    <span>
                      <span className="text-ink">{item.item}</span>
                      <span className="block">{item.rationale}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Field>
            <Field label="Recommended website structure">
              <ul className="space-y-1">
                {claude.recommendedSiteStructure.map((page) => (
                  <li key={page.page} className="flex gap-3">
                    <span className="w-28 shrink-0 text-ink">{page.page}</span>
                    <span>{page.purpose}</span>
                  </li>
                ))}
              </ul>
            </Field>
            <Field label="Recommended primary CTA">
              <span className="rounded-md border border-line bg-surface-2 px-2.5 py-1 font-medium text-ink">
                {claude.recommendedPrimaryCta}
              </span>
            </Field>
            <Field label="Sales angle">
              <span className="text-ink">{claude.salesAngle}</span>
            </Field>
            <Field label="Risks">
              <Bullets items={claude.risks} />
            </Field>
          </>
        ) : (
          <p className="text-[13px] text-ink-muted">
            Not run yet. Deep analysis escalates to Claude only for strong prospects, and requires a
            configured <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code>.
          </p>
        )}
      </Card>
    </>
  );
}
