import { describe, expect, it, beforeEach, vi } from 'vitest';
import { authorize } from '../src/lib/http/auth';
import { clientKey, rateLimit, resetRateLimits } from '../src/lib/http/ratelimit';
import { redact, REDACTED } from '../src/lib/logger';
import { searchQuerySchema, importBodySchema, parseQuery, parseBody } from '../src/lib/http/validate';

const TOKEN = 'test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function withAuth(header?: string): Request {
  return new Request('http://localhost/api/x', {
    headers: header ? { Authorization: header } : {},
  });
}

describe('authorisation', () => {
  it('accepts a valid bearer token for writes', () => {
    expect(authorize(withAuth(`Bearer ${TOKEN}`), 'write').authorized).toBe(true);
  });

  it('refuses a missing or wrong token for writes', () => {
    expect(authorize(withAuth(), 'write').authorized).toBe(false);
    expect(authorize(withAuth('Bearer wrong'), 'write').authorized).toBe(false);
  });

  it('refuses a token that is a prefix of the real one', () => {
    expect(authorize(withAuth(`Bearer ${TOKEN.slice(0, 10)}`), 'write').authorized).toBe(false);
  });

  it('leaves reads open when configured that way', () => {
    expect(authorize(withAuth(), 'read').authorized).toBe(true);
  });

  it('accepts the x-api-key header too', () => {
    const request = new Request('http://localhost/api/x', { headers: { 'x-api-key': TOKEN } });
    expect(authorize(request, 'write').authorized).toBe(true);
  });
});

describe('rate limiting', () => {
  beforeEach(() => resetRateLimits());

  it('allows traffic up to the budget and refuses beyond it', async () => {
    // Re-import the limiter with a tiny budget so the boundary is exact.
    vi.stubEnv('RATE_LIMIT_MAX_READS', '3');
    vi.resetModules();
    const limiter = await import('../src/lib/http/ratelimit');
    limiter.resetRateLimits();

    expect(limiter.rateLimit('1.2.3.4', 'read').allowed).toBe(true);
    expect(limiter.rateLimit('1.2.3.4', 'read').allowed).toBe(true);
    const last = limiter.rateLimit('1.2.3.4', 'read');
    expect(last.allowed).toBe(true);
    expect(last.remaining).toBe(0);

    const blocked = limiter.rateLimit('1.2.3.4', 'read');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // A different client is unaffected.
    expect(limiter.rateLimit('5.6.7.8', 'read').allowed).toBe(true);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps separate budgets per client and per scope', () => {
    expect(rateLimit('a', 'read').allowed).toBe(true);
    expect(rateLimit('b', 'read').allowed).toBe(true);
    expect(rateLimit('a', 'write').allowed).toBe(true);
  });

  it('identifies the client from proxy headers', () => {
    const request = new Request('http://localhost/x', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });
    expect(clientKey(request)).toBe('203.0.113.9');
  });
});

describe('secret redaction in logs', () => {
  it('redacts by key name', () => {
    const output = redact({ apiKey: 'gsk_secret', Authorization: 'Bearer abc', safe: 'value' }) as Record<
      string,
      unknown
    >;
    expect(output.apiKey).toBe(REDACTED);
    expect(output.Authorization).toBe(REDACTED);
    expect(output.safe).toBe('value');
  });

  it('redacts by value shape even in an unexpected field', () => {
    const output = redact({
      note: 'the key is sk-abcdefghijklmnopqrstuvwxyz012345 do not share',
    }) as Record<string, unknown>;
    expect(String(output.note)).toContain(REDACTED);
    expect(String(output.note)).not.toContain('sk-abcdefghijklmnop');
  });

  it('redacts database connection strings', () => {
    const output = redact({ msg: 'connect postgres://user:pw@host:5432/db failed' }) as Record<
      string,
      unknown
    >;
    expect(String(output.msg)).toContain(REDACTED);
    expect(String(output.msg)).not.toContain('user:pw');
  });

  it('handles nested structures and errors without throwing', () => {
    const output = redact({ a: { b: [{ token: 'x' }] }, err: new Error('boom') }) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(output)).toContain(REDACTED);
    expect(JSON.stringify(output)).toContain('boom');
  });
});

describe('input validation', () => {
  it('rejects an oversized limit', () => {
    const result = parseQuery(searchQuerySchema, new URLSearchParams({ q: 'x', limit: '999' }));
    expect(result.success).toBe(false);
  });

  it('rejects a category that is not a taxonomy key', () => {
    const result = parseQuery(searchQuerySchema, new URLSearchParams({ category: "'; DROP TABLE" }));
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed query', () => {
    const result = parseQuery(searchQuerySchema, new URLSearchParams({ q: 'dentist', limit: '10' }));
    expect(result.success).toBe(true);
  });

  it('requires content or records on import', () => {
    expect(parseBody(importBodySchema, { format: 'csv' }).success).toBe(false);
    expect(parseBody(importBodySchema, { format: 'json', records: [] }).success).toBe(false);
    expect(parseBody(importBodySchema, { format: 'csv', content: 'name\nX' }).success).toBe(true);
  });
});

describe('same-origin writes from the application UI', () => {
  function uiWrite(headers: Record<string, string>): Request {
    return new Request('http://localhost:3000/api/import', { method: 'POST', headers });
  }

  it('accepts a browser write from our own origin', () => {
    const result = authorize(uiWrite({ 'sec-fetch-site': 'same-origin' }), 'write');
    expect(result.authorized).toBe(true);
    expect(result.reason).toContain('Same-origin');
  });

  it('accepts an Origin header matching the request host', () => {
    expect(authorize(uiWrite({ origin: 'http://localhost:3000' }), 'write').authorized).toBe(true);
  });

  it('refuses a cross-site browser write', () => {
    expect(authorize(uiWrite({ 'sec-fetch-site': 'cross-site' }), 'write').authorized).toBe(false);
    expect(authorize(uiWrite({ origin: 'https://evil.example' }), 'write').authorized).toBe(false);
  });

  it('refuses a scripted write that carries neither header', () => {
    expect(authorize(uiWrite({}), 'write').authorized).toBe(false);
  });

  it('still accepts a valid bearer token from any caller', () => {
    expect(authorize(uiWrite({ authorization: `Bearer ${TOKEN}` }), 'write').authorized).toBe(true);
  });

  it('can be locked down so even the UI needs a token', async () => {
    vi.stubEnv('REQUIRE_TOKEN_FOR_UI_WRITES', 'true');
    vi.resetModules();
    const locked = await import('../src/lib/http/auth');

    expect(locked.authorize(uiWrite({ 'sec-fetch-site': 'same-origin' }), 'write').authorized).toBe(
      false,
    );
    expect(locked.authorize(uiWrite({ authorization: `Bearer ${TOKEN}` }), 'write').authorized).toBe(
      true,
    );

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
