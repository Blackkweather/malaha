/**
 * URL and domain normalisation.
 *
 * The registrable domain is the strongest deduplication signal we have, so it
 * has to be derived consistently: scheme-insensitive, www-insensitive, and
 * aware of the multi-label public suffixes common in Spain (.com.es, .co.uk).
 */

const MULTI_LABEL_SUFFIXES = new Set([
  'com.es',
  'org.es',
  'nom.es',
  'gob.es',
  'edu.es',
  'co.uk',
  'org.uk',
  'com.br',
  'com.ar',
  'com.mx',
]);

/** Hosts that are never a business's own website. */
const NON_OFFICIAL_HOSTS = new Set([
  'facebook.com',
  'm.facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
  'wa.me',
  'api.whatsapp.com',
  'google.com',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'tripadvisor.com',
  'tripadvisor.es',
  'yelp.com',
  'doctoralia.es',
  'booking.com',
  'thefork.com',
  'eltenedor.es',
  'paginasamarillas.es',
  'linktr.ee',
  'bit.ly',
  'sites.google.com',
  'business.site',
  'negocio.site',
]);

export function toUrl(input: string | null | undefined): URL | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

/** Lowercased hostname without a leading "www.". */
export function extractHost(input: string | null | undefined): string | null {
  const url = toUrl(input);
  if (!url) return null;
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** The registrable domain, e.g. "clinica.example.com.es" -> "example.com.es". */
export function extractDomain(input: string | null | undefined): string | null {
  const host = extractHost(input);
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/**
 * Canonical URL form used for storage and comparison: https scheme, no www,
 * no trailing slash on the path root, no tracking query parameters, no hash.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  const url = toUrl(input);
  if (!url) return null;

  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';

  const params = url.searchParams;
  for (const key of [...params.keys()]) {
    if (/^(utm_|fbclid|gclid|msclkid|mc_cid|mc_eid|ref)/i.test(key)) params.delete(key);
  }
  url.search = params.toString() ? `?${params.toString()}` : '';

  if (url.pathname === '/') url.pathname = '';
  else url.pathname = url.pathname.replace(/\/+$/, '');

  return url.toString();
}

/** True for aggregators, social networks and link shorteners. */
export function isNonOfficialHost(input: string | null | undefined): boolean {
  const host = extractHost(input);
  if (!host) return false;
  if (NON_OFFICIAL_HOSTS.has(host)) return true;
  const domain = extractDomain(host);
  return domain !== null && NON_OFFICIAL_HOSTS.has(domain);
}

/** Recognises the free site builders that signal an unrefined web presence. */
export function isFreeSiteBuilderHost(input: string | null | undefined): boolean {
  const host = extractHost(input);
  if (!host) return false;
  return /(\.wixsite\.com|\.wordpress\.com|\.blogspot\.|\.weebly\.com|\.jimdosite\.com|\.webnode\.|\.godaddysites\.com|business\.site|\.square\.site|\.myshopify\.com)$/i.test(
    host,
  );
}

export function sameDomain(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = extractDomain(a);
  const db = extractDomain(b);
  return da !== null && db !== null && da === db;
}
