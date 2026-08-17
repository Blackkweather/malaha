import { SearchPanel } from '@/components/SearchPanel';
import { CATEGORIES } from '@/lib/normalize/category';

export const dynamic = 'force-dynamic';

/**
 * Built on the server so the whole taxonomy never reaches the browser bundle.
 * Excluded categories are omitted because the quality filter drops them before
 * ranking — offering a filter that can only ever return nothing is a lie.
 */
const SECTORS = CATEGORIES.filter((c) => !c.excluded)
  .map((c) => ({ key: c.key, label: c.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Find the strongest prospects</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          A short, ranked shortlist of Malaga businesses worth approaching — established, well
          reviewed, commercially valuable, and with visible website upside.
        </p>
      </div>
      <SearchPanel categories={SECTORS} />
    </div>
  );
}
