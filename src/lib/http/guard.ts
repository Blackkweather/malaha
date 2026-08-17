import crypto from 'node:crypto';
import { logger } from '../logger';
import { authorize, type AuthScope } from './auth';
import { clientKey, rateLimit } from './ratelimit';
import { serverError, tooManyRequests, unauthorized } from './respond';

export interface RequestContext {
  requestId: string;
  startedAt: number;
}

/**
 * Wraps a route handler with authorisation, rate limiting, audit logging and
 * uniform error handling, so no individual route can forget one of them.
 */
export function withGuard<TArgs extends unknown[]>(
  scope: AuthScope,
  handler: (request: Request, context: RequestContext, ...args: TArgs) => Promise<Response>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request: Request, ...args: TArgs): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const key = clientKey(request);
    const url = new URL(request.url);

    const limit = rateLimit(key, scope);
    if (!limit.allowed) {
      logger.warn('rate limit exceeded', { path: url.pathname, scope, requestId });
      return tooManyRequests(limit.retryAfterSeconds);
    }

    const auth = authorize(request, scope);
    if (!auth.authorized) {
      logger.warn('unauthorized request', {
        path: url.pathname,
        scope,
        reason: auth.reason,
        requestId,
      });
      return unauthorized(auth.reason);
    }

    try {
      const response = await handler(request, { requestId, startedAt }, ...args);
      logger.info('request completed', {
        path: url.pathname,
        method: request.method,
        status: response.status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
      return response;
    } catch (err) {
      logger.error('request failed', {
        path: url.pathname,
        method: request.method,
        durationMs: Date.now() - startedAt,
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      return serverError(err, requestId);
    }
  };
}
