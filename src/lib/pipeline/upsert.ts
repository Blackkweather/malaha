import type { PoolClient } from 'pg';
import { findMatch } from '../dedupe';
import { classifyCategory } from '../normalize/category';
import { extractDomain, isNonOfficialHost, normalizeUrl } from '../normalize/domain';
import { normalizeEmail } from '../normalize/email';
import { normalizePhone } from '../normalize/phone';
import { normalizeBusinessName } from '../normalize/text';
import { verifyLocation } from '../geo/verify';
import type { NormalizedBusiness } from '../sources/types';

export interface UpsertOutcome {
  businessId: string | null;
  action: 'inserted' | 'merged' | 'rejected';
  reasons: string[];
}

/**
 * Independent-evidence score (0..1).
 *
 * A record backed by several sources, with a verifiable address, a reachable
 * phone number and public review signals is far more trustworthy than a bare
 * name on a map. The quality filter uses this to drop thin records.
 */
export function computeEvidenceScore(input: {
  sourceCount: number;
  hasAddress: boolean;
  hasPostalCode: boolean;
  hasCoordinates: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  hasReviews: boolean;
  reviewCount: number;
  locationConfidence: number;
}): number {
  let score = 0;
  score += Math.min(input.sourceCount, 3) * 0.1;
  if (input.hasAddress) score += 0.12;
  if (input.hasPostalCode) score += 0.1;
  if (input.hasCoordinates) score += 0.1;
  if (input.hasPhone) score += 0.14;
  if (input.hasWebsite) score += 0.1;
  if (input.hasReviews) score += 0.1;
  if (input.reviewCount >= 20) score += 0.05;
  score += input.locationConfidence * 0.09;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

async function isSuppressed(
  client: PoolClient,
  values: { domain: string | null; phone: string | null; email: string | null; name: string },
): Promise<string | null> {
  const kinds: string[] = [];
  const vals: string[] = [];
  if (values.domain) { kinds.push('domain'); vals.push(values.domain); }
  if (values.phone) { kinds.push('phone'); vals.push(values.phone); }
  if (values.email) { kinds.push('email'); vals.push(values.email); }
  kinds.push('name');
  vals.push(normalizeBusinessName(values.name));

  const { rows } = await client.query<{ kind: string; value: string; reason: string | null }>(
    `SELECT kind, value, reason FROM suppression_list
      WHERE (kind, value) IN (SELECT * FROM unnest($1::text[], $2::text[]))
      LIMIT 1`,
    [kinds, vals],
  );
  if (rows.length === 0) return null;
  return rows[0].reason ?? `Suppressed by ${rows[0].kind} rule`;
}

/** Recomputes and stores the evidence score from what is now in the database. */
export async function refreshEvidenceScore(
  client: PoolClient,
  businessId: string,
): Promise<number> {
  const { rows } = await client.query<{
    source_count: string;
    has_address: boolean;
    has_postal: boolean;
    has_coords: boolean;
    has_phone: boolean;
    has_website: boolean;
    review_count: string | null;
    location_confidence: number;
  }>(
    `SELECT
       (SELECT count(DISTINCT source) FROM business_sources WHERE business_id = b.id) AS source_count,
       (b.address IS NOT NULL)      AS has_address,
       (b.postal_code IS NOT NULL)  AS has_postal,
       (b.latitude IS NOT NULL AND b.longitude IS NOT NULL) AS has_coords,
       (b.primary_phone_normalized IS NOT NULL) AS has_phone,
       (b.website_url IS NOT NULL)  AS has_website,
       (SELECT max(review_count) FROM review_signals WHERE business_id = b.id) AS review_count,
       b.location_confidence
     FROM businesses b WHERE b.id = $1`,
    [businessId],
  );
  if (rows.length === 0) return 0;
  const r = rows[0];
  const reviewCount = r.review_count === null ? 0 : Number(r.review_count);

  const score = computeEvidenceScore({
    sourceCount: Number(r.source_count),
    hasAddress: r.has_address,
    hasPostalCode: r.has_postal,
    hasCoordinates: r.has_coords,
    hasPhone: r.has_phone,
    hasWebsite: r.has_website,
    hasReviews: reviewCount > 0,
    reviewCount,
    locationConfidence: r.location_confidence,
  });

  await client.query('UPDATE businesses SET evidence_score = $2, updated_at = now() WHERE id = $1', [
    businessId,
    score,
  ]);
  return score;
}

/** Stores provenance, contacts, review signals and social profiles. */
async function recordProvenance(
  client: PoolClient,
  businessId: string,
  input: NormalizedBusiness,
  normalized: { phone: string | null; email: string | null; website: string | null },
): Promise<void> {
  await client.query(
    `INSERT INTO business_sources (business_id, source, source_id, source_url, retrieved_at, confidence, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (source, source_id, business_id)
     DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at,
                   confidence   = EXCLUDED.confidence,
                   raw          = EXCLUDED.raw,
                   source_url   = COALESCE(EXCLUDED.source_url, business_sources.source_url)`,
    [
      businessId,
      input.source,
      input.sourceId,
      input.sourceUrl,
      input.retrievedAt,
      input.confidence,
      JSON.stringify(input.raw ?? {}),
    ],
  );

  const contacts: { kind: string; value: string; normalized: string }[] = [];
  if (normalized.phone && input.phone) {
    contacts.push({ kind: 'phone', value: input.phone, normalized: normalized.phone });
  }
  if (normalized.email) {
    contacts.push({ kind: 'email', value: normalized.email, normalized: normalized.email });
  }
  if (input.address) {
    contacts.push({ kind: 'address', value: input.address, normalized: input.address.toLowerCase() });
  }

  for (const contact of contacts) {
    await client.query(
      `INSERT INTO business_contacts (business_id, kind, value, value_normalized, source, source_url, confidence, retrieved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (business_id, kind, value_normalized)
       DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at, confidence = GREATEST(business_contacts.confidence, EXCLUDED.confidence)`,
      [
        businessId,
        contact.kind,
        contact.value,
        contact.normalized,
        input.source,
        input.sourceUrl,
        input.confidence,
        input.retrievedAt,
      ],
    );
  }

  for (const review of input.reviews ?? []) {
    if (review.rating === null && review.reviewCount === null) continue;
    await client.query(
      `INSERT INTO review_signals (business_id, source, source_url, rating, review_count, retrieved_at, confidence, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (business_id, source)
       DO UPDATE SET rating       = COALESCE(EXCLUDED.rating, review_signals.rating),
                     review_count = GREATEST(COALESCE(EXCLUDED.review_count, 0), COALESCE(review_signals.review_count, 0)),
                     retrieved_at = EXCLUDED.retrieved_at,
                     confidence   = GREATEST(review_signals.confidence, EXCLUDED.confidence)`,
      [
        businessId,
        review.source,
        review.sourceUrl ?? input.sourceUrl,
        review.rating ?? null,
        review.reviewCount ?? null,
        input.retrievedAt,
        review.confidence ?? input.confidence,
        JSON.stringify({}),
      ],
    );
  }

  for (const social of input.socials ?? []) {
    if (!social.url) continue;
    await client.query(
      `INSERT INTO social_profiles (business_id, platform, url, handle, source, retrieved_at, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (business_id, platform, url) DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at`,
      [
        businessId,
        social.platform,
        social.url,
        social.handle ?? null,
        input.source,
        input.retrievedAt,
        input.confidence,
      ],
    );
  }
}

/**
 * Inserts a new business or merges the record into an existing one.
 *
 * Merge policy: an existing non-null value is never overwritten with null, and
 * geographic confidence only moves upward. Ambiguous duplicate evidence is
 * recorded as a reason and the record is kept separate rather than merged.
 */
export async function upsertBusiness(
  client: PoolClient,
  input: NormalizedBusiness,
): Promise<UpsertOutcome> {
  const reasons: string[] = [];
  const name = input.name.trim();
  if (!name) return { businessId: null, action: 'rejected', reasons: ['Missing business name'] };

  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const websiteUrl = normalizeUrl(input.websiteUrl);
  const officialWebsite = websiteUrl && !isNonOfficialHost(websiteUrl) ? websiteUrl : null;
  const domain = extractDomain(officialWebsite);

  const suppression = await isSuppressed(client, {
    domain,
    phone: phone.e164,
    email: email.value,
    name,
  });
  if (suppression) {
    return { businessId: null, action: 'rejected', reasons: [`Suppressed: ${suppression}`] };
  }

  const geo = verifyLocation({
    address: input.address,
    postalCode: input.postalCode,
    municipality: input.municipality,
    city: input.city,
    province: input.province,
    country: input.country,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });
  if (!geo.inScope) reasons.push(geo.reason);

  const category = classifyCategory(input.categoryRaw, name, input.categoryHints ?? []);

  const match = await findMatch(client, {
    name,
    websiteUrl: officialWebsite,
    phone: input.phone,
    address: input.address,
    street: input.street,
    postalCode: input.postalCode,
  });
  if (match.ambiguous) {
    reasons.push(`Possible duplicate not merged automatically: ${match.reason}`);
  }

  const values = [
    name,
    input.legalName ?? null,
    category.key,
    category.confidence,
    input.categoryRaw ?? null,
    input.description ?? null,
    input.address ?? null,
    input.street ?? null,
    input.postalCode ?? null,
    input.municipality ?? null,
    input.city ?? null,
    input.province ?? null,
    input.country ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    geo.confidence,
    JSON.stringify(geo.evidence),
    geo.inScope,
    geo.reason,
    phone.e164 ? input.phone : null,
    phone.e164,
    email.value,
    officialWebsite,
    domain,
  ];

  let businessId: string;
  let action: UpsertOutcome['action'];

  if (match.businessId && !match.ambiguous) {
    businessId = match.businessId;
    action = 'merged';
    await client.query(
      `UPDATE businesses SET
         name                = CASE WHEN length($2) > length(name) THEN $2 ELSE name END,
         legal_name          = COALESCE(legal_name, $3),
         category            = CASE WHEN $5 > category_confidence THEN $4 ELSE category END,
         category_confidence = GREATEST(category_confidence, $5),
         category_raw        = COALESCE(category_raw, $6),
         description         = COALESCE(description, $7),
         address             = COALESCE(address, $8),
         street              = COALESCE(street, $9),
         postal_code         = COALESCE(postal_code, $10),
         municipality        = COALESCE(municipality, $11),
         city                = COALESCE(city, $12),
         province            = COALESCE(province, $13),
         country             = COALESCE(country, $14),
         latitude            = COALESCE(latitude, $15),
         longitude           = COALESCE(longitude, $16),
         location_evidence   = CASE WHEN $17 >= location_confidence THEN $18::jsonb ELSE location_evidence END,
         scope_reason        = CASE WHEN $17 >= location_confidence THEN $20 ELSE scope_reason END,
         location_confidence = GREATEST(location_confidence, $17),
         in_scope            = in_scope OR $19,
         primary_phone            = COALESCE(primary_phone, $21),
         primary_phone_normalized = COALESCE(primary_phone_normalized, $22),
         primary_email            = COALESCE(primary_email, $23),
         website_url              = COALESCE(website_url, $24),
         domain                   = COALESCE(domain, $25),
         last_seen_at = now(),
         updated_at   = now()
       WHERE id = $1`,
      [businessId, ...values],
    );
  } else {
    action = 'inserted';
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO businesses (
         name, name_normalized, legal_name, category, category_confidence, category_raw,
         description, address, street, postal_code, municipality, city, province, country,
         latitude, longitude, location_confidence, location_evidence, in_scope, scope_reason,
         primary_phone, primary_phone_normalized, primary_email, website_url, domain
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                 $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24, $25)
       RETURNING id`,
      [name, normalizeBusinessName(name), ...values.slice(1)],
    );
    businessId = rows[0].id;
  }

  await recordProvenance(client, businessId, input, {
    phone: phone.e164,
    email: email.value,
    website: officialWebsite,
  });
  await refreshEvidenceScore(client, businessId);

  return { businessId, action, reasons };
}
