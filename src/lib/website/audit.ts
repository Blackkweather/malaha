import { config } from '../config';
import { isFreeSiteBuilderHost } from '../normalize/domain';
import { checkLink, fetchPage } from './fetch';
import { analyzeHtml, needsJavaScriptRendering, type HtmlAnalysis } from './html';
import { renderWithPlaywright } from './render';

export type PageType = 'home' | 'contact' | 'about' | 'services' | 'booking' | 'other';

export interface AuditedPage {
  url: string;
  pageType: PageType;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  contentHash: string;
  renderedWith: 'http' | 'playwright';
  bytes: number;
  responseTimeMs: number;
  textExcerpt: string;
}

export interface AuditMetrics {
  usesHttps: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  redirectChain: string[];
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  canonical: string | null;
  lang: string | null;
  hasViewportMeta: boolean;
  h1Count: number;
  headingLevels: number[];
  imageCount: number;
  imagesWithAlt: number;
  imageAltCoverage: number;
  brokenLinks: string[];
  internalLinksChecked: number;
  hasTelLink: boolean;
  hasEmailLink: boolean;
  hasWhatsAppLink: boolean;
  hasBookingLink: boolean;
  hasContactForm: boolean;
  hasContactPage: boolean;
  ctaCount: number;
  socialLinks: { platform: string; url: string }[];
  hasAnalytics: boolean;
  usesLegacyMarkup: boolean;
  usesFixedWidth: boolean;
  copyrightYear: number | null;
  generator: string | null;
  freeSiteBuilder: boolean;
  pagesCrawled: number;
  renderedWithPlaywright: boolean;
  detectedServices: string[];
  /**
   * Imagery the business already publishes, kept so a generated concept can
   * be illustrated with their own photographs instead of stock.
   */
  ogImage: string | null;
  logoUrl: string | null;
  imageUrls: string[];
}

export interface AuditResult {
  ok: boolean;
  error: string | null;
  metrics: AuditMetrics;
  issueCodes: string[];
  pages: AuditedPage[];
  contentHash: string;
  summary: string;
}

/** Priority pages, in the order the specification requires. */
const PAGE_PATTERNS: { type: PageType; pattern: RegExp }[] = [
  { type: 'contact', pattern: /(contacto|contact|donde-estamos|localizacion)/i },
  { type: 'services', pattern: /(servicios|services|tratamientos|treatments|especialidades|productos)/i },
  { type: 'about', pattern: /(nosotros|about|quienes-somos|equipo|clinica|empresa)/i },
  { type: 'booking', pattern: /(cita|reserva|booking|appointment|agendar|book)/i },
];

const SERVICE_HINT_PATTERN =
  /(implante[s]?|ortodoncia|invisalign|blanqueamiento|endodoncia|periodoncia|estetica dental|cirugia|rehabilitacion|fisioterapia|masaje|nutricion|asesoria|reforma[s]?|obra nueva|alquiler|venta|tasacion|catering|banquete|menu degustacion|spa|tratamiento[s]?|consulta|urgencias)/gi;

function classifyPageType(url: string): PageType {
  for (const { type, pattern } of PAGE_PATTERNS) {
    if (pattern.test(url)) return type;
  }
  return 'other';
}

/** Picks the small set of pages worth inspecting, respecting the page budget. */
export function selectPriorityPages(
  analysis: HtmlAnalysis,
  baseUrl: string,
  maxPages: number,
): { url: string; pageType: PageType }[] {
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>([baseUrl.replace(/\/$/, '')]);
  const selected: { url: string; pageType: PageType }[] = [];

  const byType = new Map<PageType, string>();

  for (const link of analysis.links) {
    let resolved: URL;
    try {
      resolved = new URL(link.href, baseUrl);
    } catch {
      continue;
    }
    if (resolved.origin !== origin) continue;
    if (!/^https?:$/.test(resolved.protocol)) continue;

    resolved.hash = '';
    const normalized = resolved.toString().replace(/\/$/, '');
    if (seen.has(normalized)) continue;

    const pageType = classifyPageType(resolved.pathname + ' ' + link.text);
    if (pageType === 'other') continue;
    if (byType.has(pageType)) continue;

    byType.set(pageType, normalized);
    seen.add(normalized);
    selected.push({ url: normalized, pageType });
    if (selected.length >= maxPages - 1) break;
  }

  return selected;
}

