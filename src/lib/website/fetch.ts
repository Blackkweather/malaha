import crypto from 'node:crypto';
import { config } from '../config';
import { logger } from '../logger';
import { isPathAllowed, parseRobots, PERMISSIVE, type RobotsRules } from './robots';

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number | null;
  ok: boolean;
  html: string;
  bytes: number;
  responseTimeMs: number;
  redirectChain: string[];
  contentHash: string;
  usedHttps: boolean;
  error: string | null;
  /** True when robots.txt disallowed the path and nothing was fetched. */
  blockedByRobots: boolean;
}

/** Hard cap on downloaded HTML so a hostile response cannot exhaust memory. */
const MAX_BYTES = 2_500_000;

function emptyPage(url: string, error: string, blockedByRobots = false): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: null,
    ok: false,
    html: '',
    bytes: 0,
    responseTimeMs: 0,
    redirectChain: [],
    contentHash: '',
    usedHttps: url.startsWith('https://'),
    error,
    blockedByRobots,
  };
}

const robotsCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const ROBOTS_TTL_MS = 15 * 60 * 1000;

/** Fetches and caches robots.txt for an origin. */
export async function getRobots(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.rules;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': config.audit.userAgent },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!response.ok) {
      robotsCache.set(origin, { rules: PERMISSIVE, fetchedAt: Date.now() });
      return PERMISSIVE;
    }

    const rules = parseRobots(await response.text(), config.audit.userAgent);
    robotsCache.set(origin, { rules, fetchedAt: Date.now() });
    return rules;
  } catch {
    robotsCache.set(origin, { rules: PERMISSIVE, fetchedAt: Date.now() });
    return PERMISSIVE;
  }
}

/**
 * Fetches a single page over plain HTTP.
 *
 * This is the fast path used for every audit. It follows standard redirects,
 * enforces a timeout and a size cap, and never retries aggressively — a refusal
 * is recorded and the crawl moves on.
 */
export async function fetchPage(rawUrl: string, respectRobots = true): Promise<FetchedPage> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return emptyPage(rawUrl, 'Invalid URL');
  }

  if (respectRobots) {
    const rules = await getRobots(parsed.origin);
    if (!isPathAllowed(rules, parsed.pathname)) {
      logger.info('skipping page disallowed by robots.txt', { url: rawUrl });
      return emptyPage(rawUrl, 'Disallowed by robots.txt', true);
    }
    if (rules.crawlDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, rules.crawlDelayMs));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.audit.timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': config.audit.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    let html = '';
    if (contentType.includes('html') || contentType === '') {
      const buffer = await response.arrayBuffer();
      const sliced = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
      html = new TextDecoder('utf-8').decode(sliced);
    }

    const responseTimeMs = Date.now() - started;
    const finalUrl = response.url || parsed.toString();

    return {
      url: rawUrl,
      finalUrl,
      status: response.status,
      ok: response.ok,
      html,
      bytes: html.length,
      responseTimeMs,
      redirectChain: finalUrl !== parsed.toString() ? [parsed.toString(), finalUrl] : [],
      contentHash: crypto.createHash('sha256').update(html).digest('hex'),
      usedHttps: finalUrl.startsWith('https://'),
      error: response.ok ? null : `HTTP ${response.status}`,
      blockedByRobots: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const page = emptyPage(rawUrl, message === 'The operation was aborted.' ? 'Timeout' : message);
    page.responseTimeMs = Date.now() - started;
    return page;
  } finally {
    clearTimeout(timer);
  }
}

/** HEAD-style reachability probe used for broken-link checks. */
export async function checkLink(url: string): Promise<{ ok: boolean; status: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': config.audit.userAgent },
      redirect: 'follow',
      signal: controller.signal,
    });
    // Some servers reject HEAD; treat 405 as inconclusive rather than broken.
    if (response.status === 405) return { ok: true, status: 405 };
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}
