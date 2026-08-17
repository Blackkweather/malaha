import { beforeAll, describe, expect, it, vi } from 'vitest';
import { search, resolveLimit, categoryForQuery, topProspects } from '../src/lib/search/search';
import { config } from '../src/lib/config';
import { query } from '../src/lib/db/pool';
import { loadFixtures, MALAGA_FIXTURES, rescoreAndIndex, resetDatabase } from './helpers/fixtures';

/**
 * The search path is the load-bearing guarantee of this application: it must be
 * fast, Malaga-only, and completely free of AI calls, crawling and any other
 * outbound network traffic.
 */
const OUT_OF_SCOPE = [
  {
    id: 'fx-marbella',
    name: 'Clinica Dental Marbella Fixture',
    category: 'clinica dental',
    address: 'Avenida Ricardo Soriano 40, 29601 Marbella',
    street: 'Avenida Ricardo Soriano 40',
    postal_code: '29601',
    city: 'Marbella',
    latitude: 36.5101,
    longitude: -4.8858,
    phone: '+34 951 000 201',
    rating: 5.0,
    review_count: 5000,
  },
  {
    id: 'fx-madrid',
    name: 'Clinica Dental Madrid Fixture',
    category: 'clinica dental',
    address: 'Gran Via 28, 28013 Madrid',
    postal_code: '28013',
    city: 'Madrid',
    province: 'Madrid',
    latitude: 40.42,
    longitude: -3.705,
    phone: '+34 910 000 202',
    rating: 5.0,
    review_count: 9000,
  },
];

beforeAll(async () => {
  await resetDatabase();
  await loadFixtures([...MALAGA_FIXTURES, ...OUT_OF_SCOPE]);
  await rescoreAndIndex();
});

