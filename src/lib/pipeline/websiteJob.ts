import { config } from '../config';
import { query, queryOne, withTransaction } from '../db/pool';
import { logger } from '../logger';
import { auditWebsite, type AuditResult } from '../website/audit';
import { discoverWebsite, type DiscoveryResult } from '../website/discover';
import { ISSUE_CATALOGUE } from '../website/issues';
import { websiteVerdict } from '../scoring/digitalOpportunity';

export interface WebsiteJobResult {
  businessId: string;
  discovery: DiscoveryResult;
  audit: AuditResult | null;
  websiteId: string | null;
  auditId: string | null;
  skipped: string | null;
}

/**
 * Discovers and audits the website for one business, storing every artefact:
 * the website record, the pages inspected, the audit run and its findings.
 */
export async function runWebsiteJob(businessId: string): Promise<WebsiteJobResult> {
  const business = await queryOne<{
    id: string;
    name: string;
    website_url: string | null;
    primary_phone: string | null;
    postal_code: string | null;
    city: string | null;
  }>(
    'SELECT id, name, website_url, primary_phone, postal_code, city FROM businesses WHERE id = $1',
    [businessId],
  );

  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  const discovery = await discoverWebsite({
    businessName: business.name,
    publishedUrl: business.website_url,
    phone: business.primary_phone,
    postalCode: business.postal_code,
    city: business.city,
  });

  if (!discovery.url || !discovery.domain) {
    // No website to audit. Remove any stale record so scoring sees the truth.
    await query('DELETE FROM websites WHERE business_id = $1', [businessId]);
    return {
      businessId,
      discovery,
      audit: null,
      websiteId: null,
      auditId: null,
      skipped: 'No official website could be verified',
    };
  }

  const websiteRow = await queryOne<{ id: string }>(
    `INSERT INTO websites (
       business_id, url, normalized_url, domain, final_url, is_official, official_confidence,
       discovery_method, reachable, http_status, redirect_chain, response_time_ms, uses_https,
       last_checked_at, last_error
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, now(), $14)
     ON CONFLICT (business_id) DO UPDATE SET
       url = EXCLUDED.url, normalized_url = EXCLUDED.normalized_url, domain = EXCLUDED.domain,
       final_url = EXCLUDED.final_url, is_official = EXCLUDED.is_official,
       official_confidence = EXCLUDED.official_confidence,
       discovery_method = EXCLUDED.discovery_method, reachable = EXCLUDED.reachable,
       http_status = EXCLUDED.http_status, redirect_chain = EXCLUDED.redirect_chain,
       response_time_ms = EXCLUDED.response_time_ms, uses_https = EXCLUDED.uses_https,
       last_checked_at = now(), last_error = EXCLUDED.last_error, updated_at = now()
     RETURNING id`,
    [
      businessId,
      discovery.url,
      discovery.normalizedUrl ?? discovery.url,
      discovery.domain,
      discovery.finalUrl,
      discovery.isOfficial,
      discovery.confidence,
      discovery.method,
      discovery.reachable,
      discovery.httpStatus,
      JSON.stringify(discovery.redirectChain),
      discovery.responseTimeMs,
      discovery.usesHttps,
      discovery.error,
    ],
  );

  const websiteId = websiteRow?.id ?? null;

  if (!discovery.reachable || !websiteId) {
    return {
      businessId,
      discovery,
      audit: null,
      websiteId,
      auditId: null,
      skipped: discovery.error ?? 'Website did not load',
    };
  }

  const audit = await auditWebsite(discovery.finalUrl ?? discovery.url);
  const auditId = await persistAudit(businessId, websiteId, audit);

  logger.info('website job complete', {
    businessId,
    domain: discovery.domain,
    issues: audit.issueCodes.length,
    pages: audit.pages.length,
  });

  return { businessId, discovery, audit, websiteId, auditId, skipped: null };
}

/** Stores an audit run, the pages it inspected and every finding. */
export async function persistAudit(
  businessId: string,
  websiteId: string,
  audit: AuditResult,
): Promise<string> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO website_audits (
         website_id, business_id, audit_version, started_at, finished_at,
         pages_crawled, content_hash, metrics, verdict, summary, ok, error
       ) VALUES ($1, $2, $3, now(), now(), $4, $5, $6::jsonb, $7, $8, $9, $10)
       RETURNING id`,
      [
        websiteId,
        businessId,
        config.audit.version,
        audit.pages.length,
        audit.contentHash,
        JSON.stringify(audit.metrics),
        websiteVerdict({
          hasWebsite: true,
          reachable: audit.ok,
          issueCodes: audit.issueCodes,
          socialProfileCount: audit.metrics.socialLinks.length,
        }),
        audit.summary,
        audit.ok,
        audit.error,
      ],
    );
    const auditId = rows[0].id;

    for (const page of audit.pages) {
      await client.query(
        `INSERT INTO website_pages (
           website_id, url, page_type, http_status, fetched_at, content_hash, title,
           meta_description, rendered_with, bytes, response_time_ms, text_excerpt
         ) VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (website_id, url) DO UPDATE SET
           page_type = EXCLUDED.page_type, http_status = EXCLUDED.http_status,
           fetched_at = now(), content_hash = EXCLUDED.content_hash, title = EXCLUDED.title,
           meta_description = EXCLUDED.meta_description, rendered_with = EXCLUDED.rendered_with,
           bytes = EXCLUDED.bytes, response_time_ms = EXCLUDED.response_time_ms,
           text_excerpt = EXCLUDED.text_excerpt`,
        [
          websiteId,
          page.url,
          page.pageType,
          page.status,
          page.contentHash,
          page.title,
          page.metaDescription,
          page.renderedWith,
          page.bytes,
          page.responseTimeMs,
          page.textExcerpt,
        ],
      );
    }

    for (const code of audit.issueCodes) {
      const definition = ISSUE_CATALOGUE[code];
      if (!definition) continue;
      await client.query(
        `INSERT INTO website_issues (
           audit_id, business_id, code, severity, category, title, detail, evidence, weight
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          auditId,
          businessId,
          definition.code,
          definition.severity,
          definition.category,
          definition.title,
          definition.detail,
          JSON.stringify({}),
          definition.weight,
        ],
      );
    }

    return auditId;
  });
}
