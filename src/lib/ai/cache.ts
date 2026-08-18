import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool';
import { logger } from '../logger';

export type AiProvider = 'groq' | 'claude';

export interface CacheKeyParts {
  businessId: string;
  provider: AiProvider;
  stage: string;
  model: string;
  promptVersion: number;
  auditVersion: number;
  /** Hash of the evidence actually sent to the model. */
  contentHash: string;
}

export interface CachedAnalysis<T = unknown> {
  id: string;
  output: T;
  model: string;
  createdAt: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
}

export interface UsageRecord {
  businessId: string | null;
  provider: AiProvider;
  stage: string;
  model: string;
  cacheHit: boolean;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  estimatedCostUsd?: number | null;
  error?: string | null;
}

/**
 * Deterministic cache key.
 *
 * Every input that can change the answer is part of the key: the business, the
 * audit version, the hash of the evidence package, the prompt version and the
 * model. Change any of them and the cache misses; change none and the stored
 * result is reused without calling the provider.
 */
export function buildCacheKey(parts: CacheKeyParts): string {
  const canonical = [
    parts.provider,
    parts.stage,
    parts.businessId,
    parts.model,
    `p${parts.promptVersion}`,
    `a${parts.auditVersion}`,
    parts.contentHash,
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Stable hash of an evidence package, insensitive to key ordering. */
export function hashEvidence(evidence: unknown): string {
  const canonical = JSON.stringify(evidence, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (value as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return value;
  });
  return crypto.createHash('sha256').update(canonical ?? '').digest('hex');
}

export async function getCachedAnalysis<T>(cacheKey: string): Promise<CachedAnalysis<T> | null> {
  const row = await queryOne<{
    id: string;
    output: T;
    model: string;
    created_at: Date;
    latency_ms: number | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    estimated_cost_usd: string | null;
  }>(
    `SELECT id, output, model, created_at, latency_ms, prompt_tokens, completion_tokens, estimated_cost_usd
       FROM ai_analyses WHERE cache_key = $1`,
    [cacheKey],
  );
  if (!row) return null;

  return {
    id: row.id,
    output: row.output,
    model: row.model,
    createdAt: row.created_at.toISOString(),
    latencyMs: row.latency_ms,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd),
  };
}

export async function storeAnalysis(params: {
  businessId: string;
  provider: AiProvider;
  stage: string;
  cacheKey: string;
  model: string;
  promptVersion: number;
  auditVersion: number;
  contentHash: string;
  inputSummary: unknown;
  output: unknown;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUsd: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO ai_analyses (
       business_id, provider, stage, cache_key, model, prompt_version, audit_version,
       content_hash, input_summary, output, latency_ms, prompt_tokens, completion_tokens,
       estimated_cost_usd
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
     ON CONFLICT (cache_key) DO UPDATE SET
       output = EXCLUDED.output, latency_ms = EXCLUDED.latency_ms,
       prompt_tokens = EXCLUDED.prompt_tokens, completion_tokens = EXCLUDED.completion_tokens,
       estimated_cost_usd = EXCLUDED.estimated_cost_usd, updated_at = now()`,
    [
      params.businessId,
      params.provider,
      params.stage,
      params.cacheKey,
      params.model,
      params.promptVersion,
      params.auditVersion,
      params.contentHash,
      JSON.stringify(params.inputSummary ?? {}),
      JSON.stringify(params.output ?? {}),
      params.latencyMs,
      params.promptTokens,
      params.completionTokens,
      params.estimatedCostUsd,
    ],
  );
}

/** Records a cache hit or miss with its cost, for the dashboard. */
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    await query(
      `INSERT INTO ai_usage_events (
         business_id, provider, stage, model, cache_hit, latency_ms,
         prompt_tokens, completion_tokens, estimated_cost_usd, error
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        record.businessId,
        record.provider,
        record.stage,
        record.model,
        record.cacheHit,
        record.latencyMs ?? null,
        record.promptTokens ?? null,
        record.completionTokens ?? null,
        record.estimatedCostUsd ?? null,
        record.error ?? null,
      ],
    );
  } catch (err) {
    // Telemetry must never break the analysis it is measuring.
    logger.warn('failed to record AI usage event', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Published per-million-token prices used for cost estimation.
 *
 * An unpriced model is not an error — `estimateCost` returns null and the cost
 * is reported as unknown rather than guessed. The retired Llama entries are
 * kept so historical usage rows still resolve to the price actually paid.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
  'openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  // Retired by Groq — retained so historical usage records still price.
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-opus-4-5': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export function estimateCost(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing || promptTokens === null || completionTokens === null) return null;
  const cost = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
  return Number(cost.toFixed(6));
}
