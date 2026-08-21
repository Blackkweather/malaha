import { claudeEnabled, config, groqEnabled } from '../config';
import { query } from '../db/pool';
import { logger } from '../logger';
import { CATEGORY_BY_KEY, OTHER_CATEGORY } from '../normalize/category';
import { getBusinessDetail } from '../repo/businesses';
import { scoreBusiness } from '../pipeline/score';
import { refreshSearchIndex } from '../pipeline/searchIndex';
import { runWebsiteJob } from '../pipeline/websiteJob';
import { analyseDeepFree } from './deepPass';
import { analyseWithClaude, type ClaudeAnalysis } from './claude';
import { analyseWithGroq, type GroqAnalysis } from './groq';
import type { EvidencePackage } from './prompts';

export interface DeepAnalyzeStep {
  step: string;
  status: 'ok' | 'skipped' | 'failed';
  detail: string;
  durationMs: number;
}

export interface DeepAnalyzeResult {
  businessId: string;
  steps: DeepAnalyzeStep[];
  groq: { output: GroqAnalysis; cacheHit: boolean; model: string } | null;
  claude: { output: ClaudeAnalysis; cacheHit: boolean; model: string } | null;
  opportunity: number | null;
  completed: boolean;
}

/** Builds the compact, factual evidence package sent to the models. */
export async function buildEvidencePackage(businessId: string): Promise<EvidencePackage | null> {
  const detail = await getBusinessDetail(businessId);
  if (!detail) return null;

  const category = CATEGORY_BY_KEY.get(detail.business.category) ?? OTHER_CATEGORY;
  const bestReview = detail.reviews[0] ?? null;

  return {
    business: {
      name: detail.business.name,
      category: detail.business.category,
      categoryLabel: category.label,
      city: detail.business.city,
      postalCode: detail.business.postal_code,
      address: detail.business.address,
      phone: detail.business.primary_phone,
      email: detail.business.primary_email,
      website: detail.business.website_url,
      description: detail.business.description,
    },
    reputation: {
      rating: bestReview?.rating ?? null,
      reviewCount: bestReview?.review_count ?? null,
      sources: detail.reviews.map((r) => r.source),
    },
    scores: {
      businessQuality: detail.score?.business_quality ?? 0,
      commercialValue: detail.score?.commercial_value ?? 0,
      digitalOpportunity: detail.score?.digital_opportunity ?? 0,
      opportunity: detail.score?.opportunity ?? 0,
    },
    website: detail.website
      ? {
          reachable: detail.website.reachable === true,
          verdict: detail.audit?.verdict ?? null,
          metrics: (detail.audit?.metrics as Record<string, unknown>) ?? null,
          issues: detail.issues.map((i) => ({ code: i.code, title: i.title, severity: i.severity })),
          pages: detail.pages.map((p) => ({
            url: p.url,
            type: p.page_type,
            title: p.title,
            excerpt: '',
          })),
        }
      : null,
    socialProfiles: detail.socials.map((s) => ({ platform: s.platform, url: s.url })),
  };
}

async function logEvent(
  businessId: string,
  eventType: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info',
): Promise<void> {
  await query(
    'INSERT INTO crawl_events (business_id, event_type, level, message) VALUES ($1, $2, $3, $4)',
    [businessId, eventType, level, message],
  ).catch(() => undefined);
}

/**
 * The DEEP ANALYZE flow.
 *
 * Runs only on explicit request. Refreshes the website evidence, re-audits,
 * builds a compact evidence package, runs the Groq fast pass, and escalates to
 * Claude only when the prospect is strong enough to justify the cost.
 */
