'use client';

import { useCallback, useState } from 'react';

interface Step {
  step: string;
  status: 'ok' | 'skipped' | 'failed';
  detail: string;
  durationMs: number;
}

interface PitchResult {
  steps: Step[];
  opportunity: number | null;
  demo: { slug: string; url: string; title: string } | null;
  outreach: { subject: string; body: string; angle: string; generator: string } | null;
  completed: boolean;
}

/** Readable names for the step keys the API returns. */
const STEP_LABELS: Record<string, string> = {
  website_refresh: 'Finding the website',
  website_audit: 'Auditing the site',
  rescore: 'Rescoring',
  build_evidence: 'Packaging evidence',
  groq_analysis: 'Fast analysis',
  claude_analysis: 'Deep analysis',
  reindex: 'Reindexing',
  generate_demo: 'Building the concept',
  draft_outreach: 'Drafting the message',
};

const TONE: Record<Step['status'], string> = {
  ok: 'text-positive',
  skipped: 'text-ink-dim',
  failed: 'text-danger',
};

const MARK: Record<Step['status'], string> = { ok: '✓', skipped: '–', failed: '✕' };

/**
 * The whole approach, in one action.
 *
 * Each step is still shown as it completes, because the point is not to hide
 * the work: a skipped AI step, or a site that would not respond, changes how
 * much the output is worth, and the person about to send the message needs to
 * know which happened.
 */
export function PreparePitch({ businessId }: { businessId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/prospects/${businessId}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          language: 'es',
          ...(senderName.trim() === '' ? {} : { senderName: senderName.trim() }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not prepare the pitch');
      setResult(body as PitchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the pitch');
    } finally {
      setBusy(false);
    }
  }, [businessId, senderName]);

  const copyEmail = useCallback(async () => {
    if (!result?.outreach) return;
    try {
      await navigator.clipboard.writeText(`${result.outreach.subject}\n\n${result.outreach.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('The browser blocked clipboard access — select the text and copy manually.');
    }
  }, [result]);

  return (
    <section className="rounded-xl border border-accent/40 bg-accent-dim/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-tight">Prepare the pitch</h2>
        <span className="text-[11px] text-ink-dim">
          audit, analyse, concept and message in one run
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            Your name (for the message)
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
          onClick={() => void run()}
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold text-[#05202e] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Preparing…' : 'Prepare everything'}
        </button>
      </div>

      {busy ? (
        <p className="pulse-soft mt-4 text-[12px] text-ink-muted">
          Crawling the site and auditing it. This is the slow part — up to a minute.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <ol className="space-y-1.5">
            {result.steps.map((step, index) => (
              <li key={index} className="flex items-baseline gap-3 text-[12px]">
                <span className={`w-4 shrink-0 font-mono ${TONE[step.status]}`}>
                  {MARK[step.status]}
                </span>
                <span className="w-40 shrink-0 text-ink">{STEP_LABELS[step.step] ?? step.step}</span>
                <span className="flex-1 text-ink-muted">{step.detail}</span>
                <span className="shrink-0 font-mono text-[10px] text-ink-dim">
                  {step.durationMs} ms
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {result.opportunity !== null ? (
              <span className="font-mono text-[12px] text-ink-muted">
                opportunity {Math.round(result.opportunity)}
              </span>
            ) : null}

            {result.demo ? (
              <a
                href={result.demo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-[#05202e] transition-opacity hover:opacity-90"
              >
                Open the concept
              </a>
            ) : null}

            {result.outreach ? (
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="rounded-lg border border-line-strong px-4 py-2 text-[12px] font-medium transition-colors hover:border-accent"
              >
                {copied ? 'Copied' : 'Copy the email'}
              </button>
            ) : null}
          </div>

          {result.outreach ? (
            <article className="rounded-lg border border-line bg-ground p-4">
              <p className="text-[13px] font-medium">{result.outreach.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-muted">
                {result.outreach.body}
              </pre>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
