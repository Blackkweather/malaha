import { beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/lib/db/pool';
import { loadFixtures, MALAGA_FIXTURES, rescoreAndIndex, resetDatabase } from './helpers/fixtures';

import { GET as healthGet } from '../src/app/api/health/route';
import { GET as searchGet } from '../src/app/api/search/route';
import { GET as topGet } from '../src/app/api/prospects/top/route';
import { GET as prospectGet } from '../src/app/api/prospects/[id]/route';
import { GET as businessGet } from '../src/app/api/businesses/[id]/route';
import { GET as analysisGet } from '../src/app/api/prospects/[id]/analysis/route';
import { GET as dashboardGet } from '../src/app/api/dashboard/route';
import { POST as importPost } from '../src/app/api/import/route';
import { GET as crmGet } from '../src/app/api/crm/route';
import { PUT as crmPut } from '../src/app/api/crm/[id]/route';
import { POST as demoPost } from '../src/app/api/prospects/[id]/generate-demo/route';

const TOKEN = 'test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BASE = 'http://localhost:3000';

function get(path: string): Request {
  return new Request(`${BASE}${path}`);
}

function authed(path: string, init: RequestInit = {}): Request {
  return new Request(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

let businessId: string;

beforeAll(async () => {
  await resetDatabase();
  await loadFixtures(MALAGA_FIXTURES);
  await rescoreAndIndex();
  const rows = await query<{ id: string }>(
    "SELECT id FROM businesses WHERE name LIKE '%Dental Fixture Uno%' LIMIT 1",
  );
  businessId = rows[0].id;
});

describe('GET /api/health', () => {
  it('reports status, scope and provider configuration without secrets', async () => {
    const response = await healthGet(get('/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database.connected).toBe(true);
    expect(body.scope.city).toBe('Malaga');
    expect(body.providers.groq).toBe('not_configured');
    expect(JSON.stringify(body)).not.toContain('test-token');
  });
});

describe('GET /api/search', () => {
  it('returns a ranked shortlist', async () => {
    const response = await searchGet(get('/api/search?q=dentist&limit=10'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.city).toBe('Malaga');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results[0].name).toContain('Dental');
    expect(body.results[0].reasons.length).toBeGreaterThan(0);
  });

  it('caps the limit at 25', async () => {
    const response = await searchGet(get('/api/search?q=&limit=25'));
    expect((await response.json()).limit).toBe(25);
  });

  it('rejects an out-of-range limit', async () => {
    const response = await searchGet(get('/api/search?q=dentist&limit=500'));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('bad_request');
  });

  it('rejects a malformed category filter', async () => {
    const response = await searchGet(get('/api/search?category=NOT-A-KEY'));
    expect(response.status).toBe(400);
  });

  it('offers no way to change the city', async () => {
    const response = await searchGet(get('/api/search?q=dentist&city=Marbella&location=Madrid'));
    const body = await response.json();
    expect(body.city).toBe('Malaga');
  });
});

describe('GET /api/prospects/top', () => {
  it('returns the strongest prospects', async () => {
    const response = await topGet(get('/api/prospects/top?limit=5'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /api/prospects/{id}', () => {
  it('returns the full explainable prospect view', async () => {
    const response = await prospectGet(get(`/api/prospects/${businessId}`), params(businessId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toContain('Dental Fixture Uno');
    expect(body.location.inScope).toBe(true);
    expect(body.scores.opportunity).toBeGreaterThan(0);
    expect(body.scores.reasons.length).toBeGreaterThan(0);
    expect(body.scores.weights.businessQuality).toBeCloseTo(0.35, 2);
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it('404s for an unknown id', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const response = await prospectGet(get(`/api/prospects/${missing}`), params(missing));
    expect(response.status).toBe(404);
  });

  it('400s for a non-uuid id', async () => {
    const response = await prospectGet(get('/api/prospects/abc'), params('abc'));
    expect(response.status).toBe(400);
  });
});

describe('GET /api/businesses/{id}', () => {
  it('returns the stored record with its provenance', async () => {
    const response = await businessGet(get(`/api/businesses/${businessId}`), params(businessId));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.business.name).toContain('Dental Fixture Uno');
    expect(body.sources[0].source).toBe('test_fixture');
  });
});

describe('GET /api/prospects/{id}/analysis', () => {
  it('reports that no analysis exists yet', async () => {
    const response = await analysisGet(get(`/api/prospects/${businessId}/analysis`), params(businessId));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.hasAnalysis).toBe(false);
    expect(body.groq).toBeNull();
    expect(body.claude).toBeNull();
  });
});

describe('GET /api/dashboard', () => {
  it('aggregates the system state', async () => {
    const response = await dashboardGet(get('/api/dashboard'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.scope.city).toBe('Malaga');
    expect(body.businesses.total).toBeGreaterThan(0);
    expect(body.index.indexed).toBeGreaterThan(0);
  });
});

describe('write endpoints require authentication', () => {
  it('refuses an unauthenticated import', async () => {
    const response = await importPost(
      new Request(`${BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json', records: [{ name: 'X' }] }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('refuses an invalid token', async () => {
    const response = await importPost(
      new Request(`${BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
        body: JSON.stringify({ format: 'json', records: [{ name: 'X' }] }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('refuses an unauthenticated CRM update', async () => {
    const response = await crmPut(
      new Request(`${BASE}/api/crm/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'contacted' }),
      }),
      params(businessId),
    );
    expect(response.status).toBe(401);
  });

  it('refuses an unauthenticated demo generation', async () => {
    const response = await demoPost(
      new Request(`${BASE}/api/prospects/${businessId}/generate-demo`, { method: 'POST' }),
      params(businessId),
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/import', () => {
  it('imports JSON records and reindexes', async () => {
    const response = await importPost(
      authed('/api/import', {
        method: 'POST',
        body: JSON.stringify({
          format: 'json',
          records: [
            {
              id: 'api-import-1',
              name: 'Clinica Fixture Importada',
              category: 'clinica dental',
              address: 'Calle Nueva 5, 29005 Malaga',
              street: 'Calle Nueva 5',
              postal_code: '29005',
              city: 'Malaga',
              province: 'Malaga',
              country: 'ES',
              phone: '+34 951 000 401',
              rating: 4.8,
              review_count: 250,
            },
          ],
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(body.indexed).toBeGreaterThan(0);
  });

  it('rejects an out-of-scope record and explains why', async () => {
    const response = await importPost(
      authed('/api/import', {
        method: 'POST',
        body: JSON.stringify({
          format: 'json',
          records: [
            {
              id: 'api-import-marbella',
              name: 'Clinica Fixture Marbella',
              category: 'clinica dental',
              postal_code: '29601',
              city: 'Marbella',
              province: 'Malaga',
              country: 'ES',
              rating: 5,
              review_count: 4000,
            },
          ],
        }),
      }),
    );

    const body = await response.json();
    expect(body.inserted).toBe(0);
    expect(body.rejected).toBe(1);
    expect(JSON.stringify(body.rejections)).toContain('Marbella');
  });

  it('imports CSV', async () => {
    const csv = [
      'name,category,postal_code,city,province,country,phone,rating,reviews',
      'Fixture CSV Abogados,abogados,29001,Malaga,Malaga,ES,+34 951 000 402,4.7,180',
    ].join('\n');

    const response = await importPost(
      authed('/api/import', { method: 'POST', body: JSON.stringify({ format: 'csv', content: csv }) }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.inserted).toBe(1);
  });

  it('rejects a malformed payload', async () => {
    const response = await importPost(
      authed('/api/import', { method: 'POST', body: JSON.stringify({ format: 'json' }) }),
    );
    expect(response.status).toBe(400);
  });
});

describe('CRM endpoints', () => {
  it('sets and reads a pipeline status', async () => {
    const put = await crmPut(
      authed(`/api/crm/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'contacted', notes: 'Called the practice manager.' }),
      }),
      params(businessId),
    );
    expect(put.status).toBe(200);
    const entry = await put.json();
    expect(entry.status).toBe('contacted');

    const list = await crmGet(get('/api/crm'));
    const body = await list.json();
    expect(body.entries.some((e: { businessId: string }) => e.businessId === businessId)).toBe(true);
    expect(body.counts.contacted).toBeGreaterThan(0);
  });

  it('rejects an unknown status', async () => {
    const response = await crmPut(
      authed(`/api/crm/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'definitely-not-a-status' }),
      }),
      params(businessId),
    );
    expect(response.status).toBe(400);
  });
});

describe('POST /api/prospects/{id}/generate-demo', () => {
  it('generates a demo with its own URL', async () => {
    const response = await demoPost(
      authed(`/api/prospects/${businessId}/generate-demo`, { method: 'POST' }),
      params(businessId),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.url).toContain('/demos/');
  });
});
