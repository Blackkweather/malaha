import { config } from '@/lib/config';
import { ensureSchema } from '@/lib/db/ensure';
import { query } from '@/lib/db/pool';
import { withGuard } from '@/lib/http/guard';
import { badRequest } from '@/lib/http/respond';
import { exportQuerySchema, parseQuery } from '@/lib/http/validate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ExportRow {
  business_id: string;
  name: string;
  category_label: string;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  primary_phone: string | null;
  primary_email: string | null;
  website_url: string | null;
  website_verdict: string | null;
  rating: string | null;
  review_count: number | null;
  business_quality: number;
  commercial_value: number;
  digital_opportunity: number;
  opportunity: number;
  crm_status: string | null;
  top_reasons: unknown;
  updated_at: Date;
}

const HEADERS = [
  'name',
  'category',
  'opportunity',
  'business_quality',
  'commercial_value',
  'digital_opportunity',
  'phone',
  'email',
  'website',
  'website_verdict',
  'rating',
  'review_count',
  'address',
  'postal_code',
  'city',
  'crm_status',
  'top_reasons',
  'prospect_id',
  'indexed_at',
] as const;

/**
 * Escapes one CSV field.
 *
 * The leading apostrophe on values starting with =, +, - or @ is deliberate:
 * without it a spreadsheet treats the cell as a formula, which turns an
 * exported phone number into a calculation and an exported name into a
 * possible injection vector when the file is opened in Excel.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

/**
 * GET /api/export/prospects
 *
 * The shortlist as a file you can work from — a spreadsheet, a CRM import, a
 * call list. Only indexed prospects are exported, so the export inherits the
 * same quality gate as search rather than dumping every stored row.
 */
export const GET = withGuard('read', async (request) => {
  await ensureSchema();

  const url = new URL(request.url);
  const parsed = parseQuery(exportQuerySchema, url.searchParams);
  if (!parsed.success) return badRequest('Invalid export query', parsed.errors);

  const { q, category, limit, minScore } = parsed.data;
  const conditions: string[] = ['s.opportunity >= $1'];
  const params: unknown[] = [minScore ?? config.search.minOpportunityScore];

  if (category) {
    params.push(category);
    conditions.push(`s.category = $${params.length}`);
  }
  if (q && q.trim() !== '') {
    params.push(`%${q.trim().toLowerCase()}%`);
    conditions.push(`(s.name_normalized LIKE $${params.length} OR s.keywords LIKE $${params.length})`);
  }
  params.push(limit ?? 500);

  const rows = await query<ExportRow>(
    `SELECT s.business_id, s.name, s.category_label, s.city, s.postal_code, s.address,
            b.primary_phone, b.primary_email, b.website_url,
            s.website_verdict, s.rating::text AS rating, s.review_count,
            s.business_quality, s.commercial_value, s.digital_opportunity, s.opportunity,
            c.status AS crm_status, s.top_reasons, s.updated_at
       FROM search_index s
       JOIN businesses b ON b.id = s.business_id
       LEFT JOIN crm_status c ON c.business_id = s.business_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.opportunity DESC
      LIMIT $${params.length}`,
    params,
  );

  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const reasons = Array.isArray(r.top_reasons) ? (r.top_reasons as unknown[]).join(' | ') : '';
    lines.push(
      [
        r.name,
        r.category_label,
        Math.round(r.opportunity),
        Math.round(r.business_quality),
        Math.round(r.commercial_value),
        Math.round(r.digital_opportunity),
        r.primary_phone,
        r.primary_email,
        r.website_url,
        r.website_verdict,
        r.rating,
        r.review_count,
        r.address,
        r.postal_code,
        r.city,
        r.crm_status ?? 'new',
        reasons,
        r.business_id,
        new Date(r.updated_at).toISOString(),
      ]
        .map(csvField)
        .join(','),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  // The BOM makes Excel read the accented Spanish names as UTF-8.
  const body = `﻿${lines.join('\r\n')}\r\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="malaga-prospects-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
