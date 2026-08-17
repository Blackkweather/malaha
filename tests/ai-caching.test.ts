import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { query } from '../src/lib/db/pool';
import { loadFixtures, MALAGA_FIXTURES, resetDatabase } from './helpers/fixtures';
import type { EvidencePackage } from '../src/lib/ai/prompts';

/**
 * Exercises the real caching path: the first call reaches the provider, every
 * identical call afterwards is served from the database.
 */
const GROQ_PAYLOAD = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          categoryNormalized: 'dental_clinic',
          categoryConfidence: 0.95,
          services: ['implantes'],
          targetCustomer: 'Adultos',
          websiteSummary: 'Sitio anticuado.',
          issueClassification: [],
          opportunitySignals: ['Reputacion muy alta'],
          estimatedProjectValue: 'high',
          recommendForDeepAnalysis: true,
          confidence: 0.9,
        }),
      },
    },
  ],
  usage: { prompt_tokens: 1200, completion_tokens: 300 },
};

function evidenceFor(name: string): EvidencePackage {
  return {
    business: {
      name,
      category: 'dental_clinic',
      categoryLabel: 'Dental clinic',
      city: 'Malaga',
      postalCode: '29005',
      address: 'Calle Larios 1',
      phone: '+34951000101',
      email: null,
      website: null,
      description: null,
    },
    reputation: { rating: 4.9, reviewCount: 820, sources: ['test'] },
    scores: { businessQuality: 90, commercialValue: 96, digitalOpportunity: 62, opportunity: 80 },
    website: null,
    socialProfiles: [],
  };
}

let businessId: string;

beforeAll(async () => {
  await resetDatabase();
  await loadFixtures(MALAGA_FIXTURES);
  const rows = await query<{ id: string }>(
    "SELECT id FROM businesses WHERE name LIKE '%Dental Fixture Uno%' LIMIT 1",
  );
  businessId = rows[0].id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Groq caching', () => {
  it('calls the provider once, then serves identical requests from cache', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_unit_tests_only');
    vi.resetModules();

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(GROQ_PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { analyseWithGroq } = await import('../src/lib/ai/groq');
    const evidence = evidenceFor('Clinica Dental Fixture Uno');

    const first = await analyseWithGroq(businessId, evidence);
    expect(first).not.toBeNull();
    expect(first?.cacheHit).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await analyseWithGroq(businessId, evidence);
    expect(second?.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second?.output.estimatedProjectValue).toBe('high');
  });

  it('records the analysis, its token usage and its estimated cost', async () => {
    const analyses = await query<{ provider: string; prompt_tokens: number; estimated_cost_usd: string }>(
      'SELECT provider, prompt_tokens, estimated_cost_usd FROM ai_analyses WHERE business_id = $1',
      [businessId],
    );
    expect(analyses).toHaveLength(1);
    expect(analyses[0].provider).toBe('groq');
    expect(analyses[0].prompt_tokens).toBe(1200);
    expect(Number(analyses[0].estimated_cost_usd)).toBeGreaterThan(0);
  });

  it('records one cache miss and one cache hit', async () => {
    const events = await query<{ cache_hit: boolean }>(
      'SELECT cache_hit FROM ai_usage_events WHERE business_id = $1 ORDER BY created_at',
      [businessId],
    );
    expect(events).toHaveLength(2);
    expect(events[0].cache_hit).toBe(false);
    expect(events[1].cache_hit).toBe(true);
  });

  it('misses the cache when the evidence changes', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_unit_tests_only');
    vi.resetModules();

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(GROQ_PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { analyseWithGroq } = await import('../src/lib/ai/groq');
    const changed = evidenceFor('Clinica Dental Fixture Uno');
    changed.reputation.reviewCount = 999;

    const result = await analyseWithGroq(businessId, changed);
    expect(result?.cacheHit).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('providers when not configured', () => {
  it('returns null instead of calling out', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.resetModules();

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { analyseWithGroq } = await import('../src/lib/ai/groq');
    const { analyseWithClaude } = await import('../src/lib/ai/claude');

    expect(await analyseWithGroq(businessId, evidenceFor('X'))).toBeNull();
    expect(await analyseWithClaude(businessId, evidenceFor('X'), null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('provider failures', () => {
  it('surfaces an API error and records it without caching a bad result', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk_test_key_for_unit_tests_only');
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    );

    const { analyseWithGroq } = await import('../src/lib/ai/groq');
    const evidence = evidenceFor('Fixture Abogados Asociados');
    evidence.reputation.reviewCount = 12345;

    await expect(analyseWithGroq(businessId, evidence)).rejects.toThrow(/429/);

    const failures = await query<{ error: string | null }>(
      'SELECT error FROM ai_usage_events WHERE error IS NOT NULL AND business_id = $1',
      [businessId],
    );
    expect(failures.length).toBeGreaterThan(0);
  });
});
