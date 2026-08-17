'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ResultCard, type ResultCardData } from './ResultCard';

interface SearchResponse {
  query: string;
  city: string;
  limit: number;
  count: number;
  results: ResultCardData[];
  note: string | null;
  tookMs: number;
}

const SUGGESTIONS = ['dentist', 'abogado', 'inmobiliaria', 'hotel', 'clinica', 'reformas'];

export function SearchPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (term: string, resultLimit: number) => {
      setLoading(true);
      setError(null);
      const started = performance.now();

      try {
        const params = new URLSearchParams({ q: term, limit: String(resultLimit) });
        const response = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Search failed');
        }
        setData(body as SearchResponse);
        setElapsed(Math.round(performance.now() - started));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load the strongest prospects immediately so the page is never empty.
  useEffect(() => {
    void runSearch(initialQuery, 10);
  }, [initialQuery, runSearch]);

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query.trim(), limit);
        }}
        className="rounded-2xl border border-line bg-surface p-6"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
              Search businesses
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="dentist"
              className="w-full rounded-lg border border-line bg-ground px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-ink-dim focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
              Results
            </span>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="w-full rounded-lg border border-line bg-ground px-4 py-3 text-[15px] outline-none focus:border-accent sm:w-24"
            >
              {[5, 10, 15, 20, 25].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-7 py-3 text-[14px] font-semibold text-[#05202e] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Searching' : 'Search'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">Location</span>
          <span className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium">
            Malaga
          </span>
          <span className="text-[11px] text-ink-dim">
            locked by configuration
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                void runSearch(suggestion, limit);
              }}
              className="rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pulse-soft h-24 rounded-xl border border-line bg-surface" />
          ))}
        </div>
      ) : null}

      {data ? (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {data.city} — best prospects
              {data.query ? (
                <span className="ml-2 font-normal text-ink-muted">for “{data.query}”</span>
              ) : null}
            </h2>
            <span className="font-mono text-[11px] text-ink-dim">
              {data.count} result{data.count === 1 ? '' : 's'}
              {elapsed !== null ? ` · ${elapsed} ms round trip · ${data.tookMs} ms query` : ''}
            </span>
          </div>

          {data.results.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-8 text-center">
              <p className="text-[14px] text-ink-muted">
                {data.note ?? 'No prospects met the quality threshold.'}
              </p>
              <p className="mt-2 text-[12px] text-ink-dim">
                The shortlist is never padded with weak businesses.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.results.map((result, index) => (
                <ResultCard key={result.businessId} rank={index + 1} data={result} />
              ))}
            </div>
          )}

          {data.note && data.results.length > 0 ? (
            <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-[12px] text-ink-muted">
              {data.note}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
