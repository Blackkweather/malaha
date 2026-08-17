import { query } from '../../src/lib/db/pool';
import { scoreAllBusinesses } from '../../src/lib/pipeline/score';
import { refreshSearchIndex } from '../../src/lib/pipeline/searchIndex';
import { JsonSourceAdapter } from '../../src/lib/sources/json';
import type { NormalizedBusiness } from '../../src/lib/sources/types';

/** Empties every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await query(`
    TRUNCATE TABLE
      search_index, lead_scores, ai_usage_events, ai_analyses, demos, crm_status,
      website_issues, website_audits, website_pages, websites,
      review_signals, social_profiles, business_contacts, business_sources,
      crawl_events, crawl_jobs, suppression_list, businesses
    RESTART IDENTITY CASCADE
  `);
}

export interface FixtureInput {
  id?: string;
  name: string;
  category?: string;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  street?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  review_count?: number | null;
}

/** Loads fixtures through the real adapter pipeline. */
export async function loadFixtures(records: FixtureInput[]): Promise<void> {
  const adapter = new JsonSourceAdapter('test_fixture', 'Test fixture', 0.8);
  const raw = await adapter.discover({
    records: records.map((r, i) => ({
      country: 'ES',
      province: 'Malaga',
      id: r.id ?? `fx-${i}`,
      ...r,
    })),
  });
  const parsed = raw
    .map((record) => adapter.parse(record))
    .filter((b): b is NormalizedBusiness => b !== null);
  await adapter.persist(parsed);
}

export async function rescoreAndIndex(): Promise<void> {
  await scoreAllBusinesses();
  await refreshSearchIndex();
}

/** A realistic spread: two strong prospects and one genuinely weak business. */
export const MALAGA_FIXTURES: FixtureInput[] = [
  {
    id: 'fx-strong-dentist',
    name: 'Clinica Dental Fixture Uno',
    category: 'clinica dental',
    address: 'Calle Larios 1, 29005 Malaga',
    street: 'Calle Larios 1',
    postal_code: '29005',
    city: 'Malaga',
    latitude: 36.7203,
    longitude: -4.4203,
    phone: '+34 951 000 101',
    email: 'info@fixtureuno.example',
    rating: 4.9,
    review_count: 820,
  },
  {
    id: 'fx-strong-lawyer',
    name: 'Fixture Abogados Asociados',
    category: 'abogados',
    address: 'Alameda Principal 2, 29001 Malaga',
    street: 'Alameda Principal 2',
    postal_code: '29001',
    city: 'Malaga',
    latitude: 36.7182,
    longitude: -4.4245,
    phone: '+34 951 000 102',
    rating: 4.8,
    review_count: 410,
  },
  {
    id: 'fx-weak-bar',
    name: 'Fixture Bar Pequeno',
    category: 'bar',
    address: 'Calle Alderete 3, 29012 Malaga',
    street: 'Calle Alderete 3',
    postal_code: '29012',
    city: 'Malaga',
    latitude: 36.7268,
    longitude: -4.4189,
    phone: '+34 951 000 103',
    rating: 3.6,
    review_count: 4,
  },
];
