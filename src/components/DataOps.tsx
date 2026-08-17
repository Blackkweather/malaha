'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CategoryOption {
  key: string;
  label: string;
  commercialValue: number;
}

interface JobsResponse {
  queue: {
    queued: number;
    running: number;
    done: number;
    failed: number;
    recentFailures: { jobType: string; error: string; finishedAt: string | null }[];
  };
  dataset: { businesses: number; inScope: number; audited: number; indexed: number };
  events: { eventType: string; level: string; message: string; createdAt: string }[];
}

interface RunResponse {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  budgetExhausted: boolean;
}

const STAT_LABELS: [keyof JobsResponse['dataset'], string, string][] = [
  ['businesses', 'Businesses stored', 'every record ingested'],
  ['inScope', 'Verified in Málaga', 'passed geographic verification'],
  ['audited', 'Websites audited', 'crawled and scored'],
  ['indexed', 'Qualified prospects', 'passed the quality gate'],
];

/**
 * The operations console.
 *
 * A deployed instance starts empty, and the only honest way to fill it is to
 * fetch real businesses from a public source. This is where that happens: pick
 * the sectors worth selling to, queue the work, and watch it run.
 *
 * The run loop is driven from the browser on purpose. Serverless functions
 * cannot hold a worker process open, so the page keeps calling the runner while
 * work remains — and because progress is stored in Postgres, closing the tab
 * pauses the batch rather than losing it. The scheduled cron picks up whatever
 * is left.
 */
