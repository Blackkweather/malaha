import { claudeEnabled, config } from '../config';
import { logger } from '../logger';
import {
  buildCacheKey,
  estimateCost,
  getCachedAnalysis,
  hashEvidence,
  recordUsage,
  storeAnalysis,
} from './cache';
import { asEnum, asNumberInRange, asObjectArray, asString, asStringArray, extractJson } from './json';
import type { AiCallResult } from './groq';
import { buildClaudePrompt, CLAUDE_SYSTEM_PROMPT, compactEvidence, type EvidencePackage } from './prompts';

export interface ClaudeAnalysis {
  currentWebsiteExperience: string;
  businessPositioning: string;
  strongestOpportunities: { title: string; why: string; impact: 'low' | 'medium' | 'high' }[];
  customerJourneyFriction: string[];
  redesignPriorities: { priority: number; item: string; rationale: string }[];
  recommendedSiteStructure: { page: string; purpose: string }[];
  recommendedPrimaryCta: string;
  salesAngle: string;
  whyWorthApproaching: string;
  risks: string[];
  verdict: 'strong' | 'moderate' | 'weak';
  confidence: number;
}

const IMPACTS = ['low', 'medium', 'high'] as const;
const VERDICTS = ['strong', 'moderate', 'weak'] as const;

/** Validates and coerces raw model output into a ClaudeAnalysis. */
export function validateClaudeAnalysis(raw: unknown): ClaudeAnalysis {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Claude returned a non-object response');
  }
  const o = raw as Record<string, unknown>;

  const analysis: ClaudeAnalysis = {
    currentWebsiteExperience: asString(o.currentWebsiteExperience),
    businessPositioning: asString(o.businessPositioning),
    strongestOpportunities: asObjectArray(o.strongestOpportunities)
      .slice(0, 8)
      .map((item) => ({
        title: asString(item.title),
        why: asString(item.why),
        impact: asEnum(item.impact, IMPACTS, 'medium'),
      }))
      .filter((item) => item.title !== ''),
    customerJourneyFriction: asStringArray(o.customerJourneyFriction).slice(0, 10),
    redesignPriorities: asObjectArray(o.redesignPriorities)
      .slice(0, 10)
      .map((item, index) => ({
        priority: asNumberInRange(item.priority, 1, 20, index + 1),
        item: asString(item.item),
        rationale: asString(item.rationale),
      }))
      .filter((item) => item.item !== ''),
    recommendedSiteStructure: asObjectArray(o.recommendedSiteStructure)
      .slice(0, 12)
      .map((item) => ({ page: asString(item.page), purpose: asString(item.purpose) }))
      .filter((item) => item.page !== ''),
    recommendedPrimaryCta: asString(o.recommendedPrimaryCta),
    salesAngle: asString(o.salesAngle),
    whyWorthApproaching: asString(o.whyWorthApproaching),
    risks: asStringArray(o.risks).slice(0, 8),
    verdict: asEnum(o.verdict, VERDICTS, 'moderate'),
    confidence: asNumberInRange(o.confidence, 0, 1, 0.5),
  };

  // A brief with no substance is a failed call, not a usable result.
  if (!analysis.salesAngle && !analysis.whyWorthApproaching) {
    throw new Error('Claude response was missing its core fields');
  }

  return analysis;
}

/**
 * Runs the deep Claude analysis for one strong prospect.
 *
 * Claude is the most expensive stage, so it is reached only by candidates that
 * already survived deterministic scoring and the Groq pass, and its results are
 * cached on the same evidence hash.
 */
export async function analyseWithClaude(
  businessId: string,
  evidence: EvidencePackage,
  groqAnalysis: unknown,
): Promise<AiCallResult<ClaudeAnalysis> | null> {
  if (!claudeEnabled()) return null;

  const compact = compactEvidence(evidence);
  const contentHash = hashEvidence({ evidence: compact, groq: groqAnalysis });
  const model = config.ai.claude.model;
  const cacheKey = buildCacheKey({
    businessId,
    provider: 'claude',
    stage: 'deep_analysis',
    model,
    promptVersion: config.ai.claude.promptVersion,
    auditVersion: config.audit.version,
    contentHash,
  });

  const cached = await getCachedAnalysis<ClaudeAnalysis>(cacheKey);
  if (cached) {
    await recordUsage({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      model,
      cacheHit: true,
      estimatedCostUsd: 0,
    });
    return {
      output: cached.output,
      cacheHit: true,
      model: cached.model,
      latencyMs: 0,
      estimatedCostUsd: 0,
    };
  }

  const started = Date.now();
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ai.claude.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        // No temperature/top_p/top_k: sampling parameters are removed on
        // current models and return a 400. Steer with the prompt instead.
        thinking: { type: 'adaptive' },
        system: CLAUDE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildClaudePrompt(compact, groqAnalysis) }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Anthropic API returned ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const output = validateClaudeAnalysis(extractJson(text));

    const latencyMs = Date.now() - started;
    const promptTokens = payload.usage?.input_tokens ?? null;
    const completionTokens = payload.usage?.output_tokens ?? null;
    const estimatedCostUsd = estimateCost(model, promptTokens, completionTokens);

    await storeAnalysis({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      cacheKey,
      model,
      promptVersion: config.ai.claude.promptVersion,
      auditVersion: config.audit.version,
      contentHash,
      inputSummary: { name: evidence.business.name, opportunity: evidence.scores.opportunity },
      output,
      latencyMs,
      promptTokens,
      completionTokens,
      estimatedCostUsd,
    });

    await recordUsage({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      model,
      cacheHit: false,
      latencyMs,
      promptTokens,
      completionTokens,
      estimatedCostUsd,
    });

    return { output, cacheHit: false, model, latencyMs, estimatedCostUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Claude analysis failed', { businessId, error: message });
    await recordUsage({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      model,
      cacheHit: false,
      latencyMs: Date.now() - started,
      error: message,
    });
    throw err;
  }
}
