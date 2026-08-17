import { NextResponse } from 'next/server';

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  const body: ApiError = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const badRequest = (message: string, details?: unknown) =>
  fail(400, 'bad_request', message, details);
export const unauthorized = (message = 'A valid API token is required') =>
  fail(401, 'unauthorized', message);
export const forbidden = (message = 'Not permitted') => fail(403, 'forbidden', message);
export const notFound = (message = 'Not found') => fail(404, 'not_found', message);
export const tooManyRequests = (retryAfterSeconds: number) =>
  NextResponse.json(
    { error: { code: 'rate_limited', message: 'Too many requests' } },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' } },
  );

/** Converts an unexpected error into a safe response without leaking internals. */
export function serverError(err: unknown, requestId: string): NextResponse {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return fail(500, 'internal_error', 'The request could not be completed', {
    requestId,
    reason: message.slice(0, 200),
  });
}