export function DataOps({ categories }: { categories: CategoryOption[] }) {
  const [selected, setSelected] = useState<string[]>(['dental_clinic', 'law_firm', 'private_clinic']);
  const [status, setStatus] = useState<JobsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResponse | null>(null);
  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/jobs', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Status endpoint returned ${response.status}`);
      setStatus((await response.json()) as JobsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the queue');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Calls the runner repeatedly until the queue is empty or the user stops it. */
  const drain = useCallback(async () => {
    setRunning(true);
    cancelled.current = false;
    setError(null);

    try {
      for (;;) {
        if (cancelled.current) break;

        const response = await fetch('/api/admin/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budgetMs: 45_000, maxJobs: 40 }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? 'The runner failed');

        const report = body as RunResponse;
        setLastRun(report);
        await refresh();

        if (report.remaining === 0) break;
        // Nothing processed and nothing runnable means everything left is
        // backing off after a failure; stop rather than spin.
        if (report.processed === 0) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The runner failed');
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  const queueIngest = useCallback(async () => {
    if (selected.length === 0) {
      setError('Choose at least one sector to fetch.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'openstreetmap', categories: selected, enrich: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not queue the ingest');
      await refresh();
      void drain();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue the ingest');
    } finally {
      setBusy(false);
    }
  }, [selected, refresh, drain]);

  /**
   * Enrichment without ingestion.
   *
   * Ingesting stores businesses and scores what is known about them, but a
   * prospect whose website has never been crawled is scored as if it had no
   * web presence at all. This fixes that for data already in the database,
   * without re-fetching it from the source.
   */
  const runPipeline = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not queue the pipeline');
      await refresh();
      void drain();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue the pipeline');
    } finally {
      setBusy(false);
    }
  }, [refresh, drain]);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const queue = status?.queue;
  const pending = (queue?.queued ?? 0) + (queue?.running ?? 0);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_LABELS.map(([key, label, hint]) => (
          <div key={key} className="rounded-xl border border-line bg-surface p-5">
            <div className="font-mono text-[28px] leading-none tracking-tight">
              {status ? status.dataset[key].toLocaleString('en-GB') : '—'}
            </div>
            <div className="mt-2 text-[13px] font-medium">{label}</div>
            <div className="mt-0.5 text-[11px] text-ink-dim">{hint}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-[15px] font-semibold tracking-tight">Fetch real businesses</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Data comes from the OpenStreetMap Overpass API — public, no key, one bounded query per
          sector inside the Málaga city box. Nothing is invented and nothing is sampled; a business
          appears here only if it exists in the source.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = selected.includes(category.key);
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => toggle(category.key)}
                aria-pressed={active}
                className={[
                  'rounded-md border px-3 py-1.5 text-[12px] transition-colors',
                  active
                    ? 'border-accent bg-accent-dim text-ink'
                    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                ].join(' ')}
              >
                {category.label}
                <span className="ml-2 font-mono text-[10px] text-ink-dim">
                  {category.commercialValue}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void queueIngest()}
            disabled={busy || running}
            className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold text-[#05202e] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Queueing…' : `Fetch ${selected.length} sector${selected.length === 1 ? '' : 's'}`}
          </button>

          <button
            type="button"
            onClick={() => void runPipeline()}
            disabled={busy || running}
            className="rounded-lg border border-line-strong px-5 py-2.5 text-[13px] font-medium transition-colors hover:border-accent disabled:opacity-50"
          >
            Audit websites &amp; rescore
          </button>

          {pending > 0 && !running ? (
            <button
              type="button"
              onClick={() => void drain()}
              className="rounded-lg border border-line-strong px-5 py-2.5 text-[13px] font-medium transition-colors hover:border-accent"
            >
              Resume {pending} queued job{pending === 1 ? '' : 's'}
            </button>
          ) : null}

          {running ? (
            <button
              type="button"
              onClick={() => {
                cancelled.current = true;
              }}
              className="rounded-lg border border-line-strong px-5 py-2.5 text-[13px] font-medium transition-colors hover:border-danger"
            >
              Stop after this batch
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void refresh()}
            className="text-[12px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Refresh status
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">
          Fetching takes a few minutes: each sector is one Overpass query, then every discovered
          website is crawled and audited. You can close this page — progress is stored in the
          database and the scheduled job finishes whatever is left.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="text-[13px] font-semibold tracking-tight">Queue</h3>
          <dl className="mt-4 space-y-2.5 text-[13px]">
            {[
              ['Queued', queue?.queued ?? 0, 'text-ink'],
              ['Running', queue?.running ?? 0, running ? 'text-accent pulse-soft' : 'text-ink'],
              ['Done', queue?.done ?? 0, 'text-positive'],
              ['Failed', queue?.failed ?? 0, (queue?.failed ?? 0) > 0 ? 'text-danger' : 'text-ink-dim'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">{label}</dt>
                <dd className={`font-mono ${tone as string}`}>{value as number}</dd>
              </div>
            ))}
          </dl>

          {lastRun ? (
            <p className="mt-4 border-t border-line pt-4 font-mono text-[11px] text-ink-dim">
              last batch: {lastRun.processed} processed, {lastRun.failed} failed, {lastRun.remaining}{' '}
              remaining
            </p>
          ) : null}

          {queue && queue.recentFailures.length > 0 ? (
            <div className="mt-4 border-t border-line pt-4">
              <h4 className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">Recent failures</h4>
              <ul className="mt-2 space-y-2">
                {queue.recentFailures.slice(0, 5).map((failure, index) => (
                  <li key={index} className="text-[11px] leading-relaxed text-danger">
                    <span className="font-mono">{failure.jobType}</span> — {failure.error.slice(0, 120)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="text-[13px] font-semibold tracking-tight">Activity</h3>
          {status && status.events.length > 0 ? (
            <ul className="mt-4 max-h-[420px] space-y-1.5 overflow-y-auto pr-2">
              {status.events.map((event, index) => (
                <li key={index} className="flex gap-3 font-mono text-[11px] leading-relaxed">
                  <span className="shrink-0 text-ink-dim">
                    {new Date(event.createdAt).toLocaleTimeString('en-GB')}
                  </span>
                  <span
                    className={
                      event.level === 'error'
                        ? 'text-danger'
                        : event.level === 'warn'
                          ? 'text-warn'
                          : 'text-ink-muted'
                    }
                  >
                    {event.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-ink-muted">
              No activity yet. Choose sectors above and fetch.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
