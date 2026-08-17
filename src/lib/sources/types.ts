/**
 * Pluggable source adapters.
 *
 * Every adapter implements the same five-stage contract so a new public data
 * source can be added without touching the pipeline:
 *
 *   discover() -> parse() -> normalize() -> validate() -> persist()
 *
 * Provenance is mandatory: each record carries the source key, the URL it came
 * from, when it was retrieved, and how much the adapter trusts it.
 */

export interface RawRecord {
  /** Stable identifier within the source, used for idempotent re-ingestion. */
  sourceId: string;
  sourceUrl: string | null;
  retrievedAt: string;
  payload: unknown;
}

export interface SocialProfileInput {
  platform: string;
  url: string;
  handle?: string | null;
}

export interface ReviewSignalInput {
  source: string;
  sourceUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  confidence?: number;
}

/** A source record after field-level normalisation, before validation. */
export interface NormalizedBusiness {
  name: string;
  legalName?: string | null;
  categoryRaw?: string | null;
  description?: string | null;

  address?: string | null;
  street?: string | null;
  postalCode?: string | null;
  municipality?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  socials?: SocialProfileInput[];
  reviews?: ReviewSignalInput[];

  /** Free-form extra terms fed to the category classifier. */
  categoryHints?: string[];

  source: string;
  sourceId: string;
  sourceUrl: string | null;
  retrievedAt: string;
  /** 0..1 trust in this source for this record. */
  confidence: number;
  raw: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
  business: NormalizedBusiness;
}

export interface PersistResult {
  inserted: number;
  updated: number;
  merged: number;
  rejected: number;
  rejections: { name: string; reasons: string[] }[];
  businessIds: string[];
}

export interface DiscoverOptions {
  /** Free-text query, e.g. "dentist". Adapters map it to their own filters. */
  query?: string;
  limit?: number;
  /** Adapter-specific options (file path for CSV, tag list for Overpass, ...). */
  [key: string]: unknown;
}

export interface SourceAdapter {
  readonly key: string;
  readonly displayName: string;
  /** True when the adapter has the credentials/config it needs. */
  isConfigured(): boolean;
  discover(options: DiscoverOptions): Promise<RawRecord[]>;
  parse(raw: RawRecord): NormalizedBusiness | null;
  normalize(business: NormalizedBusiness): NormalizedBusiness;
  validate(business: NormalizedBusiness): ValidationResult;
  persist(businesses: NormalizedBusiness[]): Promise<PersistResult>;
}
