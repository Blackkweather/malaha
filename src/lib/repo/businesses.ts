import { config } from '../config';
import { query, queryOne } from '../db/pool';

export interface BusinessRecord {
  id: string;
  name: string;
  legal_name: string | null;
  category: string;
  category_raw: string | null;
  category_confidence: number;
  description: string | null;
  address: string | null;
  street: string | null;
  postal_code: string | null;
  municipality: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  location_confidence: number;
  location_evidence: unknown;
  in_scope: boolean;
  scope_reason: string | null;
  primary_phone: string | null;
  primary_phone_normalized: string | null;
  primary_email: string | null;
  website_url: string | null;
  domain: string | null;
  status: string;
  evidence_score: number;
  first_seen_at: Date;
  last_seen_at: Date;
}

export interface WebsiteRecord {
  id: string;
  url: string;
  normalized_url: string;
  domain: string;
  final_url: string | null;
  is_official: boolean;
  official_confidence: number;
  discovery_method: string;
  reachable: boolean | null;
  http_status: number | null;
  redirect_chain: unknown;
  response_time_ms: number | null;
  uses_https: boolean | null;
  last_checked_at: Date | null;
  last_error: string | null;
}

export interface AuditRecord {
  id: string;
  audit_version: number;
  started_at: Date;
  finished_at: Date | null;
  pages_crawled: number;
  metrics: Record<string, unknown>;
  verdict: string | null;
  summary: string | null;
  ok: boolean;
  error: string | null;
  created_at: Date;
}

export interface BusinessDetail {
  business: BusinessRecord;
  contacts: { kind: string; value: string; source: string; confidence: number }[];
  sources: { source: string; source_url: string | null; retrieved_at: Date; confidence: number }[];
  reviews: {
    source: string;
    source_url: string | null;
    rating: number | null;
    review_count: number | null;
    retrieved_at: Date;
  }[];
  socials: { platform: string; url: string }[];
  website: WebsiteRecord | null;
  audit: AuditRecord | null;
  issues: { code: string; title: string; severity: string; category: string; detail: string | null }[];
  pages: { url: string; page_type: string; title: string | null; http_status: number | null }[];
  score: {
    business_quality: number;
    commercial_value: number;
    digital_opportunity: number;
    opportunity: number;
    evidence_score: number;
    weights: Record<string, number>;
    reasons: Record<string, unknown>;
    breakdown: Record<string, unknown>;
    computed_at: Date;
  } | null;
  analyses: {
    provider: string;
    stage: string;
    model: string;
    output: unknown;
    created_at: Date;
    latency_ms: number | null;
    estimated_cost_usd: string | null;
  }[];
  demos: { id: string; slug: string; title: string; created_at: Date; status: string }[];
  crm: { status: string; owner: string | null; notes: string | null; next_action_at: Date | null } | null;
}

export async function getBusiness(id: string): Promise<BusinessRecord | null> {
  return queryOne<BusinessRecord>('SELECT * FROM businesses WHERE id = $1', [id]);
}

/** Loads everything the detail page and the AI evidence package need. */
export async function getBusinessDetail(id: string): Promise<BusinessDetail | null> {
  const business = await getBusiness(id);
  if (!business) return null;

  const [contacts, sources, reviews, socials, website, score, analyses, demos, crm] = await Promise.all([
    query<BusinessDetail['contacts'][number]>(
      'SELECT kind, value, source, confidence FROM business_contacts WHERE business_id = $1 ORDER BY kind',
      [id],
    ),
    query<BusinessDetail['sources'][number]>(
      'SELECT source, source_url, retrieved_at, confidence FROM business_sources WHERE business_id = $1 ORDER BY retrieved_at DESC',
      [id],
    ),
    query<BusinessDetail['reviews'][number]>(
      'SELECT source, source_url, rating::float8 AS rating, review_count, retrieved_at FROM review_signals WHERE business_id = $1 ORDER BY COALESCE(review_count, 0) DESC',
      [id],
    ),
    query<BusinessDetail['socials'][number]>(
      'SELECT platform, url FROM social_profiles WHERE business_id = $1',
      [id],
    ),
    queryOne<WebsiteRecord>('SELECT * FROM websites WHERE business_id = $1', [id]),
    queryOne<NonNullable<BusinessDetail['score']>>(
      'SELECT business_quality, commercial_value, digital_opportunity, opportunity, evidence_score, weights, reasons, breakdown, computed_at FROM lead_scores WHERE business_id = $1',
      [id],
    ),
    query<BusinessDetail['analyses'][number]>(
      `SELECT DISTINCT ON (provider, stage) provider, stage, model, output, created_at, latency_ms, estimated_cost_usd
         FROM ai_analyses WHERE business_id = $1
        ORDER BY provider, stage, created_at DESC`,
      [id],
    ),
    query<BusinessDetail['demos'][number]>(
      'SELECT id, slug, title, created_at, status FROM demos WHERE business_id = $1 ORDER BY created_at DESC',
      [id],
    ),
    queryOne<NonNullable<BusinessDetail['crm']>>(
      'SELECT status, owner, notes, next_action_at FROM crm_status WHERE business_id = $1',
      [id],
    ),
  ]);

  const audit = await queryOne<AuditRecord>(
    `SELECT id, audit_version, started_at, finished_at, pages_crawled, metrics, verdict, summary, ok, error, created_at
       FROM website_audits WHERE business_id = $1 AND audit_version = $2
      ORDER BY created_at DESC LIMIT 1`,
    [id, config.audit.version],
  );

  const issues = audit
    ? await query<BusinessDetail['issues'][number]>(
        'SELECT code, title, severity, category, detail FROM website_issues WHERE audit_id = $1 ORDER BY weight DESC',
        [audit.id],
      )
    : [];

  const pages = website
    ? await query<BusinessDetail['pages'][number]>(
        'SELECT url, page_type, title, http_status FROM website_pages WHERE website_id = $1 ORDER BY page_type',
        [website.id],
      )
    : [];

  return {
    business,
    contacts,
    sources,
    reviews,
    socials,
    website,
    audit,
    issues,
    pages,
    score,
    analyses,
    demos,
    crm,
  };
}
