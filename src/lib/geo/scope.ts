import { normalizeText } from '../normalize/text';

/**
 * Definition of a geographic scope.
 *
 * The application ships with one scope, Malaga city. Adding another city means
 * adding a definition here — it is deliberately not a request parameter, so a
 * caller can never widen the geographic scope from the API surface.
 */
export interface GeoScope {
  key: string;
  displayName: string;
  province: string;
  country: string;
  /** Postal codes belonging to the city proper. */
  cityPostalCodes: string[];
  /** Postal-code prefix of the wider province. */
  provincePostalPrefix: string;
  /** Accepted spellings of the municipality, normalised. */
  municipalityAliases: string[];
  /**
   * Municipalities inside the same province that are explicitly NOT in scope.
   * Without this list a "Malaga province" address in Marbella would pass.
   */
  excludedMunicipalities: string[];
  boundingBox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  centroid: { lat: number; lon: number };
  /** Distance from centroid, in km, that still counts as the city. */
  radiusKm: number;
}

export const MALAGA_SCOPE: GeoScope = {
  key: 'malaga',
  displayName: 'Malaga',
  province: 'Malaga',
  country: 'ES',
  cityPostalCodes: [
    '29001', '29002', '29003', '29004', '29005', '29006', '29007', '29008',
    '29009', '29010', '29011', '29012', '29013', '29014', '29015', '29016',
    '29017', '29018',
  ],
  provincePostalPrefix: '29',
  municipalityAliases: ['malaga', 'malaga capital', 'ciudad de malaga', 'municipio de malaga'],
  excludedMunicipalities: [
    'marbella', 'torremolinos', 'fuengirola', 'benalmadena', 'mijas',
    'rincon de la victoria', 'estepona', 'velez malaga', 'antequera', 'ronda',
    'alhaurin de la torre', 'alhaurin el grande', 'cartama', 'coin', 'nerja',
    'torrox', 'manilva', 'casares', 'ojen', 'istan', 'monda', 'almogia',
    'pizarra', 'alora', 'archidona', 'campillos', 'torre del mar',
    'san pedro de alcantara', 'puerto banus', 'la cala de mijas', 'arroyo de la miel',
  ],
  boundingBox: { minLat: 36.61, maxLat: 36.87, minLon: -4.63, maxLon: -4.28 },
  centroid: { lat: 36.7213, lon: -4.4214 },
  radiusKm: 16,
};

const SCOPES: Record<string, GeoScope> = {
  malaga: MALAGA_SCOPE,
};

/**
 * Resolves the configured scope. An unknown value is a configuration error and
 * throws rather than silently falling back to a wider area.
 */
export function resolveScope(cityKey: string): GeoScope {
  const key = normalizeText(cityKey).replace(/\s+/g, '');
  const scope = SCOPES[key];
  if (!scope) {
    throw new Error(
      `Unknown geographic scope "${cityKey}". Add a GeoScope definition in src/lib/geo/scope.ts.`,
    );
  }
  return scope;
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
