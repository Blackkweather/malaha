import { config } from '../config';
import { query } from '../db/pool';
import { resolveScope } from '../geo/scope';
import { normalizeText } from '../normalize/text';
import { CATEGORIES } from '../normalize/category';

/**
 * Search.
 *
 * This module is intentionally the narrowest part of the system: one indexed
 * query against `search_index`. It performs no enrichment, makes no network
 * calls, launches no browser and contacts no AI provider. Everything it returns
 * was precomputed by the background pipeline.
 */

export interface SearchResult {
  businessId: string;
  name: string;
  category: string;
  categoryLabel: string;
  city: string | null;
  postalCode: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  websiteDomain: string | null;
  websiteVerdict: string | null;
  opportunity: number;
  businessQuality: number;
  commercialValue: number;
  digitalOpportunity: number;
  reasons: string[];
  relevance: number;
}

export interface SearchOptions {
  q?: string;
  limit?: number;
  category?: string;
}

export interface SearchResponse {
  query: string;
  city: string;
  limit: number;
  requestedLimit: number;
  count: number;
  results: SearchResult[];
  /** Explains why the list may be shorter than the requested limit. */
  note: string | null;
  tookMs: number;
}

/** Clamps the caller-supplied limit into the configured range. */
export function resolveLimit(requested: number | undefined): number {
  const fallback = config.search.defaultLimit;
  if (requested === undefined || !Number.isFinite(requested)) return fallback;
  const rounded = Math.floor(requested);
  if (rounded < 1) return 1;
  return Math.min(rounded, config.search.maxLimit);
}

/** Maps a free-text query onto a taxonomy category when it clearly names one. */
export function categoryForQuery(q: string): string | null {
  const normalized = normalizeText(q);
  if (!normalized) return null;
  let best: { key: string; length: number } | null = null;
  for (const category of CATEGORIES) {
    if (category.excluded) continue;
    for (const term of category.terms) {
      const termNorm = normalizeText(term);
      if (!termNorm) continue;
      if (normalized === termNorm || normalized.includes(termNorm) || termNorm.includes(normalized)) {
        if (!best || termNorm.length > best.length) best = { key: category.key, length: termNorm.length };
      }
    }
  }
  return best ? best.key : null;
}

const SEARCH_SQL = `
  SELECT
    si.business_id, si.name, si.category, si.category_label, si.city, si.postal_code,
    si.address, si.rating::float8 AS rating, si.review_count, si.has_website,
    si.website_domain, si.website_verdict, si.opportunity, si.business_quality,
    si.commercial_value, si.digital_opportunity, si.top_reasons,
    GREATEST(
      CASE WHEN $1 = '' THEN 0.35 ELSE ts_rank(si.document, plainto_tsquery('spanish', $1)) END,
      similarity(si.name_normalized, $1),
      CASE WHEN $2::text IS NOT NULL AND si.category = $2::text THEN 0.6 ELSE 0 END
    ) AS relevance
  FROM search_index si
  WHERE si.location_confidence >= $3
    AND si.opportunity >= $4
    AND (
      $1 = ''
      OR si.document @@ plainto_tsquery('spanish', $1)
      OR si.name_normalized % $1
      OR ($2::text IS NOT NULL AND si.category = $2::text)
    )
  ORDER BY si.opportunity DESC, relevance DESC, si.review_count DESC NULLS LAST
  LIMIT $5
`;

interface SearchRow {
  business_id: string;
  name: string;
  category: string;
  category_label: string;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  has_website: boolean;
  website_domain: string | null;
  website_verdict: string | null;
  opportunity: number;
  business_quality: number;
  commercial_value: number;
  digital_opportunity: number;
  top_reasons: string[];
  relevance: number;
}

/**
 * Runs a search.
 *
 * The result list is never padded: if only four businesses clear the quality
 * threshold, four are returned even when ten were requested.
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
  const started = Date.now();
  const scope = resolveScope(config.geo.city);

  const q = normalizeText(options.q ?? '');
  const requestedLimit = options.limit ?? config.search.defaultLimit;
  const limit = resolveLimit(options.limit);
  const category = options.category ?? categoryForQuery(options.q ?? '');

  const rows = (await query(SEARCH_SQL, [
    q,
    category,
    config.geo.minLocationConfidence,
    config.search.minOpportunityScore,
    limit,
  ])) as unknown as SearchRow[];

  const results: SearchResult[] = rows.map((row) => ({
    businessId: row.business_id,
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label,
    city: row.city,
    postalCode: row.postal_code,
    address: row.address,
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: row.review_count,
    hasWebsite: row.has_website,
    websiteDomain: row.website_domain,
    websiteVerdict: row.website_verdict,
    opportunity: Number(row.opportunity),
    businessQuality: Number(row.business_quality),
    commercialValue: Number(row.commercial_value),
    digitalOpportunity: Number(row.digital_opportunity),
    reasons: Array.isArray(row.top_reasons) ? row.top_reasons : [],
    relevance: Number(row.relevance),
  }));

  let note: string | null = null;
  if (results.length < limit) {
    note =
      results.length === 0
        ? `No ${scope.displayName} businesses currently meet the quality threshold for this search.`
        : `Only ${results.length} ${scope.displayName} ${results.length === 1 ? 'business meets' : 'businesses meet'} the quality threshold, so the list is not padded.`;
  }

  return {
    query: options.q ?? '',
    city: scope.displayName,
    limit,
    requestedLimit,
    count: results.length,
    results,
    note,
    tookMs: Date.now() - started,
  };
}

/** Top prospects overall, independent of any query term. */
export async function topProspects(limit?: number): Promise<SearchResponse> {
  return search({ q: '', limit });
}
