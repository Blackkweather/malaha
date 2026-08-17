-- ---------------------------------------------------------------------------
-- 0001_init : core schema for the Malaga prospect finder
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- businesses : one row per real-world business after deduplication
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  name_normalized       text NOT NULL,
  legal_name            text,

  category              text NOT NULL DEFAULT 'other',
  category_raw          text,
  category_confidence   real NOT NULL DEFAULT 0,
  description           text,

  -- Geography. Every field here is evidence for the Malaga-only rule.
  address               text,
  street                text,
  postal_code           text,
  municipality          text,
  city                  text,
  province              text,
  country               text,
  latitude              double precision,
  longitude             double precision,
  location_confidence   real NOT NULL DEFAULT 0,
  location_evidence     jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_scope              boolean NOT NULL DEFAULT false,
  scope_reason          text,

  primary_phone            text,
  primary_phone_normalized text,
  primary_email            text,
  website_url              text,
  domain                   text,

  status                text NOT NULL DEFAULT 'active',
  duplicate_of          uuid REFERENCES businesses(id) ON DELETE SET NULL,

  evidence_score        real NOT NULL DEFAULT 0,

  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT businesses_status_check
    CHECK (status IN ('active', 'duplicate', 'suppressed', 'closed')),
  CONSTRAINT businesses_location_confidence_check
    CHECK (location_confidence >= 0 AND location_confidence <= 1),
  CONSTRAINT businesses_evidence_score_check
    CHECK (evidence_score >= 0 AND evidence_score <= 1)
);

CREATE INDEX IF NOT EXISTS businesses_in_scope_idx  ON businesses (in_scope, status);
CREATE INDEX IF NOT EXISTS businesses_domain_idx    ON businesses (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS businesses_phone_idx     ON businesses (primary_phone_normalized) WHERE primary_phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS businesses_postal_idx    ON businesses (postal_code);
CREATE INDEX IF NOT EXISTS businesses_category_idx  ON businesses (category);
CREATE INDEX IF NOT EXISTS businesses_name_trgm_idx ON businesses USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS businesses_dup_idx       ON businesses (duplicate_of) WHERE duplicate_of IS NOT NULL;

-- ---------------------------------------------------------------------------
-- business_sources : provenance. Every fact is traceable to a public source.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source        text NOT NULL,
  source_id     text NOT NULL,
  source_url    text,
  retrieved_at  timestamptz NOT NULL DEFAULT now(),
  confidence    real NOT NULL DEFAULT 0.5,
  raw           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id, business_id)
);

CREATE INDEX IF NOT EXISTS business_sources_business_idx ON business_sources (business_id);
CREATE INDEX IF NOT EXISTS business_sources_source_idx   ON business_sources (source);

-- ---------------------------------------------------------------------------
-- business_contacts : public contact points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_contacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind             text NOT NULL,
  value            text NOT NULL,
  value_normalized text NOT NULL,
  source           text NOT NULL,
  source_url       text,
  confidence       real NOT NULL DEFAULT 0.5,
  retrieved_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_contacts_kind_check
    CHECK (kind IN ('phone', 'email', 'whatsapp', 'contact_form', 'booking', 'address')),
  UNIQUE (business_id, kind, value_normalized)
);

CREATE INDEX IF NOT EXISTS business_contacts_business_idx ON business_contacts (business_id);

-- ---------------------------------------------------------------------------
-- websites : the discovered official site for a business
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS websites (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  url                 text NOT NULL,
  normalized_url      text NOT NULL,
  domain              text NOT NULL,
  final_url           text,
  is_official         boolean NOT NULL DEFAULT false,
  official_confidence real NOT NULL DEFAULT 0,
  discovery_method    text NOT NULL DEFAULT 'source',
  reachable           boolean,
  http_status         integer,
  redirect_chain      jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_time_ms    integer,
  uses_https          boolean,
  last_checked_at     timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS websites_domain_idx ON websites (domain);

-- ---------------------------------------------------------------------------
-- website_pages : the small set of pages we actually inspect
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_pages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id       uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url              text NOT NULL,
  page_type        text NOT NULL DEFAULT 'other',
  http_status      integer,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  content_hash     text,
  title            text,
  meta_description text,
  rendered_with    text NOT NULL DEFAULT 'http',
  bytes            integer,
  response_time_ms integer,
  text_excerpt     text,
  CONSTRAINT website_pages_render_check CHECK (rendered_with IN ('http', 'playwright')),
  UNIQUE (website_id, url)
);

CREATE INDEX IF NOT EXISTS website_pages_website_idx ON website_pages (website_id);

