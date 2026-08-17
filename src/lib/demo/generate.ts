import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool';
import { logger } from '../logger';
import { normalizeBusinessName } from '../normalize/text';
import { getBusinessDetail } from '../repo/businesses';
import type { ClaudeAnalysis } from '../ai/claude';
import { buildConcept, type DemoConcept } from './concept';
import { renderDemoHtml } from './render';

export interface GeneratedDemo {
  id: string;
  slug: string;
  title: string;
  url: string;
  concept: DemoConcept;
  createdAt: string;
}

/** Builds a readable, collision-resistant slug for the demo URL. */
export function buildDemoSlug(businessName: string): string {
  const base = normalizeBusinessName(businessName).replace(/\s+/g, '-').slice(0, 48) || 'demo';
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

/**
 * Generates an original website concept for a prospect.
 *
 * The concept is assembled from public business facts already in the database
 * and, when available, the Claude brief's recommended CTA and positioning. The
 * existing website is never copied — only the facts about the business are used.
 */
export async function generateDemo(businessId: string): Promise<GeneratedDemo> {
  const detail = await getBusinessDetail(businessId);
  if (!detail) throw new Error(`Business ${businessId} not found`);

  const claudeRecord = detail.analyses.find((a) => a.provider === 'claude');
  const claude = (claudeRecord?.output as ClaudeAnalysis | undefined) ?? null;

  const concept = buildConcept(detail, claude);
  const html = renderDemoHtml(concept);
  const slug = buildDemoSlug(detail.business.name);
  const title = `${detail.business.name} — website concept`;

  const row = await queryOne<{ id: string; created_at: Date }>(
    `INSERT INTO demos (business_id, slug, title, concept, html, generator, status)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'ready')
     RETURNING id, created_at`,
    [
      businessId,
      slug,
      title,
      JSON.stringify(concept),
      html,
      claude ? 'facts_and_claude' : 'deterministic',
    ],
  );

  if (!row) throw new Error('Failed to store the generated demo');

  logger.info('demo generated', { businessId, slug, generator: concept.generatedFrom });

  return {
    id: row.id,
    slug,
    title,
    url: `/demos/${slug}`,
    concept,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getDemoBySlug(
  slug: string,
): Promise<{ html: string; title: string; businessId: string } | null> {
  return queryOne<{ html: string; title: string; businessId: string }>(
    'SELECT html, title, business_id AS "businessId" FROM demos WHERE slug = $1',
    [slug],
  );
}

export async function listDemos(limit = 50): Promise<
  {
    id: string;
    slug: string;
    title: string;
    businessId: string;
    businessName: string;
    createdAt: Date;
    generator: string;
  }[]
> {
  return query(
    `SELECT d.id, d.slug, d.title, d.business_id AS "businessId", b.name AS "businessName",
            d.created_at AS "createdAt", d.generator
       FROM demos d JOIN businesses b ON b.id = d.business_id
      ORDER BY d.created_at DESC LIMIT $1`,
    [limit],
  ) as Promise<
    {
      id: string;
      slug: string;
      title: string;
      businessId: string;
      businessName: string;
      createdAt: Date;
      generator: string;
    }[]
  >;
}