function buildIssueCodes(m: AuditMetrics, homepageOk: boolean): string[] {
  const codes: string[] = [];
  const currentYear = new Date().getFullYear();

  if (!homepageOk) codes.push('http_error_status');
  if (!m.usesHttps) codes.push('no_https');
  if (!m.hasViewportMeta) codes.push('no_mobile_viewport');
  else if (m.usesFixedWidth) codes.push('fixed_width_layout');

  if (m.responseTimeMs > 3500) codes.push('very_slow_response');
  else if (m.responseTimeMs > 1800) codes.push('slow_response');

  if (!m.hasTelLink) codes.push('no_phone_link');
  if (!m.hasContactForm && !m.hasEmailLink && !m.hasContactPage) codes.push('no_contact_path');
  if (!m.hasBookingLink) codes.push('no_booking_path');
  if (!m.hasWhatsAppLink) codes.push('no_whatsapp');
  if (m.ctaCount === 0) codes.push('weak_cta');

  if (!m.title || m.titleLength < 10) codes.push('missing_title');
  if (!m.metaDescription) codes.push('missing_meta_description');
  if (m.h1Count === 0) codes.push('missing_h1');
  if (m.headingLevels.length > 1) {
    const skipped = m.headingLevels.some((level, i) => i > 0 && level - m.headingLevels[i - 1] > 1);
    if (skipped) codes.push('broken_heading_structure');
  }
  if (!m.canonical) codes.push('missing_canonical');

  if (m.imageCount >= 4 && m.imageAltCoverage < 0.6) codes.push('low_image_alt_coverage');
  if (!m.lang) codes.push('no_lang_attribute');

  if (m.brokenLinks.length > 0) codes.push('broken_links');
  if (m.socialLinks.length === 0) codes.push('no_social_links');

  if (m.copyrightYear !== null && m.copyrightYear < currentYear - 1) codes.push('stale_copyright');
  if (m.usesLegacyMarkup) codes.push('legacy_markup');
  if (m.freeSiteBuilder) codes.push('free_site_builder');
  if (!m.hasAnalytics) codes.push('no_analytics');

  return codes;
}

function summarise(m: AuditMetrics, codes: string[]): string {
  if (codes.includes('http_error_status')) return 'The homepage does not load successfully.';
  const highlights: string[] = [];
  if (codes.includes('no_mobile_viewport')) highlights.push('no responsive mobile layout');
  if (codes.includes('no_contact_path')) highlights.push('no usable contact path');
  if (codes.includes('no_booking_path')) highlights.push('no online booking');
  if (codes.includes('very_slow_response') || codes.includes('slow_response')) {
    highlights.push(`slow response (${m.responseTimeMs} ms)`);
  }
  if (codes.includes('legacy_markup') || codes.includes('stale_copyright')) {
    highlights.push('dated build');
  }
  if (highlights.length === 0) {
    return `Audited ${m.pagesCrawled} pages; the site is technically sound with only minor findings.`;
  }
  return `Audited ${m.pagesCrawled} pages. Key problems: ${highlights.join(', ')}.`;
}

/**
 * Audits a website.
 *
 * The fast HTTP crawler runs first. Playwright is used only when the homepage
 * is clearly a JavaScript shell. Only the priority pages listed in the spec are
 * inspected, capped by AUDIT_MAX_PAGES, so no site is crawled exhaustively.
 */
