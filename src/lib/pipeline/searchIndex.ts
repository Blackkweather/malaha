import { config } from '../config';
import { query } from '../db/pool';
import { logger } from '../logger';
import { CATEGORY_BY_KEY, categoryKeywords, OTHER_CATEGORY } from '../normalize/category';
import { normalizeBusinessName, normalizeText } from '../normalize/text';

/**
 * Rebuilds the denormalised search index.
 *
 * Only businesses that pass the quality gate are indexed. Everything the search
 * endpoint needs — display fields, scores and reasons — lives in this one table
 * so a query never joins, never enriches and never calls out to a service.
 */

interface IndexRow {
  id: string;
  name: string;
  category: string;
  city: string | null;
  municipality: string | null;
  postal_code: string | null;
  address: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_confidence: number;
  domain: string | null;
  in_scope: boolean;
  status: string;
  rating: string | null;
  review_count: number | null;
  has_website: boolean;
  business_quality: number;
  commercial_value: number;
  digital_opportunity: number;
  opportunity: number;
  evidence_score: number;
  reasons: { top?: string[]; qualified?: boolean; websiteVerdict?: string } | null;
  detected_services: string[] | null;
}

const CANDIDATE_QUERY = `
  SELECT
    b.id, b.name, b.category, b.city, b.municipality, b.postal_code, b.address,
    b.description, b.latitude, b.longitude, b.location_confidence, b.domain,
    b.in_scope, b.status,
    rs.rating::text AS rating,
    rs.review_count,
    (w.id IS NOT NULL AND w.is_official) OR (b.website_url IS NOT NULL) AS has_website,
    ls.business_quality, ls.commercial_value, ls.digital_opportunity,
    ls.opportunity, ls.evidence_score, ls.reasons,
    (a.metrics -> 'detectedServices') AS detected_services
  FROM businesses b
  JOIN lead_scores ls ON ls.business_id = b.id
  LEFT JOIN LATERAL (
    SELECT rating, review_count FROM review_signals
     WHERE business_id = b.id
     ORDER BY COALESCE(review_count, 0) DESC, confidence DESC
     LIMIT 1
  ) rs ON true
  LEFT JOIN websites w ON w.business_id = b.id
  LEFT JOIN LATERAL (
    SELECT metrics FROM website_audits
     WHERE business_id = b.id AND audit_version = $1
     ORDER BY created_at DESC LIMIT 1
  ) a ON true
`;

/** Builds the free-text document. Accents are stripped so search is robust. */
export function buildSearchText(row: {
  name: string;
  category: string;
  city: string | null;
  municipality: string | null;
  description: string | null;
  detectedServices: string[];
}): { keywords: string; document: string } {
  const category = CATEGORY_BY_KEY.get(row.category) ?? OTHER_CATEGORY;
  const keywords = [category.label, ...categoryKeywords(row.category), ...row.detectedServices]
    .map((k) => normalizeText(k))
    .filter(Boolean);

  const unique = [...new Set(keywords)];
  const document = [
    normalizeText(row.name),
    ...unique,
    normalizeText(row.city ?? ''),
    normalizeText(row.municipality ?? ''),
    normalizeText((row.description ?? '').slice(0, 500)),
  ]
    .filter(Boolean)
    .join(' ');

  return { keywords: unique.join(' '), document };
}

export interface IndexReport {
  indexed: number;
  removed: number;
  skipped: number;
}

const UPSERT_SQL = `
  INSERT INTO search_index (
    business_id, name, name_normalized, category, category_label, keywords,
    city, municipality, postal_code, address, latitude, longitude, location_confidence,
    rating, review_count, has_website, website_domain, website_verdict,
    business_quality, commercial_value, digital_opportunity, opportunity, evidence_score,
    top_reasons, document, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
    $19, $20, $21, $22, $23, $24::jsonb, to_tsvector('spanish', $25), now()
  )
  ON CONFLICT (business_id) DO UPDATE SET
    name = EXCLUDED.name, name_normalized = EXCLUDED.name_normalized,
    category = EXCLUDED.category, category_label = EXCLUDED.category_label,
    keywords = EXCLUDED.keywords, city = EXCLUDED.city,
    municipality = EXCLUDED.municipality, postal_code = EXCLUDED.postal_code,
    address = EXCLUDED.address, latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude, location_confidence = EXCLUDED.location_confidence,
    rating = EXCLUDED.rating, review_count = EXCLUDED.review_count,
    has_website = EXCLUDED.has_website, website_domain = EXCLUDED.website_domain,
    website_verdict = EXCLUDED.website_verdict,
    business_quality = EXCLUDED.business_quality,
    commercial_value = EXCLUDED.commercial_value,
    digital_opportunity = EXCLUDED.digital_opportunity,
    opportunity = EXCLUDED.opportunity, evidence_score = EXCLUDED.evidence_score,
    top_reasons = EXCLUDED.top_reasons, document = EXCLUDED.document,
    updated_at = now()
`;

/** Removes index entries whose business no longer qualifies. */
const PRUNE_SQL = `
  DELETE FROM search_index
   WHERE NOT (business_id = ANY($1::uuid[]))
   RETURNING business_id
`;

export async function refreshSearchIndex(): Promise<IndexReport> {
  const rows = (await query(CANDIDATE_QUERY, [config.audit.version])) as unknown as IndexRow[];

  const report: IndexReport = { indexed: 0, removed: 0, skipped: 0 };
  const keep: string[] = [];

  for (const row of rows) {
    // The quality gate decides membership; nothing is indexed to pad results.
    const qualified =
      row.reasons?.qualified === true &&
      row.in_scope &&
      row.status === 'active' &&
      row.location_confidence >= config.geo.minLocationConfidence;

    if (!qualified) {
      report.skipped += 1;
      continue;
    }

    const category = CATEGORY_BY_KEY.get(row.category) ?? OTHER_CATEGORY;
    const { keywords, document } = buildSearchText({
      name: row.name,
      category: row.category,
      city: row.city,
      municipality: row.municipality,
      description: row.description,
      detectedServices: Array.isArray(row.detected_services) ? row.detected_services : [],
    });

    await query(UPSERT_SQL, [
      row.id,
      row.name,
      normalizeBusinessName(row.name),
      row.category,
      category.label,
      keywords,
      row.city,
      row.municipality,
      row.postal_code,
      row.address,
      row.latitude,
      row.longitude,
      row.location_confidence,
      row.rating === null ? null : Number(row.rating),
      row.review_count,
      row.has_website,
      row.domain,
      row.reasons?.websiteVerdict ?? null,
      row.business_quality,
      row.commercial_value,
      row.digital_opportunity,
      row.opportunity,
      row.evidence_score,
      JSON.stringify(row.reasons?.top ?? []),
      document,
    ]);

    keep.push(row.id);
    report.indexed += 1;
  }

  const pruned = await query<{ business_id: string }>(PRUNE_SQL, [keep]);
  report.removed = pruned.length;

  logger.info('search index refreshed', { ...report });
  return report;
}
