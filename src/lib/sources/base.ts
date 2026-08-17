import { withTransaction } from '../db/pool';
import { verifyLocation } from '../geo/verify';
import { logger } from '../logger';
import { normalizeUrl } from '../normalize/domain';
import { normalizeEmail } from '../normalize/email';
import { normalizePhone } from '../normalize/phone';
import { upsertBusiness } from '../pipeline/upsert';
import type {
  DiscoverOptions,
  NormalizedBusiness,
  PersistResult,
  RawRecord,
  SourceAdapter,
  ValidationResult,
} from './types';

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed === '' ? null : trimmed;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Shared implementation of the adapter contract.
 *
 * Concrete adapters only implement `discover` and `parse`; normalisation,
 * validation and persistence are identical for every source so that a new
 * source cannot accidentally bypass the Malaga rule or the provenance rules.
 */
export abstract class BaseSourceAdapter implements SourceAdapter {
  abstract readonly key: string;
  abstract readonly displayName: string;

  isConfigured(): boolean {
    return true;
  }

  abstract discover(options: DiscoverOptions): Promise<RawRecord[]>;
  abstract parse(raw: RawRecord): NormalizedBusiness | null;

  /** Field-level cleanup. Never changes meaning, only representation. */
  normalize(business: NormalizedBusiness): NormalizedBusiness {
    const phone = normalizePhone(business.phone);
    const email = normalizeEmail(business.email);

    return {
      ...business,
      name: clean(business.name) ?? '',
      legalName: clean(business.legalName),
      categoryRaw: clean(business.categoryRaw),
      description: clean(business.description),
      address: clean(business.address),
      street: clean(business.street),
      postalCode: clean(business.postalCode)?.replace(/\s+/g, '') ?? null,
      municipality: clean(business.municipality),
      city: clean(business.city),
      province: clean(business.province),
      country: clean(business.country)?.toUpperCase() ?? null,
      latitude: toNumber(business.latitude),
      longitude: toNumber(business.longitude),
      phone: phone.isValid ? phone.e164 : clean(business.phone),
      email: email.isValid ? email.value : null,
      websiteUrl: normalizeUrl(business.websiteUrl),
      socials: (business.socials ?? [])
        .map((s) => ({ ...s, url: normalizeUrl(s.url) ?? '' }))
        .filter((s) => s.url !== ''),
      reviews: (business.reviews ?? []).filter(
        (r) => r.rating !== undefined || r.reviewCount !== undefined,
      ),
    };
  }

  /**
   * Rejects records that cannot become useful prospects.
   *
   * A hard geographic contradiction is fatal: the record is outside Malaga and
   * is discarded rather than stored. Missing evidence is not fatal — the record
   * is kept with `in_scope = false` so the rejection stays auditable.
   */
  validate(business: NormalizedBusiness): ValidationResult {
    const reasons: string[] = [];

    if (!business.name || business.name.length < 2) {
      reasons.push('Missing or unusable business name');
    }
    if (!business.source || !business.sourceId) {
      reasons.push('Missing source provenance');
    }
    if (!business.retrievedAt || Number.isNaN(Date.parse(business.retrievedAt))) {
      reasons.push('Missing or invalid retrieved_at timestamp');
    }

    const hasAnyLocation =
      business.postalCode || business.municipality || business.city ||
      business.address || (business.latitude !== null && business.longitude !== null);
    if (!hasAnyLocation) {
      reasons.push('No geographic evidence of any kind');
    }

    const geo = verifyLocation({
      address: business.address,
      postalCode: business.postalCode,
      municipality: business.municipality,
      city: business.city,
      province: business.province,
      country: business.country,
      latitude: business.latitude ?? null,
      longitude: business.longitude ?? null,
    });

    const contradicted = geo.evidence.some((e) => !e.supports);
    if (contradicted) {
      reasons.push(geo.reason);
    }

    return { valid: reasons.length === 0, reasons, business };
  }

  /** Normalises, validates and upserts a batch inside a single transaction. */
  async persist(businesses: NormalizedBusiness[]): Promise<PersistResult> {
    const result: PersistResult = {
      inserted: 0,
      updated: 0,
      merged: 0,
      rejected: 0,
      rejections: [],
      businessIds: [],
    };

    await withTransaction(async (client) => {
      for (const incoming of businesses) {
        const normalized = this.normalize(incoming);
        const validation = this.validate(normalized);

        if (!validation.valid) {
          result.rejected += 1;
          result.rejections.push({ name: normalized.name || '(unnamed)', reasons: validation.reasons });
          continue;
        }

        const outcome = await upsertBusiness(client, normalized);
        if (outcome.action === 'inserted') {
          result.inserted += 1;
          if (outcome.businessId) result.businessIds.push(outcome.businessId);
        } else if (outcome.action === 'merged') {
          result.merged += 1;
          if (outcome.businessId) result.businessIds.push(outcome.businessId);
        } else {
          result.rejected += 1;
          result.rejections.push({ name: normalized.name, reasons: outcome.reasons });
        }
      }
    });

    logger.info('source persisted', {
      source: this.key,
      inserted: result.inserted,
      merged: result.merged,
      rejected: result.rejected,
    });
    return result;
  }
}
