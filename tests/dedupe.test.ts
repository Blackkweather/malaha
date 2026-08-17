import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/lib/db/pool';
import { loadFixtures, resetDatabase } from './helpers/fixtures';

const BASE = {
  id: 'dd-base',
  name: 'Clinica Dental Guadalmedina',
  category: 'clinica dental',
  address: 'Calle Victoria 10, 29012 Malaga',
  street: 'Calle Victoria 10',
  postal_code: '29012',
  city: 'Malaga',
  latitude: 36.7245,
  longitude: -4.4181,
  phone: '+34 951 000 301',
  website: 'https://dentalguadalmedina.example',
  rating: 4.8,
  review_count: 300,
};

async function countBusinesses(): Promise<number> {
  const rows = await query<{ count: string }>('SELECT count(*)::text AS count FROM businesses');
  return Number(rows[0].count);
}

beforeEach(async () => {
  await resetDatabase();
  await loadFixtures([BASE]);
});

describe('deduplication', () => {
  it('merges on an exact shared domain', async () => {
    await loadFixtures([
      {
        ...BASE,
        id: 'dd-domain',
        name: 'Dental Guadalmedina Clinica',
        phone: '+34 951 000 999',
        address: 'Calle Otra 5, 29012 Malaga',
        street: 'Calle Otra 5',
      },
    ]);
    expect(await countBusinesses()).toBe(1);
  });

  it('merges on an exact phone plus a similar name', async () => {
    await loadFixtures([
      {
        ...BASE,
        id: 'dd-phone',
        name: 'Clinica Dental Guadalmedina S.L.',
        website: null,
        address: 'Calle Victoria 10 bajo, 29012 Malaga',
      },
    ]);
    expect(await countBusinesses()).toBe(1);
  });

  it('merges on the same address plus a similar name', async () => {
    await loadFixtures([
      {
        ...BASE,
        id: 'dd-address',
        name: 'Clinica Dental Guadalmedina',
        phone: null,
        website: null,
      },
    ]);
    expect(await countBusinesses()).toBe(1);
  });

  it('does not merge different businesses that merely share a postal code', async () => {
    await loadFixtures([
      {
        id: 'dd-other',
        name: 'Restaurante El Pimpi Fixture',
        category: 'restaurante',
        address: 'Calle Granada 62, 29012 Malaga',
        street: 'Calle Granada 62',
        postal_code: '29012',
        city: 'Malaga',
        latitude: 36.7231,
        longitude: -4.4179,
        phone: '+34 951 000 302',
        rating: 4.5,
        review_count: 900,
      },
    ]);
    expect(await countBusinesses()).toBe(2);
  });

  it('does not merge two businesses that share a phone but have different names', async () => {
    // A shared switchboard is ambiguous evidence, so both records survive.
    await loadFixtures([
      {
        id: 'dd-ambiguous',
        name: 'Laboratorio Protesis Dental Andalucia',
        category: 'clinica dental',
        address: 'Calle Victoria 12, 29012 Malaga',
        street: 'Calle Victoria 12',
        postal_code: '29012',
        city: 'Malaga',
        phone: '+34 951 000 301',
        rating: 4.2,
        review_count: 20,
      },
    ]);
    expect(await countBusinesses()).toBe(2);
  });

  it('keeps provenance from every source after a merge', async () => {
    await loadFixtures([{ ...BASE, id: 'dd-second-source', name: 'Clinica Dental Guadalmedina' }]);
    expect(await countBusinesses()).toBe(1);

    const sources = await query<{ source_id: string }>('SELECT source_id FROM business_sources');
    expect(sources.length).toBeGreaterThanOrEqual(2);
  });

  it('never overwrites an existing value with null during a merge', async () => {
    await loadFixtures([
      { ...BASE, id: 'dd-sparse', phone: null, email: null, website: null, address: null },
    ]);
    const rows = await query<{ primary_phone_normalized: string | null; domain: string | null }>(
      'SELECT primary_phone_normalized, domain FROM businesses',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].primary_phone_normalized).toBe('+34951000301');
    expect(rows[0].domain).toBe('dentalguadalmedina.example');
  });

  it('keeps the highest review count seen from a source', async () => {
    await loadFixtures([{ ...BASE, id: 'dd-more-reviews', review_count: 460 }]);
    const rows = await query<{ review_count: number }>(
      'SELECT review_count FROM review_signals ORDER BY review_count DESC',
    );
    expect(rows[0].review_count).toBe(460);
  });
});

describe('suppression list', () => {
  it('refuses to store a suppressed domain', async () => {
    await resetDatabase();
    await query(
      "INSERT INTO suppression_list (kind, value, reason) VALUES ('domain', 'blocked.example', 'Do not contact')",
    );
    await loadFixtures([{ ...BASE, id: 'dd-suppressed', website: 'https://blocked.example' }]);
    expect(await countBusinesses()).toBe(0);
  });
});
