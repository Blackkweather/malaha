import { config } from '../config';

/**
 * In-process sliding-window rate limiter.
 *
 * Sufficient for a single-node deployment, which is what this tool is built
 * for. The state is kept on globalThis so Next.js hot reloads do not reset it.
 */
interface Bucket {
  hits: number[];
}

const globalForLimiter = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  if (!globalForLimiter.__rateLimitBuckets) globalForLimiter.__rateLimitBuckets = new Map();
  return globalForLimiter.__rateLimitBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Best-effort client identity: the proxy-forwarded IP, else the token, else a shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const auth = request.headers.get('authorization');
  if (auth) return `token:${auth.slice(-12)}`;
  return 'anonymous';
}

export function rateLimit(key: string, scope: 'read' | 'write'): RateLimitResult {
  const limit = scope === 'write' ? config.rateLimit.maxWrites : config.rateLimit.maxReads;
  const windowMs = config.rateLimit.windowMs;
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;

  const store = buckets();
  const bucket = store.get(bucketKey) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((ts) => now - ts < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    store.set(bucketKey, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  store.set(bucketKey, bucket);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.hits.every((ts) => now - ts >= windowMs)) store.delete(k);
    }
  }

  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Test helper: clears all limiter state. */
export function resetRateLimits(): void {
  buckets().clear();
}