-- ---------------------------------------------------------------------------
-- website_audits : one row per technical audit run
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid REFERENCES websites(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  audit_version integer NOT NULL DEFAULT 1,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  pages_crawled integer NOT NULL DEFAULT 0,
  content_hash  text,
  metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  verdict       text,
  summary       text,
  ok            boolean NOT NULL DEFAULT true,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_audits_business_idx ON website_audits (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- website_issues : explainable, individually weighted findings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_issues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    uuid NOT NULL REFERENCES website_audits(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code        text NOT NULL,
  severity    text NOT NULL DEFAULT 'medium',
  category    text NOT NULL DEFAULT 'general',
  title       text NOT NULL,
  detail      text,
  evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight      real NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_issues_severity_check CHECK (severity IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS website_issues_audit_idx    ON website_issues (audit_id);
CREATE INDEX IF NOT EXISTS website_issues_business_idx ON website_issues (business_id);

-- ---------------------------------------------------------------------------
-- review_signals : public rating / review-volume evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_signals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source       text NOT NULL,
  source_url   text,
  rating       numeric(3, 2),
  review_count integer,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  confidence   real NOT NULL DEFAULT 0.5,
  raw          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_signals_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT review_signals_count_check  CHECK (review_count IS NULL OR review_count >= 0),
  UNIQUE (business_id, source)
);

CREATE INDEX IF NOT EXISTS review_signals_business_idx ON review_signals (business_id);

-- ---------------------------------------------------------------------------
-- social_profiles : public business social presence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform     text NOT NULL,
  url          text NOT NULL,
  handle       text,
  source       text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  confidence   real NOT NULL DEFAULT 0.5,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, platform, url)
);

CREATE INDEX IF NOT EXISTS social_profiles_business_idx ON social_profiles (business_id);

-- ---------------------------------------------------------------------------
-- lead_scores : precomputed, explainable scores. Search reads these.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_scores (
  business_id         uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  business_quality    real NOT NULL DEFAULT 0,
  commercial_value    real NOT NULL DEFAULT 0,
  digital_opportunity real NOT NULL DEFAULT 0,
  opportunity         real NOT NULL DEFAULT 0,
  evidence_score      real NOT NULL DEFAULT 0,
  weights             jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons             jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown           jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_version       integer NOT NULL DEFAULT 1,
  computed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_scores_opportunity_idx ON lead_scores (opportunity DESC);

-- ---------------------------------------------------------------------------
-- ai_analyses : the AI result cache and analysis store
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_analyses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider           text NOT NULL,
  stage              text NOT NULL,
  cache_key          text NOT NULL UNIQUE,
  model              text NOT NULL,
  prompt_version     integer NOT NULL,
  audit_version      integer NOT NULL,
  content_hash       text NOT NULL,
  input_summary      jsonb NOT NULL DEFAULT '{}'::jsonb,
  output             jsonb NOT NULL,
  latency_ms         integer,
  prompt_tokens      integer,
  completion_tokens  integer,
  estimated_cost_usd numeric(12, 6),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_analyses_provider_check CHECK (provider IN ('groq', 'claude'))
);

CREATE INDEX IF NOT EXISTS ai_analyses_business_idx ON ai_analyses (business_id, provider, created_at DESC);

-- ---------------------------------------------------------------------------
-- ai_usage_events : cache hit/miss, latency and cost telemetry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid REFERENCES businesses(id) ON DELETE SET NULL,
  provider           text NOT NULL,
  stage              text NOT NULL,
  model              text NOT NULL,
  cache_hit          boolean NOT NULL,
  latency_ms         integer,
  prompt_tokens      integer,
  completion_tokens  integer,
  estimated_cost_usd numeric(12, 6),
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx ON ai_usage_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- demos : generated website concepts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug        text NOT NULL UNIQUE,
  title       text NOT NULL,
  concept     jsonb NOT NULL DEFAULT '{}'::jsonb,
  html        text NOT NULL,
  generator   text NOT NULL DEFAULT 'deterministic',
  status      text NOT NULL DEFAULT 'ready',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demos_business_idx ON demos (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- crm_status : pipeline state per prospect
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_status (
  business_id    uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'new',
  owner          text,
  notes          text,
  next_action_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_status_status_check CHECK (
    status IN ('new', 'shortlisted', 'contacted', 'meeting', 'proposal', 'won', 'lost', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS crm_status_status_idx ON crm_status (status);

-- ---------------------------------------------------------------------------
-- suppression_list : never index, never contact
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppression_list (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL,
  value      text NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppression_kind_check CHECK (kind IN ('domain', 'phone', 'email', 'business', 'name')),
  UNIQUE (kind, value)
);

-- ---------------------------------------------------------------------------
-- crawl_jobs / crawl_events : background queue and its audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     text NOT NULL,
  target_id    uuid,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'queued',
  priority     integer NOT NULL DEFAULT 100,
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crawl_jobs_status_check
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS crawl_jobs_claim_idx  ON crawl_jobs (status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS crawl_jobs_target_idx ON crawl_jobs (target_id) WHERE target_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crawl_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  level       text NOT NULL DEFAULT 'info',
  message     text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crawl_events_job_idx     ON crawl_events (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crawl_events_created_idx ON crawl_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- search_index : denormalised and precomputed.
-- This is the ONLY table /api/search reads. No joins, no live enrichment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_index (
  business_id         uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  name                text NOT NULL,
  name_normalized     text NOT NULL,
  category            text NOT NULL,
  category_label      text NOT NULL,
  keywords            text NOT NULL DEFAULT '',
  city                text,
  municipality        text,
  postal_code         text,
  address             text,
  latitude            double precision,
  longitude           double precision,
  location_confidence real NOT NULL DEFAULT 0,
  rating              numeric(3, 2),
  review_count        integer,
  has_website         boolean NOT NULL DEFAULT false,
  website_domain      text,
  website_verdict     text,
  business_quality    real NOT NULL DEFAULT 0,
  commercial_value    real NOT NULL DEFAULT 0,
  digital_opportunity real NOT NULL DEFAULT 0,
  opportunity         real NOT NULL DEFAULT 0,
  evidence_score      real NOT NULL DEFAULT 0,
  top_reasons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  document            tsvector NOT NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_index_document_idx      ON search_index USING gin (document);
CREATE INDEX IF NOT EXISTS search_index_name_trgm_idx     ON search_index USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS search_index_keywords_trgm_idx ON search_index USING gin (keywords gin_trgm_ops);
CREATE INDEX IF NOT EXISTS search_index_opportunity_idx   ON search_index (opportunity DESC);
CREATE INDEX IF NOT EXISTS search_index_category_idx      ON search_index (category, opportunity DESC);
