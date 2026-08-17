import { config, groqEnabled } from '../config';
import { logger } from '../logger';
import {
  buildCacheKey,
  estimateCost,
  getCachedAnalysis,
  hashEvidence,
  recordUsage,
  storeAnalysis,
} from './cache';
import {
  asEnum,
  asNumberInRange,
  asObjectArray,
  asString,
  asStringArray,
  extractJson,
} from './json';
import { buildGroqPrompt, compactEvidence, GROQ_SYSTEM_PROMPT, type EvidencePackage } from './prompts';

export interface GroqAnalysis {
  categoryNormalized: string;
  categoryConfidence: number;
  services: string[];
  targetCustomer: string;
  websiteSummary: string;
  issueClassification: {
    code: string;
    area: string;
    impact: 'low' | 'medium' | 'high';
    explanation: string;
  }[];
  opportunitySignals: string[];
  estimatedProjectValue: 'low' | 'medium' | 'high' | 'very_high';
  recommendForDeepAnalysis: boolean;
  confidence: number;
}

export interface AiCallResult<T> {
  output: T;
  cacheHit: boolean;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
}

const IMPACTS = ['low', 'medium', 'high'] as const;
const VALUES = ['low', 'medium', 'high', 'very_high'] as const;

/** Validates and coerces raw model output into a GroqAnalysis. */
export function validateGroqAnalysis(raw: unknown): GroqAnalysis {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Groq returned a non-object response');
  }
  const o = raw as Record<string, unknown>;

  return {
    categoryNormalized: asString(o.categoryNormalized, 'other'),
    categoryConfidence: asNumberInRange(o.categoryConfidence, 0, 1, 0.5),
    services: asStringArray(o.services).slice(0, 25),
    targetCustomer: asString(o.targetCustomer),
    websiteSummary: asString(o.websiteSummary),
    issueClassification: asObjectArray(o.issueClassification)
      .slice(0, 20)
      .map((item) => ({
        code: asString(item.code),
        area: asString(item.area, 'general'),
        impact: asEnum(item.impact, IMPACTS, 'medium'),
        explanation: asString(item.explanation),
      }))
      .filter((item) => item.code !== ''),
    opportunitySignals: asStringArray(o.opportunitySignals).slice(0, 15),
    estimatedProjectValue: asEnum(o.estimatedProjectValue, VALUES, 'medium'),
    recommendForDeepAnalysis: o.recommendForDeepAnalysis === true,
    confidence: asNumberInRange(o.confidence, 0, 1, 0.5),
  };
}

/**
 * Runs the Groq fast-pass analysis for one business.
 *
 * Cached results are returned without contacting the provider. Groq is only
 * ever called on a pre-filtered candidate pool, never on every business.
 */
export async function analyseWithGroq(
  businessId: string,
  evidence: EvidencePackage,
): Promise<AiCallResult<GroqAnalysis> | null> {
  if (!groqEnabled()) return null;

  const compact = compactEvidence(evidence);
  const contentHash = hashEvidence(compact);
  const model = config.ai.groq.model;
  const cacheKey = buildCacheKey({
    businessId,
    provider: 'groq',
    stage: 'classification',
    model,
    promptVersion: config.ai.groq.promptVersion,
    auditVersion: config.audit.version,
    contentHash,
  });

  const cached = await getCachedAnalysis<GroqAnalysis>(cacheKey);
  if (cached) {
    await recordUsage({
      businessId,
      provider: 'groq',
      stage: 'classification',
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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.groq.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT },
          { role: 'user', content: buildGroqPrompt(compact) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content ?? '';
    const output = validateGroqAnalysis(extractJson(content));

    const latencyMs = Date.now() - started;
    const promptTokens = payload.usage?.prompt_tokens ?? null;
    const completionTokens = payload.usage?.completion_tokens ?? null;
    const estimatedCostUsd = estimateCost(model, promptTokens, completionTokens);

    await storeAnalysis({
      businessId,
      provider: 'groq',
      stage: 'classification',
      cacheKey,
      model,
      promptVersion: config.ai.groq.promptVersion,
      auditVersion: config.audit.version,
      contentHash,
      inputSummary: { name: evidence.business.name, category: evidence.business.category },
      output,
      latencyMs,
      promptTokens,
      completionTokens,
      estimatedCostUsd,
    });

    await recordUsage({
      businessId,
      provider: 'groq',
      stage: 'classification',
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
    logger.error('Groq analysis failed', { businessId, error: message });
    await recordUsage({
      businessId,
      provider: 'groq',
      stage: 'classification',
      model,
      cacheHit: false,
      latencyMs: Date.now() - started,
      error: message,
    });
    throw err;
  }
}
