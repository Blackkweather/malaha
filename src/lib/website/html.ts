/**
 * Lightweight HTML signal extraction.
 *
 * The auditor only needs a fixed set of structural signals, so a targeted
 * scanner is used instead of a full DOM parser: it is faster, has no
 * dependencies, and cannot be tripped up by malformed markup.
 */

export interface LinkInfo {
  href: string;
  text: string;
  rel: string | null;
}

export interface HtmlAnalysis {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  lang: string | null;
  hasViewportMeta: boolean;
  viewportContent: string | null;
  headings: { level: number; text: string }[];
  h1Count: number;
  imageCount: number;
  imagesWithAlt: number;
  /**
   * Imagery published by the business itself.
   *
   * A concept illustrated with the business's own photographs is far more
   * persuasive than one dressed in stock, and these are already public on
   * their own site. Absolute http(s) URLs only.
   */
  ogImage: string | null;
  logoUrl: string | null;
  imageUrls: string[];
  links: LinkInfo[];
  telLinks: string[];
  mailtoLinks: string[];
  whatsappLinks: string[];
  bookingLinks: string[];
  socialLinks: { platform: string; url: string }[];
  formCount: number;
  hasContactForm: boolean;
  scriptSources: string[];
  hasAnalytics: boolean;
  usesLegacyMarkup: boolean;
  usesFixedWidth: boolean;
  copyrightYear: number | null;
  ctaTexts: string[];
  textContent: string;
  generator: string | null;
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f']);

/**
 * Reads an attribute value out of a single start tag.
 *
 * Written as a scanner rather than a built regex so the attribute name is never
 * interpolated into a pattern, and so unquoted and single-quoted values are
 * handled the same way browsers handle them.
 */
export function attr(tag: string, name: string): string | null {
  const lower = tag.toLowerCase();
  const target = name.toLowerCase();
  let cursor = 0;

  while (cursor < lower.length) {
    const at = lower.indexOf(target, cursor);
    if (at === -1) return null;
    cursor = at + target.length;

    // The name must start a new attribute, not sit inside a longer one.
    const before = at === 0 ? ' ' : lower[at - 1];
    if (!WHITESPACE.has(before) && before !== '<') continue;

    let i = cursor;
    while (i < lower.length && WHITESPACE.has(lower[i])) i += 1;
    if (lower[i] !== '=') continue;
    i += 1;
    while (i < lower.length && WHITESPACE.has(lower[i])) i += 1;

    const quote = tag[i];
    if (quote === '"' || quote === "'") {
      const close = tag.indexOf(quote, i + 1);
      if (close === -1) return null;
      return decodeEntities(tag.slice(i + 1, close)).trim();
    }

    let valueEnd = i;
    while (valueEnd < tag.length && !WHITESPACE.has(tag[valueEnd]) && tag[valueEnd] !== '>') {
      valueEnd += 1;
    }
    return decodeEntities(tag.slice(i, valueEnd)).trim();
  }

  return null;
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const SOCIAL_PLATFORMS: [string, RegExp][] = [
  ['facebook', /facebook\.com/i],
  ['instagram', /instagram\.com/i],
  ['twitter', /(twitter\.com|x\.com)/i],
  ['linkedin', /linkedin\.com/i],
  ['youtube', /youtube\.com|youtu\.be/i],
  ['tiktok', /tiktok\.com/i],
];

const BOOKING_PATTERNS =
  /(booking|reserva|reservar|cita|citas|appointment|book-now|agendar|calendly|doctoralia|treatwell|thefork|eltenedor|bookitit)/i;

const CTA_PATTERNS =
  /(pedir cita|reservar|reserva|contactar|contacto|llamar|solicitar|presupuesto|book now|get in touch|request|comprar|agendar)/i;

const ANALYTICS_PATTERNS =
  /(googletagmanager\.com|google-analytics\.com|gtag\(|analytics\.js|plausible\.io|matomo|hotjar|clarity\.ms|fbevents\.js|segment\.com)/i;

export function analyzeHtml(html: string, baseUrl: string): HtmlAnalysis {
  const lower = html.toLowerCase();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : null;

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  let metaDescription: string | null = null;
  let hasViewportMeta = false;
  let viewportContent: string | null = null;
  let generator: string | null = null;
  let ogImage: string | null = null;

  for (const tag of metaTags) {
    const name = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase();
    const content = attr(tag, 'content');
    if (name === 'description' && content) metaDescription = content;
    if (name === 'viewport') {
      hasViewportMeta = true;
      viewportContent = content;
    }
    if (name === 'generator' && content) generator = content;
    // og:image is the business's own chosen hero shot, so it is preferred
    // over anything scraped out of the body.
    if ((name === 'og:image' || name === 'twitter:image') && content && ogImage === null) {
      ogImage = content;
    }
  }

  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find(
    (tag) => (attr(tag, 'rel') ?? '').toLowerCase() === 'canonical',
  );
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;

  const htmlTag = html.match(/<html\b[^>]*>/i);
  const lang = htmlTag ? attr(htmlTag[0], 'lang') : null;

  const headings: { level: number; text: string }[] = [];
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: Number(match[1]), text: stripTags(match[2]).slice(0, 200) });
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithAlt = imgTags.filter((tag) => {
    const alt = attr(tag, 'alt');
    return alt !== null && alt !== '';
  }).length;

  /*
   * Collect the imagery the site actually publishes.
   *
   * Only http(s) is accepted: a data: URI would bloat the stored record and
   * anything else is not fetchable. Sprites, spacers, tracking pixels and
   * icons are filtered by name because they are never usable as photography,
   * and a concept built around a 1x1 pixel is worse than one with no picture.
   */
  const absolute = (value: string | null): string | null => {
    if (!value) return null;
    try {
      const url = new URL(value, baseUrl);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  };

  const JUNK_IMAGE =
    /(sprite|spacer|pixel|1x1|blank|placeholder|loader|loading|icon-|[/]icons?[/]|badge|avatar|captcha|tracking)/i;

  const imageUrls: string[] = [];
  for (const tag of imgTags) {
    const raw = attr(tag, 'src') ?? attr(tag, 'data-src') ?? attr(tag, 'data-lazy-src');
    const url = absolute(raw);
    if (!url) continue;
    if (JUNK_IMAGE.test(url)) continue;
    // Vector icons are not photography, whatever the query string says.
    if (url.toLowerCase().split("?")[0].endsWith(".svg")) continue;
    if (!imageUrls.includes(url)) imageUrls.push(url);
    if (imageUrls.length >= 12) break;
  }

  const iconTag = (html.match(/<link[^>]*>/gi) ?? []).find((tag) => {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    return rel.includes('apple-touch-icon') || rel === 'icon' || rel === 'shortcut icon';
  });
  const logoUrl = iconTag ? absolute(attr(iconTag, 'href')) : null;

  const links: LinkInfo[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const openTag = '<a ' + match[1] + '>';
    const href = attr(openTag, 'href');
    if (!href) continue;
    links.push({ href, text: stripTags(match[2]).slice(0, 120), rel: attr(openTag, 'rel') });
  }

  const telLinks = links.filter((l) => /^tel:/i.test(l.href)).map((l) => l.href);
  const mailtoLinks = links.filter((l) => /^mailto:/i.test(l.href)).map((l) => l.href);
  const whatsappLinks = links
    .filter((l) => /(wa\.me|api\.whatsapp\.com|whatsapp:)/i.test(l.href))
    .map((l) => l.href);
  const bookingLinks = links
    .filter((l) => BOOKING_PATTERNS.test(l.href) || BOOKING_PATTERNS.test(l.text))
    .map((l) => l.href);

  const socialLinks: { platform: string; url: string }[] = [];
  for (const link of links) {
    for (const [platform, pattern] of SOCIAL_PLATFORMS) {
      if (pattern.test(link.href) && !socialLinks.some((s) => s.platform === platform)) {
        try {
          socialLinks.push({ platform, url: new URL(link.href, baseUrl).toString() });
        } catch {
          /* malformed href, ignore */
        }
      }
    }
  }

  const formTags = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  const hasContactForm = formTags.some((form) => {
    const f = form.toLowerCase();
    return (
      /type\s*=\s*["']?email/.test(f) ||
      /<textarea/.test(f) ||
      /(contacto|contact|mensaje|message|consulta)/.test(f)
    );
  });

  const scriptSources = (html.match(/<script\b[^>]*>/gi) ?? [])
    .map((tag) => attr(tag, 'src'))
    .filter((src): src is string => src !== null);

  const copyrightMatch = html.match(/(?:&copy;|copyright|©)[^0-9]{0,20}((?:19|20)\d{2})/i);
  const copyrightYear = copyrightMatch ? Number(copyrightMatch[1]) : null;

  const ctaTexts = links
    .filter((l) => CTA_PATTERNS.test(l.text))
    .map((l) => l.text)
    .filter(Boolean)
    .slice(0, 10);

  const buttonTexts = (html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) ?? [])
    .map((b) => stripTags(b))
    .filter((t) => CTA_PATTERNS.test(t));
  ctaTexts.push(...buttonTexts.slice(0, 5));

  return {
    title,
    metaDescription,
    canonical,
    lang,
    hasViewportMeta,
    viewportContent,
    headings,
    h1Count: headings.filter((h) => h.level === 1).length,
    imageCount: imgTags.length,
    ogImage: absolute(ogImage),
    logoUrl,
    imageUrls,
    imagesWithAlt,
    links,
    telLinks,
    mailtoLinks,
    whatsappLinks,
    bookingLinks,
    socialLinks,
    formCount: formTags.length,
    hasContactForm,
    scriptSources,
    hasAnalytics: ANALYTICS_PATTERNS.test(html),
    usesLegacyMarkup: /<frameset|<frame\b|<marquee|<center\b|<font\b/i.test(lower),
    usesFixedWidth:
      /width\s*:\s*(9[0-9][0-9]|1[0-9]{3})px/i.test(html) ||
      /<table[^>]+width\s*=\s*["']?\d{3,}/i.test(html),
    copyrightYear,
    ctaTexts: [...new Set(ctaTexts)],
    textContent: stripTags(html).slice(0, 20000),
    generator,
  };
}

/**
 * True when a page returns almost no text but loads scripts — the signature of
 * a client-rendered app that needs a real browser to evaluate.
 */
export function needsJavaScriptRendering(analysis: HtmlAnalysis, html: string): boolean {
  const hasAppRoot = /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html);
  const thinContent = analysis.textContent.length < 400;
  const hasScripts = analysis.scriptSources.length > 0;
  return thinContent && hasScripts && (hasAppRoot || analysis.headings.length === 0);
}
