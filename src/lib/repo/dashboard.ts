import { config } from '../config';
import { query, queryOne } from '../db/pool';
import { resolveScope } from '../geo/scope';
import { crmCounts } from './crm';

export interface DashboardData {
  scope: { city: string; minLocationConfidence: number };
  businesses: {
    total: number;
    inScope: number;
    outOfScope: number;
    withWebsite: number;
    withoutWebsite: number;
    withReviewSignals: number;
  };
  index: { indexed: number; averageOpportunity: number | null; topScore: number | null };
  audits: { total: number; last24h: number; failed: number; issuesFound: number };
  ai: {
    totalCalls: number;
    cacheHits: number;
    cacheHitRate: number;
    estimatedCostUsd: number;
    byProvider: { provider: string; calls: number; cacheHits: number; costUsd: number }[];
  };
  demos: { total: number };
  crm: Record<string, number>;
  jobs: { queued: number; running: number; failed: number; done: number };
  topCategories: { category: string; label: string; count: number; averageOpportunity: number }[];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Aggregates the whole system state for the dashboard endpoint. */
export async function getDashboard(): Promise<DashboardData> {
  const scope = resolveScope(config.geo.city);

  const [businessStats, indexStats, auditStats, aiStats, aiByProvider, demoStats, jobStats, categories, crm] =
    await Promise.all([
      queryOne<Record<string, string>>(
        `SELECT
           count(*)::text AS total,
           count(*) FILTER (WHERE in_scope)::text AS in_scope,
           count(*) FILTER (WHERE NOT in_scope)::text AS out_of_scope,
           count(*) FILTER (WHERE website_url IS NOT NULL)::text AS with_website,
           count(*) FILTER (WHERE website_url IS NULL)::text AS without_website,
           (SELECT count(DISTINCT business_id) FROM review_signals)::text AS with_reviews
         FROM businesses WHERE status = 'active'`,
      ),
      queryOne<Record<string, string>>(
        `SELECT count(*)::text AS indexed,
                avg(opportunity)::text AS avg_opportunity,
                max(opportunity)::text AS top_score
           FROM search_index`,
      ),
      queryOne<Record<string, string>>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours')::text AS last_24h,
                count(*) FILTER (WHERE NOT ok)::text AS failed,
                (SELECT count(*) FROM website_issues)::text AS issues
           FROM website_audits`,
      ),
      queryOne<Record<string, string>>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE cache_hit)::text AS hits,
                COALESCE(sum(estimated_cost_usd), 0)::text AS cost
           FROM ai_usage_events`,
      ),
      query<Record<string, string>>(
        `SELECT provider,
                count(*)::text AS calls,
                count(*) FILTER (WHERE cache_hit)::text AS hits,
                COALESCE(sum(estimated_cost_usd), 0)::text AS cost
           FROM ai_usage_events GROUP BY provider`,
      ),
      queryOne<Record<string, string>>('SELECT count(*)::text AS total FROM demos'),
      queryOne<Record<string, string>>(
        `SELECT
           count(*) FILTER (WHERE status = 'queued')::text  AS queued,
           count(*) FILTER (WHERE status = 'running')::text AS running,
           count(*) FILTER (WHERE status = 'failed')::text  AS failed,
           count(*) FILTER (WHERE status = 'done')::text    AS done
         FROM crawl_jobs`,
      ),
      query<Record<string, string>>(
        `SELECT category, category_label, count(*)::text AS count, avg(opportunity)::text AS avg_opp
           FROM search_index GROUP BY category, category_label
          ORDER BY count(*) DESC LIMIT 8`,
      ),
      crmCounts(),
    ]);

  const totalCalls = num(aiStats?.total);
  const cacheHits = num(aiStats?.hits);

  return {
    scope: { city: scope.displayName, minLocationConfidence: config.geo.minLocationConfidence },
    businesses: {
      total: num(businessStats?.total),
      inScope: num(businessStats?.in_scope),
      outOfScope: num(businessStats?.out_of_scope),
      withWebsite: num(businessStats?.with_website),
      withoutWebsite: num(businessStats?.without_website),
      withReviewSignals: num(businessStats?.with_reviews),
    },
    index: {
      indexed: num(indexStats?.indexed),
      averageOpportunity: indexStats?.avg_opportunity ? Number(Number(indexStats.avg_opportunity).toFixed(1)) : null,
      topScore: indexStats?.top_score ? Number(Number(indexStats.top_score).toFixed(1)) : null,
    },
    audits: {
      total: num(auditStats?.total),
      last24h: num(auditStats?.last_24h),
      failed: num(auditStats?.failed),
      issuesFound: num(auditStats?.issues),
    },
    ai: {
      totalCalls,
      cacheHits,
      cacheHitRate: totalCalls === 0 ? 0 : Number((cacheHits / totalCalls).toFixed(3)),
      estimatedCostUsd: Number(num(aiStats?.cost).toFixed(4)),
      byProvider: aiByProvider.map((row) => ({
        provider: String(row.provider),
        calls: num(row.calls),
        cacheHits: num(row.hits),
        costUsd: Number(num(row.cost).toFixed(4)),
      })),
    },
    demos: { total: num(demoStats?.total) },
    crm,
    jobs: {
      queued: num(jobStats?.queued),
      running: num(jobStats?.running),
      failed: num(jobStats?.failed),
      done: num(jobStats?.done),
    },
    topCategories: categories.map((row) => ({
      category: String(row.category),
      label: String(row.category_label),
      count: num(row.count),
      averageOpportunity: Number(num(row.avg_opp).toFixed(1)),
    })),
  };
}
