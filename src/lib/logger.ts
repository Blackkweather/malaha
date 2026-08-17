/**
 * Structured JSON logger with secret redaction.
 *
 * Anything that looks like a credential is replaced before it can reach a log
 * sink. Redaction is applied both to keys (by name) and to values (by shape),
 * so a key leaking through an unexpected field is still caught.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEY_PATTERN =
  /(api[-_]?key|apikey|authorization|auth|token|secret|password|passwd|pwd|credential|cookie|session|bearer|dsn|connection[-_]?string|database[-_]?url)/i;

/** Shapes of well-known provider credentials. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bgsk_[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi,
  /\bpostgres(?:ql)?:\/\/\S+/gi,
];

export const REDACTED = '[REDACTED]';

function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return '[UNSERIALISABLE]';
}

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    message: redactString(message),
  };
  if (meta) payload.meta = redact(meta);
  const line = JSON.stringify(payload);
  if (level === 'error') process.stderr.write(line + String.fromCharCode(10));
  else process.stdout.write(line + String.fromCharCode(10));
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'debug') emit('debug', m, meta);
  },
  info: (m: string, meta?: Record<string, unknown>) => emit('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit('error', m, meta),
};
