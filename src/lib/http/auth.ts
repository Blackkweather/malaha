import crypto from 'node:crypto';
import { config } from '../config';

export type AuthScope = 'read' | 'write';

export interface AuthResult {
  authorized: boolean;
  reason: string;
}

/** Constant-time comparison so token checking cannot be timed. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  const apiKey = request.headers.get('x-api-key');
  return apiKey ? apiKey.trim() : null;
}

/**
 * Authorises a request.
 *
 * Read operations are open unless REQUIRE_AUTH_FOR_READS is enabled. Writes
 * need either a valid bearer token or a same-origin request from the
 * application's own UI, so the action buttons work in a local install while
 * programmatic callers still have to authenticate.
 */
export function authorize(request: Request, scope: AuthScope): AuthResult {
  const tokens = config.auth.tokens;

  if (scope === 'read' && !config.auth.requireAuthForReads) {
    return { authorized: true, reason: 'Read access is open by configuration' };
  }

  const provided = extractToken(request);
  if (provided && tokens.some((token) => safeEqual(token, provided))) {
    return { authorized: true, reason: 'Valid token' };
  }

  if (scope === 'write' && !config.auth.requireTokenForUiWrites && isSameOriginRequest(request)) {
    return { authorized: true, reason: 'Same-origin request from the application UI' };
  }

  if (tokens.length === 0) {
    return {
      authorized: scope === 'read',
      reason:
        scope === 'read'
          ? 'No tokens configured'
          : 'No API_TOKENS are configured, so writes are only accepted from the application UI',
    };
  }

  return provided
    ? { authorized: false, reason: 'Invalid token' }
    : { authorized: false, reason: 'Missing bearer token' };
}

/**
 * Detects a request issued by our own UI running on the same origin.
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be set by a page on another
 * origin, so this is a genuine same-origin check rather than a header a
 * cross-site attacker can spoof. The Origin comparison is a fallback for
 * browsers that omit Sec-Fetch-Site. A request carrying neither header — curl,
 * a script, a test — is never treated as same-origin.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'same-origin') return true;
  if (site !== null) return false;

  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
