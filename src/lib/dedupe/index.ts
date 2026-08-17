import type { PoolClient } from 'pg';
import { nameSimilarity, normalizeBusinessName, normalizeText } from '../normalize/text';
import { extractDomain } from '../normalize/domain';
import { phoneKey } from '../normalize/phone';

export type MatchMethod =
  | 'exact_domain'
  | 'phone_and_name'
  | 'address_and_name'
  | 'fuzzy_name'
  | 'none';

export interface MatchCandidate {
  name: string;
  websiteUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  street?: string | null;
  postalCode?: string | null;
}

export interface MatchResult {
  businessId: string | null;
  method: MatchMethod;
  confidence: number;
  /**
   * True when evidence points at a business but is not strong enough to merge
   * automatically. Ambiguous matches are stored as separate records and flagged
   * for review rather than silently merged.
   */
  ambiguous: boolean;
  reason: string;
}

const NO_MATCH: MatchResult = {
  businessId: null,
  method: 'none',
  confidence: 0,
  ambiguous: false,
  reason: 'No existing business matched',
};

interface ExistingRow {
  id: string;
  name: string;
  name_normalized: string;
  domain: string | null;
  primary_phone_normalized: string | null;
  street: string | null;
  address: string | null;
  postal_code: string | null;
}

/** Name similarity above which two records are considered the same business. */
export const NAME_MATCH_STRONG = 0.82;
/** Below this, a name match is not evidence at all. */
export const NAME_MATCH_WEAK = 0.62;

function normalizeStreet(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeText(value)
    // Drop the Spanish street-type words so "calle larios" == "c larios".
    .replace(/\b(calle|c|avenida|avda|av|plaza|pza|paseo|po|camino|ctra|carretera|urbanizacion|urb|edificio|edif|local|bajo|piso|puerta|s n|num|numero|n)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the existing business a candidate should merge into.
 *
 * Signals are applied strictly in priority order, matching the specification:
 *   1. exact registrable domain
 *   2. exact phone + similar name
 *   3. same address + similar name
 *   4. fuzzy name, only as secondary evidence alongside a shared postal code
 */
export async function findMatch(
  client: PoolClient,
  candidate: MatchCandidate,
): Promise<MatchResult> {
  const domain = extractDomain(candidate.websiteUrl);
  const phone = phoneKey(candidate.phone);
  const nameNorm = normalizeBusinessName(candidate.name);
  const street = normalizeStreet(candidate.street ?? candidate.address);
  const postal = (candidate.postalCode ?? '').replace(/\D/g, '') || null;

  // --- 1. Exact domain ----------------------------------------------------
  if (domain) {
    const { rows } = await client.query<ExistingRow>(
      `SELECT id, name, name_normalized, domain, primary_phone_normalized, street, address, postal_code
         FROM businesses
        WHERE domain = $1 AND status <> 'duplicate'
        LIMIT 5`,
      [domain],
    );
    if (rows.length === 1) {
      return {
        businessId: rows[0].id,
        method: 'exact_domain',
        confidence: 0.98,
        ambiguous: false,
        reason: `Same registrable domain (${domain})`,
      };
    }
    if (rows.length > 1) {
      // Several businesses share the domain (e.g. a franchise). Fall through to
      // the stricter signals rather than merging into an arbitrary one.
      const best = rows
        .map((r) => ({ row: r, score: nameSimilarity(candidate.name, r.name) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= NAME_MATCH_STRONG) {
        return {
          businessId: best.row.id,
          method: 'exact_domain',
          confidence: 0.9,
          ambiguous: false,
          reason: `Same domain (${domain}) and matching name`,
        };
      }
    }
  }

  // --- 2. Exact phone + similar name --------------------------------------
  if (phone) {
    const { rows } = await client.query<ExistingRow>(
      `SELECT id, name, name_normalized, domain, primary_phone_normalized, street, address, postal_code
         FROM businesses
        WHERE primary_phone_normalized = $1 AND status <> 'duplicate'
        LIMIT 10`,
      [phone],
    );
    for (const row of rows) {
      const similarity = nameSimilarity(candidate.name, row.name);
      if (similarity >= NAME_MATCH_STRONG) {
        return {
          businessId: row.id,
          method: 'phone_and_name',
          confidence: 0.94,
          ambiguous: false,
          reason: `Same phone number and a ${(similarity * 100).toFixed(0)}% name match`,
        };
      }
    }
    if (rows.length > 0) {
      return {
        businessId: rows[0].id,
        method: 'phone_and_name',
        confidence: 0.5,
        ambiguous: true,
        reason: 'Shared phone number but the names differ; not merged automatically',
      };
    }
  }

  // --- 3. Same address + similar name -------------------------------------
  if (street && postal) {
    const { rows } = await client.query<ExistingRow>(
      `SELECT id, name, name_normalized, domain, primary_phone_normalized, street, address, postal_code
         FROM businesses
        WHERE postal_code = $1 AND status <> 'duplicate'
        LIMIT 200`,
      [postal],
    );
    for (const row of rows) {
      if (normalizeStreet(row.street ?? row.address) !== street) continue;
      const similarity = nameSimilarity(candidate.name, row.name);
      if (similarity >= NAME_MATCH_STRONG) {
        return {
          businessId: row.id,
          method: 'address_and_name',
          confidence: 0.9,
          ambiguous: false,
          reason: `Same street address and a ${(similarity * 100).toFixed(0)}% name match`,
        };
      }
      if (similarity >= NAME_MATCH_WEAK) {
        return {
          businessId: row.id,
          method: 'address_and_name',
          confidence: 0.55,
          ambiguous: true,
          reason: 'Same address but only a partial name match; not merged automatically',
        };
      }
    }
  }

  // --- 4. Fuzzy name, secondary evidence only ------------------------------
  if (nameNorm && postal) {
    const { rows } = await client.query<ExistingRow>(
      `SELECT id, name, name_normalized, domain, primary_phone_normalized, street, address, postal_code
         FROM businesses
        WHERE postal_code = $1
          AND status <> 'duplicate'
          AND similarity(name_normalized, $2) > 0.5
        ORDER BY similarity(name_normalized, $2) DESC
        LIMIT 5`,
      [postal, nameNorm],
    );
    for (const row of rows) {
      const similarity = nameSimilarity(candidate.name, row.name);
      if (similarity >= 0.93) {
        return {
          businessId: row.id,
          method: 'fuzzy_name',
          confidence: 0.72,
          ambiguous: false,
          reason: `Near-identical name in the same postal code (${(similarity * 100).toFixed(0)}%)`,
        };
      }
      if (similarity >= NAME_MATCH_STRONG) {
        return {
          businessId: row.id,
          method: 'fuzzy_name',
          confidence: 0.5,
          ambiguous: true,
          reason: 'Similar name in the same postal code; needs review before merging',
        };
      }
    }
  }

  return NO_MATCH;
}
