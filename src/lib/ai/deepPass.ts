import { config } from '../config';
import { logger } from '../logger';
import {
  buildCacheKey,
  estimateCost,
  getCachedAnalysis,
  hashEvidence,
  recordUsage,
  storeAnalysis,
} from './cache';
import { validateClaudeAnalysis, type ClaudeAnalysis } from './claude';
import type { AiCallResult } from './groq';
import { extractJson } from './json';
import {
  buildClaudePrompt,
  CLAUDE_SYSTEM_PROMPT,
  compactEvidence,
  type EvidencePackage,
} from './prompts';
import { routeJson, routerModel } from './router';

/**
 * The deep analysis pass, run on whatever capable model is actually reachable.
 *
 * The deep pass used to require an Anthropic key, so with none configured it
 * skipped on every single run — and everything downstream quietly degraded:
 * the generated concept lost its positioning line and recommended call to
 * action, falling back to a generic category label.
 *
 * The prospect brief matters more than which vendor produces it. This runs the
 * same prompt and returns the same validated shape through the gateway (and its
 * Groq fallback), so the pass works on the free tier. `claude.ts` remains the
 * Anthropic path and is preferred whenever a key is present; this is what runs
 * when there isn't one.
 */
export async function analyseDeepFree(
  businessId: string,
  evidence: EvidencePackage,
  groqAnalysis: unknown,
): Promise<AiCallResult<ClaudeAnalysis> | null> {
  const compact = compactEvidence(evidence);
  const contentHash = hashEvidence(compact);
  const model = routerModel('analyse');

  /*
   * Keyed by the model that produced it, so switching providers — or adding an
   * Anthropic key later — re-runs the pass rather than serving another model's
   * brief out of cache.
   */
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
      model: cached.model,
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
  const result = await routeJson(
    'analyse',
    CLAUDE_SYSTEM_PROMPT,
    buildClaudePrompt(compact, groqAnalysis),
    { temperature: 0.3, maxTokens: 3000, tags: ['stage:deep_analysis'] },
  );

  // No gateway credential and no Groq key: the caller reports this as skipped
  // rather than failed, because an unconfigured provider is not an error.
  if (!result) return null;

  try {
    const output = validateClaudeAnalysis(extractJson(result.text));
    const latencyMs = Date.now() - started;
    const estimatedCostUsd = estimateCost(result.model, result.promptTokens, result.completionTokens);

    await storeAnalysis({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      cacheKey,
      model: result.model,
      promptVersion: config.ai.claude.promptVersion,
      auditVersion: config.audit.version,
      contentHash,
      inputSummary: { name: evidence.business.name, category: evidence.business.category },
      output,
      latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCostUsd,
    });

    await recordUsage({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      model: result.model,
      cacheHit: false,
      latencyMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCostUsd,
    });

    return { output, cacheHit: false, model: result.model, latencyMs, estimatedCostUsd };
  } catch (err) {
    /*
     * A malformed brief must not fail the whole run: the audit, the score and
     * the fast pass are all still valid without it.
     */
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('deep analysis returned an unusable response', { businessId, error: message });
    await recordUsage({
      businessId,
      provider: 'claude',
      stage: 'deep_analysis',
      model: result.model,
      cacheHit: false,
      latencyMs: Date.now() - started,
      error: message,
    });
    return null;
  }
}