export async function deepAnalyze(businessId: string): Promise<DeepAnalyzeResult> {
  const steps: DeepAnalyzeStep[] = [];
  const result: DeepAnalyzeResult = {
    businessId,
    steps,
    groq: null,
    claude: null,
    opportunity: null,
    completed: false,
  };

  const track = async <T>(
    name: string,
    fn: () => Promise<{ status: DeepAnalyzeStep['status']; detail: string; value?: T }>,
  ): Promise<T | undefined> => {
    const started = Date.now();
    try {
      const outcome = await fn();
      steps.push({
        step: name,
        status: outcome.status,
        detail: outcome.detail,
        durationMs: Date.now() - started,
      });
      await logEvent(businessId, 'deep_analyze.' + name, outcome.detail);
      return outcome.value;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      steps.push({ step: name, status: 'failed', detail, durationMs: Date.now() - started });
      await logEvent(businessId, 'deep_analyze.' + name, detail, 'error');
      return undefined;
    }
  };

  // 1 + 2. Refresh website information and run the technical audit.
  await track('website_audit', async () => {
    const job = await runWebsiteJob(businessId);
    if (job.skipped) return { status: 'skipped' as const, detail: job.skipped };
    const pages = job.audit?.pages.length ?? 0;
    const issues = job.audit?.issueCodes.length ?? 0;
    return { status: 'ok' as const, detail: `Audited ${pages} pages and found ${issues} issues` };
  });

  // 3. Recompute the deterministic scores from the fresh audit.
  await track('rescore', async () => {
    const scored = await scoreBusiness(businessId);
    result.opportunity = scored?.result.opportunity ?? null;
    return {
      status: 'ok' as const,
      detail: `Opportunity score is now ${scored?.result.opportunity ?? 'unknown'}`,
    };
  });

  // 4. Build the compact evidence package.
  const evidence = await track<EvidencePackage>('build_evidence', async () => {
    const built = await buildEvidencePackage(businessId);
    if (!built) return { status: 'failed' as const, detail: 'Business not found' };
    return { status: 'ok' as const, detail: 'Evidence package prepared', value: built };
  });

  if (!evidence) return result;

  // 5. Groq fast pass.
  const groq = await track<GroqAnalysis>('groq_analysis', async () => {
    if (!groqEnabled()) {
      return { status: 'skipped' as const, detail: 'GROQ_API_KEY is not configured' };
    }
    const call = await analyseWithGroq(businessId, evidence);
    if (!call) return { status: 'skipped' as const, detail: 'Groq is not enabled' };
    result.groq = { output: call.output, cacheHit: call.cacheHit, model: call.model };
    return {
      status: 'ok' as const,
      detail: call.cacheHit
        ? 'Reused the cached Groq analysis'
        : `Groq analysed the business in ${call.latencyMs} ms`,
      value: call.output,
    };
  });

  // 6. Escalate to Claude only when the prospect justifies the cost.
  await track('claude_analysis', async () => {
    const opportunity = result.opportunity ?? 0;
    if (opportunity < config.search.minOpportunityScore) {
      return {
        status: 'skipped' as const,
        detail: `Opportunity score ${opportunity} is below the escalation threshold of ${config.search.minOpportunityScore}`,
      };
    }
    if (groq && !groq.recommendForDeepAnalysis && opportunity < 70) {
      return {
        status: 'skipped' as const,
        detail: 'The fast pass did not recommend deep analysis for this prospect',
      };
    }

    /*
     * Anthropic when a key is present, otherwise the same prompt on the best
     * free model the router can reach. The brief is what matters downstream,
     * not which vendor produced it.
     */
    const call = claudeEnabled()
      ? await analyseWithClaude(businessId, evidence, groq ?? null)
      : await analyseDeepFree(businessId, evidence, groq ?? null);
    if (!call) {
      return { status: 'skipped' as const, detail: 'No analysis provider is configured' };
    }
    result.claude = { output: call.output, cacheHit: call.cacheHit, model: call.model };
    return {
      status: 'ok' as const,
      detail: call.cacheHit
        ? 'Reused the cached Claude analysis'
        : `Claude produced the prospect brief in ${call.latencyMs} ms`,
    };
  });

  // 7. Make the refreshed scores visible to search.
  await track('reindex', async () => {
    const report = await refreshSearchIndex();
    return { status: 'ok' as const, detail: `Search index refreshed (${report.indexed} indexed)` };
  });

  result.completed = true;
  logger.info('deep analysis complete', { businessId, opportunity: result.opportunity });
  return result;
}
