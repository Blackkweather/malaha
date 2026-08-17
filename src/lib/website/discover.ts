import { extractDomain, isFreeSiteBuilderHost, isNonOfficialHost, normalizeUrl } from '../normalize/domain';
import { nameSimilarity, normalizeText, stripDiacritics } from '../normalize/text';
import { normalizePhone } from '../normalize/phone';
import { fetchPage } from './fetch';
import { analyzeHtml } from './html';

export interface DiscoveryInput {
  businessName: string;
  /** Website URL as published by a public source, if any. */
  publishedUrl?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

export interface DiscoveryResult {
  url: string | null;
  normalizedUrl: string | null;
  domain: string | null;
  finalUrl: string | null;
  reachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  redirectChain: string[];
  usesHttps: boolean;
  isOfficial: boolean;
  confidence: number;
  method: 'source' | 'none';
  evidence: string[];
  error: string | null;
}

const NOT_FOUND: DiscoveryResult = {
  url: null,
  normalizedUrl: null,
  domain: null,
  finalUrl: null,
  reachable: false,
  httpStatus: null,
  responseTimeMs: null,
  redirectChain: [],
  usesHttps: false,
  isOfficial: false,
  confidence: 0,
  method: 'none',
  evidence: [],
  error: null,
};

/**
 * Scores how strongly a fetched page looks like the official site of a business.
 *
 * A similar-sounding domain is never enough on its own: the page has to
 * corroborate the business through its own content — the name in the title or
 * headings, the same phone number, or the same locality.
 */
export function scoreOfficialness(
  input: DiscoveryInput,
  page: { finalUrl: string; html: string },
): { confidence: number; evidence: string[] } {
  const evidence: string[] = [];
  let confidence = 0;

  const domain = extractDomain(page.finalUrl);
  const analysis = analyzeHtml(page.html, page.finalUrl);

  // --- Domain resembles the business name ---------------------------------
  if (domain) {
    const domainWord = normalizeText(domain.split('.')[0]).replace(/\s+/g, '');
    const nameWord = normalizeText(input.businessName).replace(/\s+/g, '');
    if (domainWord.length >= 4 && nameWord.includes(domainWord)) {
      confidence += 0.3;
      evidence.push(`Domain "${domain}" matches the business name`);
    } else if (nameSimilarity(domainWord, nameWord) > 0.6) {
      confidence += 0.2;
      evidence.push(`Domain "${domain}" closely resembles the business name`);
    }
  }

  // --- Business name appears in the page itself ----------------------------
  const haystack = normalizeText(
    [analysis.title ?? '', ...analysis.headings.map((h) => h.text), analysis.textContent.slice(0, 4000)].join(' '),
  );
  const nameNorm = normalizeText(input.businessName);
  if (nameNorm.length > 3 && haystack.includes(nameNorm)) {
    confidence += 0.4;
    evidence.push('Business name appears in the page title or content');
  } else {
    const tokens = nameNorm.split(' ').filter((t) => t.length > 3);
    const hits = tokens.filter((t) => haystack.includes(t)).length;
    if (tokens.length > 0 && hits / tokens.length >= 0.6) {
      confidence += 0.22;
      evidence.push('Most of the business name appears in the page content');
    }
  }

  // --- Phone number corroboration -----------------------------------------
  const expectedPhone = normalizePhone(input.phone);
  if (expectedPhone.national) {
    const digits = stripDiacritics(page.html).replace(/\D/g, '');
    if (digits.includes(expectedPhone.national)) {
      confidence += 0.3;
      evidence.push('The published phone number appears on the site');
    }
  }

  // --- Locality corroboration ---------------------------------------------
  if (input.postalCode && page.html.includes(input.postalCode)) {
    confidence += 0.12;
    evidence.push(`Postal code ${input.postalCode} appears on the site`);
  } else if (input.city && normalizeText(analysis.textContent).includes(normalizeText(input.city))) {
    confidence += 0.08;
    evidence.push(`City "${input.city}" appears on the site`);
  }

  return { confidence: Math.min(1, confidence), evidence };
}

/**
 * Verifies the website published for a business.
 *
 * Discovery is evidence-based, not guesswork: only a URL that a public source
 * actually published for this business is considered, and it still has to prove
 * it belongs to the business before it is marked official. Guessing domains
 * from the business name is deliberately not done, because an unrelated domain
 * with a similar name would produce a false audit.
 */
export async function discoverWebsite(input: DiscoveryInput): Promise<DiscoveryResult> {
  const published = normalizeUrl(input.publishedUrl);
  if (!published) return { ...NOT_FOUND };
  if (isNonOfficialHost(published)) {
    return {
      ...NOT_FOUND,
      evidence: ['The published URL is a social or directory profile, not an official website'],
    };
  }

  const page = await fetchPage(published);
  const domain = extractDomain(page.finalUrl || published);

  if (!page.ok || page.html === '') {
    return {
      ...NOT_FOUND,
      url: published,
      normalizedUrl: published,
      domain,
      finalUrl: page.finalUrl,
      reachable: false,
      httpStatus: page.status,
      responseTimeMs: page.responseTimeMs,
      redirectChain: page.redirectChain,
      usesHttps: page.usedHttps,
      method: 'source',
      confidence: 0.35,
      evidence: ['URL published by a public source, but it did not load successfully'],
      error: page.error,
    };
  }

  const { confidence, evidence } = scoreOfficialness(input, {
    finalUrl: page.finalUrl,
    html: page.html,
  });

  // A source-published URL already carries real weight; page evidence adds to it.
  const total = Math.min(1, 0.35 + confidence * 0.65);

  if (isFreeSiteBuilderHost(page.finalUrl)) {
    evidence.push('Hosted on a free site-builder subdomain');
  }

  return {
    url: published,
    normalizedUrl: normalizeUrl(page.finalUrl) ?? published,
    domain,
    finalUrl: page.finalUrl,
    reachable: true,
    httpStatus: page.status,
    responseTimeMs: page.responseTimeMs,
    redirectChain: page.redirectChain,
    usesHttps: page.usedHttps,
    isOfficial: total >= 0.6,
    confidence: Number(total.toFixed(3)),
    method: 'source',
    evidence: ['URL published by a public business source', ...evidence],
    error: null,
  };
}
