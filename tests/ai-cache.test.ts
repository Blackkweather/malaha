import { describe, expect, it } from 'vitest';
import { buildCacheKey, estimateCost, hashEvidence, MODEL_PRICING } from '../src/lib/ai/cache';
import { extractJson, asEnum, asNumberInRange, asStringArray } from '../src/lib/ai/json';

const BASE_KEY = {
  businessId: 'b1',
  provider: 'groq' as const,
  stage: 'classification',
  model: 'llama-3.3-70b-versatile',
  promptVersion: 2,
  auditVersion: 3,
  contentHash: 'abc',
};

describe('AI cache keys', () => {
  it('is stable for identical inputs', () => {
    expect(buildCacheKey(BASE_KEY)).toBe(buildCacheKey({ ...BASE_KEY }));
  });

  it('changes when any input that can change the answer changes', () => {
    const key = buildCacheKey(BASE_KEY);
    expect(buildCacheKey({ ...BASE_KEY, businessId: 'b2' })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, contentHash: 'def' })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, promptVersion: 3 })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, auditVersion: 4 })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, model: 'other' })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, provider: 'claude' })).not.toBe(key);
    expect(buildCacheKey({ ...BASE_KEY, stage: 'deep_analysis' })).not.toBe(key);
  });

  it('hashes evidence independently of key ordering', () => {
    expect(hashEvidence({ a: 1, b: { c: 2, d: 3 } })).toBe(hashEvidence({ b: { d: 3, c: 2 }, a: 1 }));
    expect(hashEvidence({ a: 1 })).not.toBe(hashEvidence({ a: 2 }));
  });

  it('estimates cost from published per-million prices', () => {
    const model = 'claude-sonnet-4-5';
    const pricing = MODEL_PRICING[model];
    expect(estimateCost(model, 1000000, 1000000)).toBeCloseTo(pricing.input + pricing.output, 5);
    expect(estimateCost('unknown-model', 100, 100)).toBeNull();
    expect(estimateCost(model, null, 10)).toBeNull();
  });
});

describe('model output parsing', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('recovers JSON from a fenced block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recovers JSON surrounded by prose', () => {
    expect(extractJson('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  it('throws on unusable output', () => {
    expect(() => extractJson('not json at all')).toThrow();
    expect(() => extractJson('')).toThrow();
  });

  it('coerces primitives safely', () => {
    expect(asStringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
    expect(asStringArray('nope')).toEqual([]);
    expect(asNumberInRange(5, 0, 1, 0.5)).toBe(1);
    expect(asNumberInRange('x', 0, 1, 0.5)).toBe(0.5);
    expect(asEnum('high', ['low', 'high'] as const, 'low')).toBe('high');
    expect(asEnum('bogus', ['low', 'high'] as const, 'low')).toBe('low');
  });
});
