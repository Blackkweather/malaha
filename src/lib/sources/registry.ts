import { CsvSourceAdapter } from './csv';
import { GooglePlacesSourceAdapter } from './googlePlaces';
import { JsonSourceAdapter, ManualSourceAdapter } from './json';
import { OverpassSourceAdapter } from './overpass';
import type { DiscoverOptions, PersistResult, SourceAdapter } from './types';
import { logger } from '../logger';

/**
 * The source registry. Adding a public data source means adding one adapter
 * here; nothing else in the application is aware of individual sources.
 */
const ADAPTERS: SourceAdapter[] = [
  new OverpassSourceAdapter(),
  new GooglePlacesSourceAdapter(),
  new CsvSourceAdapter(),
  new JsonSourceAdapter(),
  new ManualSourceAdapter(),
];

export function listAdapters(): SourceAdapter[] {
  return ADAPTERS;
}

export function getAdapter(key: string): SourceAdapter | null {
  return ADAPTERS.find((a) => a.key === key) ?? null;
}

/** Adapters that can run unattended (i.e. not file-import adapters). */
export function listAutomaticAdapters(): SourceAdapter[] {
  return ADAPTERS.filter(
    (a) => ['openstreetmap', 'google_places'].includes(a.key) && a.isConfigured(),
  );
}

export interface IngestReport {
  source: string;
  discovered: number;
  parsed: number;
  result: PersistResult;
  skipped?: string;
}

/** Runs one adapter end to end: discover -> parse -> normalize/validate/persist. */
export async function runAdapter(
  adapter: SourceAdapter,
  options: DiscoverOptions,
): Promise<IngestReport> {
  const empty: PersistResult = {
    inserted: 0,
    updated: 0,
    merged: 0,
    rejected: 0,
    rejections: [],
    businessIds: [],
  };

  if (!adapter.isConfigured()) {
    return { source: adapter.key, discovered: 0, parsed: 0, result: empty, skipped: 'not configured' };
  }

  const raw = await adapter.discover(options);
  const parsed = raw
    .map((record) => adapter.parse(record))
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const result = await adapter.persist(parsed);

  logger.info('adapter run complete', {
    source: adapter.key,
    discovered: raw.length,
    parsed: parsed.length,
    inserted: result.inserted,
    merged: result.merged,
    rejected: result.rejected,
  });

  return { source: adapter.key, discovered: raw.length, parsed: parsed.length, result };
}
