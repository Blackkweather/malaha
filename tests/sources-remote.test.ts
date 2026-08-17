import { describe, expect, it } from 'vitest';
import { OverpassSourceAdapter } from '../src/lib/sources/overpass';
import { GooglePlacesSourceAdapter } from '../src/lib/sources/googlePlaces';

describe('Overpass query construction', () => {
  const adapter = new OverpassSourceAdapter();

  it('bounds every query to the configured bounding box', () => {
    const query = adapter.buildQuery(['amenity=dentist']);
    expect(query).toContain('[out:json]');
    expect(query).toContain('36.61,-4.63,36.87,-4.28');
    expect(query).toContain('node["amenity"="dentist"]["name"]');
    expect(query).toContain('way["amenity"="dentist"]["name"]');
    expect(query).toContain('out center tags;');
  });

  it('ignores malformed selectors', () => {
    expect(adapter.buildQuery(['not-a-selector'])).not.toContain('not-a-selector');
  });

  it('parses an OSM element into a normalised business', () => {
    const parsed = adapter.parse({
      sourceId: 'node/1',
      sourceUrl: 'https://www.openstreetmap.org/node/1',
      retrievedAt: new Date().toISOString(),
      payload: {
        type: 'node',
        id: 1,
        lat: 36.7203,
        lon: -4.4203,
        tags: {
          name: 'Clinica Dental Ejemplo',
          amenity: 'dentist',
          'addr:street': 'Calle Larios',
          'addr:housenumber': '12',
          'addr:postcode': '29005',
          'addr:city': 'Malaga',
          phone: '+34 952 12 34 56',
          website: 'https://ejemplo.example',
        },
      },
    });

    expect(parsed?.name).toBe('Clinica Dental Ejemplo');
    expect(parsed?.categoryRaw).toBe('amenity=dentist');
    expect(parsed?.street).toBe('Calle Larios 12');
    expect(parsed?.postalCode).toBe('29005');
    expect(parsed?.latitude).toBeCloseTo(36.7203, 4);
    // OpenStreetMap carries no review data, and none is invented.
    expect(parsed?.reviews).toEqual([]);
  });

  it('skips unnamed elements', () => {
    const parsed = adapter.parse({
      sourceId: 'node/2',
      sourceUrl: null,
      retrievedAt: new Date().toISOString(),
      payload: { type: 'node', id: 2, tags: { amenity: 'dentist' } },
    });
    expect(parsed).toBeNull();
  });
});

describe('Google Places parsing', () => {
  const adapter = new GooglePlacesSourceAdapter();

  it('maps a place into a normalised business with review signals', () => {
    const parsed = adapter.parse({
      sourceId: 'places/abc',
      sourceUrl: 'https://maps.google.com/?cid=1',
      retrievedAt: new Date().toISOString(),
      payload: {
        id: 'places/abc',
        displayName: { text: 'Clinica Dental Google' },
        formattedAddress: 'Calle Larios 12, 29005 Malaga',
        addressComponents: [
          { longText: '12', types: ['street_number'] },
          { longText: 'Calle Larios', types: ['route'] },
          { longText: '29005', types: ['postal_code'] },
          { longText: 'Malaga', types: ['locality'] },
          { longText: 'Malaga', types: ['administrative_area_level_2'] },
          { longText: 'Espana', types: ['country'] },
        ],
        location: { latitude: 36.7203, longitude: -4.4203 },
        rating: 4.8,
        userRatingCount: 512,
        websiteUri: 'https://ejemplo.example',
        nationalPhoneNumber: '952 12 34 56',
        primaryType: 'dentist',
        businessStatus: 'OPERATIONAL',
      },
    });

    expect(parsed?.name).toBe('Clinica Dental Google');
    expect(parsed?.street).toBe('Calle Larios 12');
    expect(parsed?.reviews?.[0].rating).toBe(4.8);
    expect(parsed?.reviews?.[0].reviewCount).toBe(512);
    expect(parsed?.reviews?.[0].source).toBe('google');
  });

  it('skips businesses that are no longer operational', () => {
    const parsed = adapter.parse({
      sourceId: 'places/closed',
      sourceUrl: null,
      retrievedAt: new Date().toISOString(),
      payload: {
        id: 'places/closed',
        displayName: { text: 'Cerrado Permanentemente' },
        businessStatus: 'CLOSED_PERMANENTLY',
      },
    });
    expect(parsed).toBeNull();
  });

  it('returns nothing when it is not configured', async () => {
    expect(await adapter.discover({ query: 'dentist' })).toEqual([]);
  });
});
