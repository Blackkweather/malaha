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

export interface CategoryChoice {
  key: string;
  label: string;
}

/**
 * Sort orders.
 *
 * "Opportunity" is the default because it answers the actual question — who is
 * worth approaching. The component sorts are offered because they answer
 * different ones: who is the strongest business, and whose website is in the
 * worst state.
 */
const SORTS = [
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'digitalOpportunity', label: 'Website upside' },
  { value: 'businessQuality', label: 'Business strength' },
  { value: 'commercialValue', label: 'Category value' },
] as const;

type SortKey = (typeof SORTS)[number]['value'];

export function SearchPanel({
  initialQuery = '',
  categories = [],
}: {
  initialQuery?: string;
  categories?: CategoryChoice[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(10);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('opportunity');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (term: string, resultLimit: number, categoryKey: string) => {
      setLoading(true);
      setError(null);
      const started = performance.now();

      try {
        const params = new URLSearchParams({ q: term, limit: String(resultLimit) });
        if (categoryKey !== '') params.set('category', categoryKey);
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
    void runSearch(initialQuery, 10, '');
  }, [initialQuery, runSearch]);

  /*
   * Sorting reorders the returned shortlist rather than changing the query.
   * The server decides *which* prospects qualify, so reordering here can never
   * smuggle a business past the quality gate — it only changes the order of
   * the ones that already earned their place.
   */
  const sorted = data ? [...data.results].sort((a, b) => b[sort] - a[sort]) : [];

  const exportParams = new URLSearchParams();
  if (data?.query) exportParams.set('q', data.query);
  if (category !== '') exportParams.set('category', category);

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query.trim(), limit, category);
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

        {categories.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
                Sector
              </span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  void runSearch(query.trim(), limit, event.target.value);
                }}
                className="w-full rounded-lg border border-line bg-ground px-4 py-2.5 text-[14px] outline-none focus:border-accent"
              >
                <option value="">Every sector</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-ink-dim">
                Rank by
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="w-full rounded-lg border border-line bg-ground px-4 py-2.5 text-[14px] outline-none focus:border-accent"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

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
                void runSearch(suggestion, limit, category);
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
            <span className="flex items-center gap-3 font-mono text-[11px] text-ink-dim">
              <span>
                {data.count} result{data.count === 1 ? '' : 's'}
                {elapsed !== null ? ` · ${elapsed} ms round trip · ${data.tookMs} ms query` : ''}
              </span>
              {data.results.length > 0 ? (
                <a
                  href={`/api/export/prospects?${exportParams.toString()}`}
                  className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  export CSV
                </a>
              ) : null}
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
              {sorted.map((result, index) => (
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