describe('search isolation', () => {
  it('never performs any outbound network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await search({ q: 'dentist' });
      await search({ q: '' });
      await topProspects(25);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('never calls Groq or Claude', async () => {
    const groq = await import('../src/lib/ai/groq');
    const claude = await import('../src/lib/ai/claude');
    const groqSpy = vi.spyOn(groq, 'analyseWithGroq');
    const claudeSpy = vi.spyOn(claude, 'analyseWithClaude');
    try {
      await search({ q: 'dentist' });
      expect(groqSpy).not.toHaveBeenCalled();
      expect(claudeSpy).not.toHaveBeenCalled();
    } finally {
      groqSpy.mockRestore();
      claudeSpy.mockRestore();
    }
  });

  it('never crawls or audits a website', async () => {
    const audit = await import('../src/lib/website/audit');
    const fetcher = await import('../src/lib/website/fetch');
    const auditSpy = vi.spyOn(audit, 'auditWebsite');
    const fetchPageSpy = vi.spyOn(fetcher, 'fetchPage');
    try {
      await search({ q: 'abogados' });
      expect(auditSpy).not.toHaveBeenCalled();
      expect(fetchPageSpy).not.toHaveBeenCalled();
    } finally {
      auditSpy.mockRestore();
      fetchPageSpy.mockRestore();
    }
  });

  it('reads only the precomputed search index', async () => {
    // Emptying the index must empty the results, proving nothing is computed
    // live from the underlying business tables.
    await query('DELETE FROM search_index');
    const empty = await search({ q: 'dentist' });
    expect(empty.results).toHaveLength(0);

    await rescoreAndIndex();
    const restored = await search({ q: 'dentist' });
    expect(restored.results.length).toBeGreaterThan(0);
  });
});

describe('search is Malaga-only', () => {
  it('excludes businesses from other municipalities in the province', async () => {
    const results = await search({ q: 'dentist', limit: 25 });
    expect(results.results.some((r) => r.name.includes('Marbella'))).toBe(false);
  });

  it('excludes businesses from other provinces', async () => {
    const results = await search({ q: 'dentist', limit: 25 });
    expect(results.results.some((r) => r.name.includes('Madrid'))).toBe(false);
  });

  it('rejects them at ingestion, so they never reach storage or the index', async () => {
    // These fixtures have a perfect reputation (5.0 with thousands of reviews)
    // and would top the ranking, but they sit outside Malaga city. The backend
    // discards them during validation rather than filtering at query time.
    const stored = await query(
      "SELECT id FROM businesses WHERE name LIKE '%Marbella%' OR name LIKE '%Madrid%'",
    );
    expect(stored).toHaveLength(0);

    const indexed = await query(
      "SELECT si.business_id FROM search_index si JOIN businesses b ON b.id = si.business_id" +
        " WHERE b.name LIKE '%Marbella%' OR b.name LIKE '%Madrid%'",
    );
    expect(indexed).toHaveLength(0);
  });

  it('indexes nothing that is not verified as being in Malaga', async () => {
    const leaked = await query(
      'SELECT si.business_id FROM search_index si JOIN businesses b ON b.id = si.business_id' +
        ' WHERE b.in_scope = false',
    );
    expect(leaked).toHaveLength(0);
  });

  it('reports the configured city', async () => {
    expect((await search({ q: '' })).city).toBe('Malaga');
  });
});

describe('shortlist quality', () => {
  it('returns a small list by default', async () => {
    const results = await search({ q: '' });
    expect(results.limit).toBe(config.search.defaultLimit);
    expect(results.results.length).toBeLessThanOrEqual(config.search.defaultLimit);
  });

  it('caps the limit at the configured maximum', () => {
    expect(resolveLimit(1000)).toBe(config.search.maxLimit);
    expect(resolveLimit(undefined)).toBe(config.search.defaultLimit);
    expect(resolveLimit(0)).toBe(1);
  });

  it('never pads the list with weak businesses', async () => {
    const results = await search({ q: 'dentist', limit: 25 });
    // Only one Malaga dentist exists in the fixtures.
    expect(results.results).toHaveLength(1);
    expect(results.count).toBeLessThan(25);
    expect(results.note).toContain('not padded');
  });

  it('ranks the strongest prospect first', async () => {
    const results = await search({ q: '', limit: 25 });
    expect(results.results[0].name).toContain('Clinica Dental Fixture Uno');
  });

  it('keeps the weak business below the strong ones', async () => {
    const results = await search({ q: '', limit: 25 });
    const weakIndex = results.results.findIndex((r) => r.name.includes('Bar Pequeno'));
    const strongIndex = results.results.findIndex((r) => r.name.includes('Dental'));
    if (weakIndex !== -1) expect(weakIndex).toBeGreaterThan(strongIndex);
  });

  it('carries the explanation with every result', async () => {
    const results = await search({ q: 'dentist' });
    for (const result of results.results) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.opportunity).toBeGreaterThan(0);
    }
  });

  it('maps a free-text query onto a category', () => {
    expect(categoryForQuery('dentist')).toBe('dental_clinic');
    expect(categoryForQuery('abogado')).toBe('law_firm');
    expect(categoryForQuery('qqqq')).toBeNull();
  });
});

describe('search speed', () => {
  /**
   * The guarantee is that a search costs about one database round trip,
   * because it reads a single precomputed table and does nothing else — no
   * joins, no live enrichment, no AI, no crawling.
   *
   * Asserting raw milliseconds only measures that when the database is on
   * localhost. Against a hosted Postgres the network alone can exceed the
   * budget while the code does exactly what it should, so the baseline is
   * measured and the budget expressed relative to it. The original absolute
   * ceilings still apply whenever the database is close — which is the case in
   * production, where the app and the database are deployed to the same region.
   */
  it('costs about one database round trip', async () => {
    await search({ q: 'dentist' });

    const pings: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const started = performance.now();
      await query('SELECT 1');
      pings.push(performance.now() - started);
    }
    const baseline = pings.reduce((a, b) => a + b, 0) / pings.length;

    const timings: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const started = performance.now();
      await search({ q: i % 2 === 0 ? 'dentist' : 'abogados', limit: 10 });
      timings.push(performance.now() - started);
    }

    const worst = Math.max(...timings);
    const average = timings.reduce((a, b) => a + b, 0) / timings.length;

    // On a local database these collapse to the original 200 ms / 500 ms.
    expect(average).toBeLessThan(Math.max(200, baseline * 3));
    expect(worst).toBeLessThan(Math.max(500, baseline * 6));
  });
});
