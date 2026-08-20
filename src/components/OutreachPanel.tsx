'use client';

import { useCallback, useEffect, useState } from 'react';

interface OutreachMessage {
  id: string;
  channel: string;
  language: string;
  subject: string;
  body: string;
  angle: string;
  evidence: string[];
  generator: string;
  model: string | null;
  createdAt: string;
}

const CHANNELS: { value: string; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call_script', label: 'Call script' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const ANGLE_LABELS: Record<string, string> = {
  no_website: 'No website',
  unreachable: 'Site is down',
  mobile: 'Mobile experience',
  conversion: 'Contact path',
  trust: 'Trust and security',
  performance: 'Speed',
  modernity: 'Dated site',
  seo: 'Search visibility',
  polish: 'Conversion polish',
  unaudited: 'Not audited yet',
};

/**
 * Drafting outreach for one prospect.
 *
 * The panel shows which audit findings the message is allowed to cite, because
 * the value of this feature is that the message is *true*. A pitch that invents
 * a problem is worse than no pitch — it gets you dismissed by the one business
 * that actually checked.
 */
export function OutreachPanel({ businessId }: { businessId: string }) {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [channel, setChannel] = useState('email');
  const [language, setLanguage] = useState('es');
  const [senderName, setSenderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/prospects/${businessId}/outreach`, { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as { messages: OutreachMessage[] };
      setMessages(body.messages);
    } catch {
      /* the panel is additive; a failed history load must not break the page */
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${businessId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          language,
          ...(senderName.trim() === '' ? {} : { senderName: senderName.trim() }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not draft the message');
      setMessages((current) => [body as OutreachMessage, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draft the message');
    } finally {
      setBusy(false);
    }
  }, [businessId, channel, language, senderName]);

  const copy = useCallback(async (message: OutreachMessage) => {
    const text = message.channel === 'email' ? `${message.subject}\n\n${message.body}` : message.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(message.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('The browser blocked clipboard access — select the text and copy manually.');
    }
  }, []);

  const latest = messages[0] ?? null;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Outreach</h2>
        <span className="text-[11px] text-ink-dim">drafted from the audit, never sent from here</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            Channel
          </span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-[13px] outline-none focus:border-accent"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            Language
          </span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-[13px] outline-none focus:border-accent"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            Your name
          </span>
          <input
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            placeholder="optional"
            className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-[13px] outline-none placeholder:text-ink-dim focus:border-accent"
          />
        </label>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-[#05202e] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Drafting…' : 'Draft'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      {latest ? (
        <article className="mt-5 rounded-lg border border-line bg-ground p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded border border-line-strong px-2 py-0.5 text-ink-muted">
              {ANGLE_LABELS[latest.angle] ?? latest.angle}
            </span>
            <span className="rounded border border-line px-2 py-0.5 text-ink-dim">
              {latest.channel} · {latest.language}
            </span>
            <span className="rounded border border-line px-2 py-0.5 text-ink-dim">
              {latest.generator === 'deterministic'
                ? 'template'
                : `written by ${latest.model ?? latest.generator}`}
            </span>
            <button
              type="button"
              onClick={() => void copy(latest)}
              className="ml-auto text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {copied === latest.id ? 'Copied' : 'Copy'}
            </button>
          </div>

          {latest.channel === 'email' ? (
            <p className="mt-3 text-[13px] font-medium">{latest.subject}</p>
          ) : null}

          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-muted">
            {latest.body}
          </pre>

          {latest.evidence.length > 0 ? (
            <p className="mt-3 border-t border-line pt-3 font-mono text-[10px] text-ink-dim">
              grounded in: {latest.evidence.join(', ')}
            </p>
          ) : (
            <p className="mt-3 border-t border-line pt-3 font-mono text-[10px] text-ink-dim">
              {latest.angle === 'unaudited'
                ? 'this site has not been audited yet, so the message claims nothing about it — run the audit for a sharper pitch'
                : 'no website failings found — this is a conversion pitch, not a rescue pitch'}
            </p>
          )}
        </article>
      ) : (
        <p className="mt-4 text-[13px] text-ink-muted">
          No message drafted yet. Every draft is built only from findings in this prospect&apos;s
          audit.
        </p>
      )}

      {messages.length > 1 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] text-ink-muted hover:text-ink">
            {messages.length - 1} earlier draft{messages.length - 1 === 1 ? '' : 's'}
          </summary>
          <ul className="mt-3 space-y-3">
            {messages.slice(1).map((message) => (
              <li key={message.id} className="rounded-lg border border-line bg-ground p-3">
                <div className="flex items-center gap-2 text-[10px] text-ink-dim">
                  <span className="font-mono">
                    {new Date(message.createdAt).toLocaleString('en-GB')}
                  </span>
                  <span>
                    {message.channel} · {message.language}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copy(message)}
                    className="ml-auto underline-offset-4 hover:text-ink hover:underline"
                  >
                    {copied === message.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-muted">
                  {message.body}
                </pre>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
