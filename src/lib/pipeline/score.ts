import { config } from '../config';
import { query, queryOne } from '../db/pool';
import { CATEGORY_BY_KEY } from '../normalize/category';
import { nameTokens } from '../normalize/text';
import { computeOpportunity, topReasons, type OpportunityResult } from '../scoring/opportunity';
import { resolveScope } from '../geo/scope';

export const SCORE_VERSION = 3;

interface ScoringRow {
  id: string;
  name: string;
  category: string;
  category_confidence: number;
  in_scope: boolean;
  location_confidence: number;
  evidence_score: number;
  status: string;
  duplicate_of: string | null;
  primary_phone_normalized: string | null;
  address: string | null;
  website_url: string | null;
  rating: string | null;
  review_count: number | null;
  source_count: string;
  social_count: string;
  website_reachable: boolean | null;
  website_http_status: number | null;
  has_website_record: boolean;
  has_published_url: boolean;
  audit_id: string | null;
  audit_ok: boolean | null;
  detected_services: string[] | null;
  has_booking: boolean | null;
  issue_codes: string[] | null;
}

/**
 * Loads every signal needed to score a business in one query, so scoring a
 * whole batch does not degenerate into per-row round trips.
 */
const SCORING_QUERY = `
  SELECT
    b.id, b.name, b.category, b.category_confidence, b.in_scope,
    b.location_confidence, b.evidence_score, b.status, b.duplicate_of,
    b.primary_phone_normalized, b.address, b.website_url,
    rs.rating::text                              AS rating,
    rs.review_count                              AS review_count,
    (SELECT count(DISTINCT source) FROM business_sources WHERE business_id = b.id) AS source_count,
    (SELECT count(*) FROM social_profiles WHERE business_id = b.id)                AS social_count,
    w.reachable                                  AS website_reachable,
    w.http_status                                AS website_http_status,
    (w.id IS NOT NULL AND w.is_official)         AS has_website_record,
    (b.website_url IS NOT NULL)                  AS has_published_url,
    a.id                                         AS audit_id,
    a.ok                                         AS audit_ok,
    (a.metrics -> 'detectedServices')            AS detected_services_json,
    (a.metrics ->> 'hasBookingLink')::boolean    AS has_booking,
    (SELECT array_agg(i.code) FROM website_issues i WHERE i.audit_id = a.id) AS issue_codes
  FROM businesses b
  LEFT JOIN LATERAL (
    SELECT rating, review_count FROM review_signals
     WHERE business_id = b.id
     ORDER BY COALESCE(review_count, 0) DESC, confidence DESC
     LIMIT 1
  ) rs ON true
  LEFT JOIN websites w ON w.business_id = b.id
  LEFT JOIN LATERAL (
    SELECT id, ok, metrics FROM website_audits
     WHERE business_id = b.id AND audit_version = $1
     ORDER BY created_at DESC
     LIMIT 1
  ) a ON true
`;

export interface ScoredBusiness {
  businessId: string;
  name: string;
  result: OpportunityResult;
}

function toScoringInput(row: Record<string, unknown>) {
  const r = row as unknown as ScoringRow & { detected_services_json: unknown };
  const rating = r.rating === null ? null : Number(r.rating);
  const reviewCount = r.review_count === null ? null : Number(r.review_count);
  const category = CATEGORY_BY_KEY.get(r.category);
  const scope = resolveScope(config.geo.city);

  const detectedServices = Array.isArray(r.detected_services_json)
    ? (r.detected_services_json as string[])
    : [];

  const hasAudit = r.audit_id !== null;

  return {
    businessQuality: {
      rating,
      reviewCount,
      evidenceScore: r.evidence_score,
      locationConfidence: r.location_confidence,
      sourceCount: Number(r.source_count),
      hasPhone: r.primary_phone_normalized !== null,
      hasAddress: r.address !== null,
      hasWebsite: r.website_url !== null,
      socialProfileCount: Number(r.social_count),
    },
    commercialValue: {
      categoryKey: r.category,
      categoryConfidence: r.category_confidence,
      reviewCount,
      detectedServices,
      hasTransactionalIntent: r.has_booking === true,
    },
    digitalOpportunity: {
      // A URL published by a public source counts as having a website even
      // before discovery has verified it; the audit then refines the picture.
      hasWebsite: r.has_website_record === true || r.has_published_url === true,
      reachable: r.website_reachable !== false,
      httpStatus: r.website_http_status,
      issueCodes: r.issue_codes ?? [],
      socialProfileCount: Number(r.social_count),
      auditMissing: (r.has_website_record === true || r.has_published_url === true) && !hasAudit,
    },
    inScope: r.in_scope,
    locationConfidence: r.location_confidence,
    categoryExcluded: category?.excluded === true,
    isDuplicate: r.status === 'duplicate' || r.duplicate_of !== null,
    evidenceScore: r.evidence_score,
    cityLabel: scope.displayName,
    nameIsMeaningful: nameTokens(r.name).length > 0,
  };
}

/** Scores one business and persists the result. */
export async function scoreBusiness(businessId: string): Promise<ScoredBusiness | null> {
  const row = await queryOne(`${SCORING_QUERY} WHERE b.id = $2`, [config.audit.version, businessId]);
  if (!row) return null;

  const input = toScoringInput(row);
  const result = computeOpportunity(input);
  await persistScore(businessId, result);
  return { businessId, name: String(row.name), result };
}

/** Scores every business. Used after ingestion and by the worker. */
export async function scoreAllBusinesses(): Promise<ScoredBusiness[]> {
  const rows = await query(`${SCORING_QUERY} WHERE b.status <> 'suppressed'`, [config.audit.version]);
  const scored: ScoredBusiness[] = [];

  for (const row of rows) {
    const result = computeOpportunity(toScoringInput(row));
    await persistScore(String(row.id), result);
    scored.push({ businessId: String(row.id), name: String(row.name), result });
  }

  return scored;
}

async function persistScore(businessId: string, result: OpportunityResult): Promise<void> {
  await query(
    `INSERT INTO lead_scores (
       business_id, business_quality, commercial_value, digital_opportunity, opportunity,
       evidence_score, weights, reasons, breakdown, score_version, computed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, now())
     ON CONFLICT (business_id) DO UPDATE SET
       business_quality    = EXCLUDED.business_quality,
       commercial_value    = EXCLUDED.commercial_value,
       digital_opportunity = EXCLUDED.digital_opportunity,
       opportunity         = EXCLUDED.opportunity,
       evidence_score      = EXCLUDED.evidence_score,
       weights             = EXCLUDED.weights,
       reasons             = EXCLUDED.reasons,
       breakdown           = EXCLUDED.breakdown,
       score_version       = EXCLUDED.score_version,
       computed_at         = now()`,
    [
      businessId,
      result.businessQuality.score,
      result.commercialValue.score,
      result.digitalOpportunity.score,
      result.opportunity,
      result.businessQuality.breakdown.evidence / 100,
      JSON.stringify(result.weights),
      JSON.stringify({
        reasons: result.reasons,
        top: topReasons(result),
        qualified: result.qualified,
        disqualification: result.disqualificationReasons,
        websiteVerdict: result.websiteVerdict,
      }),
      JSON.stringify({
        businessQuality: result.businessQuality.breakdown,
        commercialValue: result.commercialValue.breakdown,
        digitalOpportunity: result.digitalOpportunity.breakdown,
      }),
      SCORE_VERSION,
    ],
  );
}
