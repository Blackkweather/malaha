import { SearchPanel } from '@/components/SearchPanel';

export const dynamic = 'force-dynamic';

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
      <SearchPanel />
    </div>
  );
}
