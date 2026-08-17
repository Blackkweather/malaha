import { DataOps, type CategoryOption } from '@/components/DataOps';
import { CATEGORY_BY_KEY } from '@/lib/normalize/category';
import { OSM_SELECTORS } from '@/lib/sources/overpassTags';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Data — Málaga Prospect Finder',
  description: 'Fetch real Málaga businesses from public sources and run the enrichment pipeline.',
};

/**
 * Only sectors that have an OpenStreetMap selector are offered, because a
 * category with no selector would produce an ingest that fetches nothing.
 * They are ordered by commercial value so the most sellable sectors come first.
 */
function selectableCategories(): CategoryOption[] {
  return Object.keys(OSM_SELECTORS)
    .map((key) => {
      const definition = CATEGORY_BY_KEY.get(key);
      return definition
        ? { key, label: definition.label, commercialValue: definition.commercialValue }
        : null;
    })
    .filter((c): c is CategoryOption => c !== null)
    .sort((a, b) => b.commercialValue - a.commercialValue);
}

export default function DataPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Data</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Load real Málaga businesses and run the pipeline that turns them into ranked prospects.
          Everything here is public information, fetched from documented APIs.
        </p>
      </div>
      <DataOps categories={selectableCategories()} />
    </div>
  );
}
