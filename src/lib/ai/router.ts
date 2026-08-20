import { config } from '../config';
import { logger } from '../logger';

/**
 * Model routing through Vercel AI Gateway.
 *
 * The reason this exists: the app previously called Groq directly with one
 * hard-coded model id, and when Groq retired that model every AI feature
 * returned 404 in production. One provider with one model is a single point of
 * failure.
 *
 * The gateway removes that. A single credential — the Vercel OIDC token that
 * `vercel env pull` already writes — reaches ~320 models across providers, and
 * switching model is a string change rather than a new integration. When the
 * primary model is unavailable the gateway fails over to the next.
 *
 * It degrades rather than breaks: with no credential, no billing card on the
 * Vercel team, or a network failure, callers fall back to the direct Groq path.
 */

export type RouterTask = 'classify' | 'analyse' | 'write';

/**
 * Model per task, cheapest capable model first.
 *
 * These are the models the AI Gateway free tier actually serves. Probed on
 * 2026-08-20: the gpt-oss pair answers normally, while claude-haiku-4.5 and
 * claude-sonnet-4.6 return 'Free tier users do not have access to this
 * model', and the gemini, llama, deepseek, mistral and glm families are
 * rate-limited to the point of being unusable. Defaulting to a model the
 * account cannot call is how the Groq outage happened in the first place.
 *
 * Buying credits unlocks the stronger models without a deploy: set
 * AI_MODEL_WRITE=anthropic/claude-sonnet-4.6 (or ANALYSE/CLASSIFY) and the
 * override below picks it up.
 *
 * Classification is structured extraction that a small model handles well, so
 * a frontier model there is waste. Copy a business owner will actually read is
 * worth the stronger one.
 */
const MODELS: Record<RouterTask, { primary: string; fallbacks: string[] }> = {
  classify: {
    primary: 'openai/gpt-oss-20b',
    fallbacks: ['openai/gpt-oss-120b'],
  },
  analyse: {
    primary: 'openai/gpt-oss-120b',
    fallbacks: ['openai/gpt-oss-20b'],
  },
  write: {
    primary: 'openai/gpt-oss-120b',
    fallbacks: ['openai/gpt-oss-20b'],
  },
};

export function routerModel(task: RouterTask): string {
  const override = process.env[`AI_MODEL_${task.toUpperCase()}`];
  return override && override.trim() !== '' ? override.trim() : MODELS[task].primary;
}

/**
 * Whether the gateway can be used at all.
 *
 * Checked per call rather than cached at module load: the OIDC token is
 * refreshed periodically, and a deployment can gain the credential without a
 * rebuild.
 */
export function gatewayConfigured(): boolean {
  return (
    (process.env.AI_GATEWAY_API_KEY ?? '').trim() !== '' ||
    (process.env.VERCEL_OIDC_TOKEN ?? '').trim() !== ''
  );
}

export interface RouterResult {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * Generates text through the gateway.
 *
 * Returns null — never throws — when the gateway is unavailable or refuses the
 * request, so callers can fall back to the direct provider without wrapping
 * every call site in a try/catch.
 */
export async function routeJson(
  task: RouterTask,
  system: string,
  prompt: string,
  options: { temperature?: number; maxTokens?: number; tags?: string[] } = {},
): Promise<RouterResult | null> {
  if (!gatewayConfigured()) return null;

  try {
    // Imported lazily so the AI SDK never loads on request paths that do not
    // use it — search in particular must stay free of this weight.
    const { generateText } = await import('ai');
    const chosen = routerModel(task);

    const result = await generateText({
      model: chosen,
      system,
      prompt,
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 1200,
      providerOptions: {
        gateway: {
          models: MODELS[task].fallbacks,
          tags: ['app:malaga-prospect-finder', `task:${task}`, ...(options.tags ?? [])],
        },
      },
    });

    return {
      text: result.text,
      model: chosen,
      promptTokens: result.usage?.inputTokens ?? null,
      completionTokens: result.usage?.outputTokens ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A missing billing card, a rate limit and a network blip all arrive here.
    // None of them should take a feature offline while Groq still answers.
    logger.warn('AI Gateway call failed; falling back to the direct provider', {
      task,
      error: message.slice(0, 200),
    });
    return null;
  }
}

/** Which providers are actually usable, for the health and settings views. */
export function routerStatus(): {
  gateway: boolean;
  groq: boolean;
  models: Record<RouterTask, string>;
} {
  return {
    gateway: gatewayConfigured(),
    groq: config.ai.groq.apiKey.trim().length > 0,
    models: {
      classify: routerModel('classify'),
      analyse: routerModel('analyse'),
      write: routerModel('write'),
    },
  };
}
