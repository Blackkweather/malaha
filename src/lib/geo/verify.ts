import { config } from '../config';
import { normalizeText } from '../normalize/text';
import { haversineKm, resolveScope, type GeoScope } from './scope';

export interface GeoInput {
  address?: string | null;
  postalCode?: string | null;
  municipality?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeoEvidenceItem {
  signal: string;
  value: string;
  weight: number;
  supports: boolean;
}

export interface GeoVerdict {
  inScope: boolean;
  confidence: number;
  reason: string;
  evidence: GeoEvidenceItem[];
  /** Set when coordinates are present and usable. */
  distanceKm: number | null;
}

function pushEvidence(
  list: GeoEvidenceItem[],
  signal: string,
  value: string,
  weight: number,
  supports: boolean,
): void {
  list.push({ signal, value, weight, supports });
}

/**
 * Longest term from `terms` that appears in `value`.
 *
 * Length is what makes the comparison safe: "Velez-Malaga" contains both the
 * excluded municipality "velez malaga" and the scope alias "malaga", and only
 * the longer, more specific match should decide the outcome.
 */
function bestMatch(value: string, terms: string[]): { term: string; length: number } {
  const normalized = normalizeText(value);
  if (!normalized) return { term: '', length: 0 };

  let best = { term: '', length: 0 };
  for (const term of terms) {
    if (term.length <= best.length) continue;
    if (normalized === term || normalized.includes(term)) {
      best = { term, length: term.length };
    }
  }
  return best;
}

function matchesAlias(value: string, aliases: string[]): boolean {
  return bestMatch(value, aliases).length > 0;
}

/**
 * Decides whether a business is inside the configured scope and how strongly
 * the public evidence supports that.
 *
 * The rules are deliberately conservative: a contradiction (coordinates
 * elsewhere, a neighbouring municipality, a province postal code that is not a
 * city postal code) rejects the record outright. Absence of evidence lowers
 * confidence but does not on its own reject, so a record with a verified city
 * postal code and no coordinates can still qualify.
 */
export function verifyLocation(input: GeoInput, scopeOverride?: GeoScope): GeoVerdict {
  const scope = scopeOverride ?? resolveScope(config.geo.city);
  const evidence: GeoEvidenceItem[] = [];
  let score = 0;
  let distanceKm: number | null = null;

  // --- Country -------------------------------------------------------------
  const country = (input.country ?? '').trim().toUpperCase();
  if (country) {
    const isSpain = ['ES', 'ESP', 'SPAIN', 'ESPANA', 'ESPAÑA'].includes(country);
    if (!isSpain) {
      pushEvidence(evidence, 'country', country, 0, false);
      return {
        inScope: false,
        confidence: 0,
        reason: `Country ${country} is outside ${scope.country}`,
        evidence,
        distanceKm: null,
      };
    }
    pushEvidence(evidence, 'country', country, 0.05, true);
    score += 0.05;
  }

  // --- Explicit exclusion of neighbouring municipalities -------------------
  const localityFields = [input.municipality, input.city, input.address].filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  );
  for (const field of localityFields) {
    const excluded = bestMatch(field, scope.excludedMunicipalities);
    const alias = bestMatch(field, scope.municipalityAliases);

    // The more specific match wins: "Velez-Malaga" is excluded even though it
    // contains "Malaga", while a plain "Malaga" address is untouched.
    if (excluded.length > 0 && excluded.length >= alias.length) {
      pushEvidence(evidence, 'municipality_excluded', excluded.term, 0, false);
      return {
        inScope: false,
        confidence: 0,
        reason: `Municipality "${excluded.term}" is in the province but outside ${scope.displayName} city`,
        evidence,
        distanceKm: null,
      };
    }
  }

  // --- Postal code ---------------------------------------------------------
  const postal = (input.postalCode ?? '').replace(/\D/g, '');
  if (postal.length === 5) {
    if (scope.cityPostalCodes.includes(postal)) {
      pushEvidence(evidence, 'postal_code', postal, 0.45, true);
      score += 0.45;
    } else if (postal.startsWith(scope.provincePostalPrefix)) {
      pushEvidence(evidence, 'postal_code', postal, 0, false);
      return {
        inScope: false,
        confidence: 0,
        reason: `Postal code ${postal} is in the province but not in ${scope.displayName} city`,
        evidence,
        distanceKm: null,
      };
    } else {
      pushEvidence(evidence, 'postal_code', postal, 0, false);
      return {
        inScope: false,
        confidence: 0,
        reason: `Postal code ${postal} is outside the ${scope.displayName} province`,
        evidence,
        distanceKm: null,
      };
    }
  }

  // --- Municipality / city name -------------------------------------------
  const municipalityMatch = localityFields.find((f) =>
    matchesAlias(f, scope.municipalityAliases),
  );
  if (municipalityMatch) {
    pushEvidence(evidence, 'municipality', municipalityMatch.trim(), 0.35, true);
    score += 0.35;
  }

  // --- Province ------------------------------------------------------------
  if (input.province && normalizeText(input.province).includes(normalizeText(scope.province))) {
    pushEvidence(evidence, 'province', input.province.trim(), 0.1, true);
    score += 0.1;
  }

  // --- Coordinates ---------------------------------------------------------
  const lat = typeof input.latitude === 'number' ? input.latitude : null;
  const lon = typeof input.longitude === 'number' ? input.longitude : null;
  if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
    const box = scope.boundingBox;
    const inBox = lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
    distanceKm = haversineKm(scope.centroid, { lat, lon });

    if (!inBox) {
      pushEvidence(evidence, 'coordinates', `${lat},${lon}`, 0, false);
      return {
        inScope: false,
        confidence: 0,
        reason: `Coordinates ${lat.toFixed(4)},${lon.toFixed(4)} fall outside the ${scope.displayName} bounding box`,
        evidence,
        distanceKm,
      };
    }

    pushEvidence(evidence, 'coordinates', `${lat.toFixed(5)},${lon.toFixed(5)}`, 0.35, true);
    score += 0.35;

    if (distanceKm <= scope.radiusKm) {
      pushEvidence(evidence, 'centroid_distance_km', distanceKm.toFixed(2), 0.1, true);
      score += 0.1;
    }
  }

  const confidence = Math.max(0, Math.min(1, score));
  const inScope = confidence >= config.geo.minLocationConfidence;

  return {
    inScope,
    confidence: Number(confidence.toFixed(3)),
    reason: inScope
      ? `Verified in ${scope.displayName} by ${evidence.filter((e) => e.supports).map((e) => e.signal).join(', ')}`
      : `Insufficient evidence that this business is in ${scope.displayName} (confidence ${confidence.toFixed(2)} < ${config.geo.minLocationConfidence})`,
    evidence,
    distanceKm,
  };
}
