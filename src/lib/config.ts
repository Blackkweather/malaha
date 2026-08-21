/**
 * Central configuration. Every tunable lives here and is sourced from the
 * environment so nothing operationally important is hard-coded in logic.
 */

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

function list(key: string): string[] {
  const v = process.env[key];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ScoreWeights {
  businessQuality: number;
  commercialValue: number;
  digitalOpportunity: number;
}

/**
 * Weights are normalised so the opportunity score is always on a 0..100 scale
 * even if an operator supplies weights that do not sum to exactly 1.
 */
export function normalizeWeights(w: ScoreWeights): ScoreWeights {
  const total = w.businessQuality + w.commercialValue + w.digitalOpportunity;
  if (!Number.isFinite(total) || total <= 0) {
    return { businessQuality: 0.35, commercialValue: 0.25, digitalOpportunity: 0.4 };
  }
  return {
    businessQuality: w.businessQuality / total,
    commercialValue: w.commercialValue / total,
    digitalOpportunity: w.digitalOpportunity / total,
  };
}

export const config = {
  env: str('NODE_ENV', 'development'),

  db: {
    url: str('DATABASE_URL', 'postgres://prospect:prospect@localhost:5544/prospect_finder'),
    /*
     * Sized for a hosted database, not a local socket. The detail view issues
     * nine queries concurrently, so a pool of ten sits exactly at the limit
     * and any other in-flight work waits for a connection.
     */
    poolMax: num('PGPOOL_MAX', 12),
    idleTimeoutMs: num('PGPOOL_IDLE_TIMEOUT_MS', 30000),
    /*
     * Five seconds was a localhost assumption. A managed Postgres that has
     * scaled to zero must wake before it can accept a connection, and the TLS
     * handshake over the network is not free either; the old default turned an
     * ordinary cold start into a 500.
     */
    connectionTimeoutMs: num('PGPOOL_CONNECTION_TIMEOUT_MS', 15000),
  },

  auth: {
    tokens: list('API_TOKENS'),
    requireAuthForReads: bool('REQUIRE_AUTH_FOR_READS', false),
    /**
     * When true, even the application's own UI must present a bearer token to
     * write. Leave false for a local single-user install.
     */
    requireTokenForUiWrites: bool('REQUIRE_TOKEN_FOR_UI_WRITES', false),
  },

  geo: {
    city: str('GEO_SCOPE_CITY', 'Malaga'),
    province: str('GEO_SCOPE_PROVINCE', 'Malaga'),
    country: str('GEO_SCOPE_COUNTRY', 'ES'),
    minLocationConfidence: num('GEO_MIN_LOCATION_CONFIDENCE', 0.7),
  },

  search: {
    defaultLimit: num('SEARCH_DEFAULT_LIMIT', 10),
    maxLimit: num('SEARCH_MAX_LIMIT', 25),
    minOpportunityScore: num('SEARCH_MIN_OPPORTUNITY_SCORE', 45),
    minEvidenceScore: num('SEARCH_MIN_EVIDENCE_SCORE', 0.35),
  },

  weights: normalizeWeights({
    businessQuality: num('WEIGHT_BUSINESS_QUALITY', 0.35),
    commercialValue: num('WEIGHT_COMMERCIAL_VALUE', 0.25),
    digitalOpportunity: num('WEIGHT_DIGITAL_OPPORTUNITY', 0.4),
  }),

  audit: {
    userAgent: str('AUDIT_USER_AGENT', 'MalagaProspectFinder/1.0 (+https://example.com/bot)'),
    maxPages: num('AUDIT_MAX_PAGES', 8),
    timeoutMs: num('AUDIT_TIMEOUT_MS', 12000),
    concurrency: num('AUDIT_CONCURRENCY', 4),
    enablePlaywright: bool('AUDIT_ENABLE_PLAYWRIGHT', false),
    version: 3,
  },

  sources: {
    overpassEndpoint: str('OVERPASS_ENDPOINT', 'https://overpass-api.de/api/interpreter'),
    // Overpass rejects the descriptive parenthesised agent string the auditor
    // uses, so it gets its own plain identifier.
    overpassUserAgent: str('OVERPASS_USER_AGENT', 'MalagaProspectFinder/1.0'),
    overpassTimeoutMs: num('OVERPASS_TIMEOUT_MS', 90000),
    googlePlacesApiKey: str('GOOGLE_PLACES_API_KEY', ''),
  },

  ai: {
    groq: {
      apiKey: str('GROQ_API_KEY', ''),
      /*
       * Groq retired the Llama models; llama-3.3-70b-versatile now answers
       * 404 model_not_found and no llama build is offered any more. This one
       * is verified to honour response_format json_object, which both the
       * classifier and the outreach writer depend on.
       */
      model: str('GROQ_MODEL', 'openai/gpt-oss-120b'),
      maxCandidates: num('GROQ_MAX_CANDIDATES', 100),
      promptVersion: 2,
    },
    claude: {
      apiKey: str('ANTHROPIC_API_KEY', ''),
      model: str('ANTHROPIC_MODEL', 'claude-opus-5'),
      maxCandidates: num('CLAUDE_MAX_CANDIDATES', 30),
      promptVersion: 2,
    },
  },

  rateLimit: {
    windowMs: num('RATE_LIMIT_WINDOW_MS', 60000),
    maxReads: num('RATE_LIMIT_MAX_READS', 120),
    maxWrites: num('RATE_LIMIT_MAX_WRITES', 20),
  },
} as const;

export function groqEnabled(): boolean {
  return config.ai.groq.apiKey.trim().length > 0;
}

export function claudeEnabled(): boolean {
  return config.ai.claude.apiKey.trim().length > 0;
}

export function googlePlacesEnabled(): boolean {
  return config.sources.googlePlacesApiKey.trim().length > 0;
}
