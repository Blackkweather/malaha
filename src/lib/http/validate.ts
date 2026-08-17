import { z } from 'zod';

/** Search query parameters. The limit is hard-capped by the search module. */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  limit: z.coerce.number().int().min(1).max(25).optional(),
  category: z
    .string()
    .trim()
    .regex(/^[a-z_]{2,40}$/, 'Category must be a taxonomy key')
    .optional(),
});

export const topProspectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

export const uuidSchema = z.string().uuid('A valid business id is required');

export const importBodySchema = z
  .object({
    format: z.enum(['json', 'csv', 'manual']),
    /** CSV text, when format is "csv". */
    content: z.string().max(5_000_000).optional(),
    /** Parsed records, when format is "json" or "manual". */
    records: z.array(z.record(z.unknown())).max(5000).optional(),
  })
  .refine(
    (value) =>
      (value.format === 'csv' && typeof value.content === 'string' && value.content.trim() !== '') ||
      (value.format !== 'csv' && Array.isArray(value.records) && value.records.length > 0),
    { message: 'Provide `content` for CSV imports or a non-empty `records` array otherwise' },
  );

export const crmUpdateSchema = z.object({
  status: z.enum([
    'new',
    'shortlisted',
    'contacted',
    'meeting',
    'proposal',
    'won',
    'lost',
    'rejected',
  ]),
  owner: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(4000).nullish(),
  nextActionAt: z.string().datetime({ offset: true }).nullish(),
});

/**
 * Ingestion request.
 *
 * Categories are taxonomy keys, not free text, because they are mapped to a
 * fixed set of OpenStreetMap selectors — an arbitrary string would silently
 * widen the crawl. The city is deliberately absent: scope is configuration.
 */
export const ingestBodySchema = z.object({
  source: z.enum(['openstreetmap', 'google_places']).default('openstreetmap'),
  categories: z
    .array(z.string().regex(/^[a-z_]{2,40}$/))
    .min(1)
    .max(30)
    .optional(),
  query: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  /** Queue website audits, rescoring and reindexing behind the ingest. */
  enrich: z.boolean().optional().default(true),
});

export const pipelineBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  /** Skip businesses audited within this many days. Null forces a full re-audit. */
  staleAfterDays: z.coerce.number().int().min(0).max(365).nullish(),
});

export const runBodySchema = z.object({
  budgetMs: z.coerce.number().int().min(1000).max(280_000).optional(),
  maxJobs: z.coerce.number().int().min(1).max(500).optional(),
});

export const outreachBodySchema = z.object({
  language: z.enum(['es', 'en']).optional().default('es'),
  channel: z.enum(['email', 'whatsapp', 'call_script', 'linkedin']).optional().default('email'),
  senderName: z.string().trim().max(120).optional(),
  deterministicOnly: z.boolean().optional(),
});

export const exportQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  category: z
    .string()
    .trim()
    .regex(/^[a-z_]{2,40}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
});

export const demoSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,80}$/, 'Invalid demo slug');

/** Parses `searchParams` with a schema, returning a flat error list on failure. */
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) raw[key] = value;

  const result = schema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`),
  };
}

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`),
  };
}
