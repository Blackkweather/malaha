import { claudeEnabled, config, googlePlacesEnabled, groqEnabled } from '@/lib/config';
import { getDashboard } from '@/lib/repo/dashboard';

export const dynamic = 'force-dynamic';

function Item({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-3 last:border-0">
      <div>
        <p className="text-[13px]">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-ink-dim">{hint}</p> : null}
      </div>
      <span className="shrink-0 font-mono text-[13px] text-ink-muted">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-dim">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Status({ enabled, on, off }: { enabled: boolean; on: string; off: string }) {
  return <span className={enabled ? 'text-positive' : 'text-ink-dim'}>{enabled ? on : off}</span>;
}

export default async function SettingsPage() {
  const dashboard = await getDashboard().catch(() => null);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="mb-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Every value here comes from the environment. Change it in .env and restart. Secrets are
          never displayed.
        </p>
      </div>

      <Section title="Geographic scope">
        <Item label="City" value={config.geo.city} hint="Backend-enforced, not a request parameter." />
        <Item label="Province" value={config.geo.province} />
        <Item label="Country" value={config.geo.country} />
        <Item
          label="Minimum location confidence"
          value={config.geo.minLocationConfidence}
          hint="Below this, a business is never indexed."
        />
      </Section>

      <Section title="Search">
        <Item label="Default results" value={config.search.defaultLimit} />
        <Item label="Maximum results" value={config.search.maxLimit} />
        <Item
          label="Minimum opportunity score"
          value={config.search.minOpportunityScore}
          hint="The shortlist is never padded below this."
        />
        <Item label="Minimum evidence score" value={config.search.minEvidenceScore} />
      </Section>

      <Section title="Scoring weights">
        <Item label="Business quality" value={`${Math.round(config.weights.businessQuality * 100)}%`} />
        <Item label="Commercial value" value={`${Math.round(config.weights.commercialValue * 100)}%`} />
        <Item
          label="Digital opportunity"
          value={`${Math.round(config.weights.digitalOpportunity * 100)}%`}
        />
      </Section>

      <Section title="Website audit">
        <Item label="Max pages per site" value={config.audit.maxPages} />
        <Item label="Timeout" value={`${config.audit.timeoutMs} ms`} />
        <Item label="Concurrency" value={config.audit.concurrency} />
        <Item label="Audit version" value={config.audit.version} hint="Bumping it invalidates caches." />
        <Item
          label="Playwright rendering"
          value={<Status enabled={config.audit.enablePlaywright} on="enabled" off="disabled" />}
          hint="Used only when a page genuinely needs JavaScript."
        />
      </Section>

      <Section title="Providers">
        <Item
          label="OpenStreetMap (Overpass)"
          value={<Status enabled on="configured" off="off" />}
          hint="Public, no key required."
        />
        <Item
          label="Google Places API"
          value={<Status enabled={googlePlacesEnabled()} on="configured" off="not configured" />}
          hint="Supplies public rating and review counts."
        />
        <Item label="Groq" value={<Status enabled={groqEnabled()} on="configured" off="not configured" />} />
        <Item
          label="Claude"
          value={<Status enabled={claudeEnabled()} on="configured" off="not configured" />}
        />
      </Section>

      {dashboard ? (
        <Section title="System">
          <Item label="Businesses stored" value={dashboard.businesses.total} />
          <Item label="Verified in scope" value={dashboard.businesses.inScope} />
          <Item label="Indexed for search" value={dashboard.index.indexed} />
          <Item label="Audits run" value={dashboard.audits.total} />
          <Item
            label="AI cache hit rate"
            value={`${Math.round(dashboard.ai.cacheHitRate * 100)}%`}
            hint={`${dashboard.ai.cacheHits} of ${dashboard.ai.totalCalls} calls`}
          />
          <Item label="Estimated AI spend" value={`$${dashboard.ai.estimatedCostUsd.toFixed(4)}`} />
        </Section>
      ) : null}
    </div>
  );
}