export async function auditWebsite(startUrl: string): Promise<AuditResult> {
  const maxPages = Math.max(1, config.audit.maxPages);
  const pages: AuditedPage[] = [];

  let home = await fetchPage(startUrl);
  let renderedWithPlaywright = false;

  if (home.html === '' && home.blockedByRobots) {
    return {
      ok: false,
      error: 'Disallowed by robots.txt',
      metrics: emptyMetrics(home.usedHttps, home.status, home.responseTimeMs),
      issueCodes: [],
      pages: [],
      contentHash: '',
      summary: 'The site disallows automated access, so no audit was performed.',
    };
  }

  if (!home.ok || home.html === '') {
    return {
      ok: false,
      error: home.error ?? 'Homepage did not load',
      metrics: emptyMetrics(home.usedHttps, home.status, home.responseTimeMs),
      issueCodes: ['http_error_status'],
      pages: [],
      contentHash: home.contentHash,
      summary: `The homepage did not load (${home.error ?? 'no response'}).`,
    };
  }

  let analysis = analyzeHtml(home.html, home.finalUrl);

  if (needsJavaScriptRendering(analysis, home.html)) {
    const rendered = await renderWithPlaywright(home.finalUrl);
    if (rendered) {
      renderedWithPlaywright = true;
      analysis = analyzeHtml(rendered.html, rendered.finalUrl);
      home = { ...home, html: rendered.html, finalUrl: rendered.finalUrl };
    }
  }

  pages.push({
    url: home.finalUrl,
    pageType: 'home',
    status: home.status,
    title: analysis.title,
    metaDescription: analysis.metaDescription,
    contentHash: home.contentHash,
    renderedWith: renderedWithPlaywright ? 'playwright' : 'http',
    bytes: home.bytes,
    responseTimeMs: home.responseTimeMs,
    textExcerpt: analysis.textContent.slice(0, 1500),
  });

  // --- Priority pages ------------------------------------------------------
  const priorityPages = selectPriorityPages(analysis, home.finalUrl, maxPages);
  const secondaryAnalyses: HtmlAnalysis[] = [];

  for (const target of priorityPages) {
    const page = await fetchPage(target.url);
    if (!page.ok || page.html === '') continue;
    const pageAnalysis = analyzeHtml(page.html, page.finalUrl);
    secondaryAnalyses.push(pageAnalysis);
    pages.push({
      url: page.finalUrl,
      pageType: target.pageType,
      status: page.status,
      title: pageAnalysis.title,
      metaDescription: pageAnalysis.metaDescription,
      contentHash: page.contentHash,
      renderedWith: 'http',
      bytes: page.bytes,
      responseTimeMs: page.responseTimeMs,
      textExcerpt: pageAnalysis.textContent.slice(0, 1500),
    });
  }

  // --- Broken-link sample --------------------------------------------------
  const origin = new URL(home.finalUrl).origin;
  const internalTargets = [
    ...new Set(
      analysis.links
        .map((l) => {
          try {
            const u = new URL(l.href, home.finalUrl);
            u.hash = '';
            return u.origin === origin && /^https?:$/.test(u.protocol) ? u.toString() : null;
          } catch {
            return null;
          }
        })
        .filter((u): u is string => u !== null),
    ),
  ].slice(0, 10);

  const linkResults = await Promise.all(
    internalTargets.map(async (url) => ({ url, result: await checkLink(url) })),
  );
  const brokenLinks = linkResults.filter((r) => !r.result.ok).map((r) => r.url);

  // --- Aggregate signals across the inspected pages ------------------------
  const all = [analysis, ...secondaryAnalyses];
  const any = (predicate: (a: HtmlAnalysis) => boolean): boolean => all.some(predicate);

  const services = new Set<string>();
  for (const page of all) {
    for (const match of page.textContent.matchAll(SERVICE_HINT_PATTERN)) {
      services.add(match[0].toLowerCase());
    }
  }

  const metrics: AuditMetrics = {
    usesHttps: home.usedHttps,
    httpStatus: home.status,
    responseTimeMs: home.responseTimeMs,
    redirectChain: home.redirectChain,
    title: analysis.title,
    titleLength: analysis.title?.length ?? 0,
    metaDescription: analysis.metaDescription,
    canonical: analysis.canonical,
    lang: analysis.lang,
    hasViewportMeta: analysis.hasViewportMeta,
    h1Count: analysis.h1Count,
    headingLevels: analysis.headings.map((h) => h.level),
    imageCount: analysis.imageCount,
    imagesWithAlt: analysis.imagesWithAlt,
    imageAltCoverage:
      analysis.imageCount === 0 ? 1 : analysis.imagesWithAlt / analysis.imageCount,
    brokenLinks,
    internalLinksChecked: internalTargets.length,
    hasTelLink: any((a) => a.telLinks.length > 0),
    hasEmailLink: any((a) => a.mailtoLinks.length > 0),
    hasWhatsAppLink: any((a) => a.whatsappLinks.length > 0),
    hasBookingLink: any((a) => a.bookingLinks.length > 0),
    hasContactForm: any((a) => a.hasContactForm),
    hasContactPage: pages.some((p) => p.pageType === 'contact'),
    ctaCount: analysis.ctaTexts.length,
    socialLinks: analysis.socialLinks,
    hasAnalytics: any((a) => a.hasAnalytics),
    usesLegacyMarkup: any((a) => a.usesLegacyMarkup),
    usesFixedWidth: analysis.usesFixedWidth,
    copyrightYear: analysis.copyrightYear,
    generator: analysis.generator,
    freeSiteBuilder: isFreeSiteBuilderHost(home.finalUrl),
    pagesCrawled: pages.length,
    renderedWithPlaywright,
    detectedServices: [...services].slice(0, 25),
    ogImage: analysis.ogImage,
    logoUrl: analysis.logoUrl,
    imageUrls: analysis.imageUrls,
  };

  const issueCodes = buildIssueCodes(metrics, home.ok);

  return {
    ok: true,
    error: null,
    metrics,
    issueCodes,
    pages,
    contentHash: home.contentHash,
    summary: summarise(metrics, issueCodes),
  };
}

function emptyMetrics(
  usesHttps: boolean,
  status: number | null,
  responseTimeMs: number,
): AuditMetrics {
  return {
    usesHttps,
    httpStatus: status,
    responseTimeMs,
    redirectChain: [],
    title: null,
    titleLength: 0,
    metaDescription: null,
    canonical: null,
    lang: null,
    hasViewportMeta: false,
    h1Count: 0,
    headingLevels: [],
    imageCount: 0,
    imagesWithAlt: 0,
    imageAltCoverage: 0,
    brokenLinks: [],
    internalLinksChecked: 0,
    hasTelLink: false,
    hasEmailLink: false,
    hasWhatsAppLink: false,
    hasBookingLink: false,
    hasContactForm: false,
    hasContactPage: false,
    ctaCount: 0,
    socialLinks: [],
    hasAnalytics: false,
    usesLegacyMarkup: false,
    usesFixedWidth: false,
    copyrightYear: null,
    generator: null,
    freeSiteBuilder: false,
    pagesCrawled: 0,
    renderedWithPlaywright: false,
    detectedServices: [],
    ogImage: null,
    logoUrl: null,
    imageUrls: [],
  };
}
