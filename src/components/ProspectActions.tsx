'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Step {
  step: string;
  status: 'ok' | 'skipped' | 'failed';
  detail: string;
  durationMs: number;
}

const STEP_LABELS: Record<string, string> = {
  website_audit: 'Refreshing website & running technical audit',
  rescore: 'Recomputing deterministic scores',
  build_evidence: 'Preparing evidence package',
  groq_analysis: 'Groq fast analysis',
  claude_analysis: 'Claude deep analysis',
  reindex: 'Refreshing search index',
};

const STEP_ORDER = Object.keys(STEP_LABELS);

function statusMark(status: Step['status']): string {
  if (status === 'ok') return '✓';
  if (status === 'skipped') return '–';
  return '✕';
}

function statusTone(status: Step['status']): string {
  if (status === 'ok') return 'text-positive';
  if (status === 'skipped') return 'text-ink-dim';
  return 'text-danger';
}

/** Runs DEEP ANALYZE and shows per-step progress while it works. */
export function DeepAnalyzeButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setSteps([]);

    try {
      const response = await fetch(`/api/prospects/${businessId}/deep-analyze`, {
        method: 'POST',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Deep analysis failed');
      setSteps(body.steps ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deep analysis failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void run()}
        disabled={running}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-[#05202e] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? 'Analysing…' : 'Deep analyze'}
      </button>

      {running ? (
        <ol className="mt-3 space-y-1.5">
          {STEP_ORDER.map((key) => (
            <li key={key} className="pulse-soft flex gap-2 text-[12px] text-ink-muted">
              <span className="text-ink-dim">•</span>
              {STEP_LABELS[key]}
            </li>
          ))}
        </ol>
      ) : null}

      {!running && steps.length > 0 ? (
        <ol className="mt-3 space-y-1.5">
          {steps.map((step) => (
            <li key={step.step} className="flex gap-2 text-[12px]">
              <span className={statusTone(step.status)}>{statusMark(step.status)}</span>
              <span className="flex-1 text-ink-muted">
                <span className="text-ink">{STEP_LABELS[step.step] ?? step.step}</span>
                <span className="block text-ink-dim">{step.detail}</span>
              </span>
              <span className="font-mono text-[10px] text-ink-dim">{step.durationMs}ms</span>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? <p className="mt-3 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

/** Generates an original demo concept and links to it. */
export function GenerateDemoButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${businessId}/generate-demo`, {
        method: 'POST',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Demo generation failed');
      setDemoUrl(body.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo generation failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void run()}
        disabled={running}
        className="w-full rounded-lg border border-line-strong px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {running ? 'Generating…' : 'Generate demo'}
      </button>
      {demoUrl ? (
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-[12px] text-accent hover:underline"
        >
          Open the generated concept →
        </a>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

const CRM_STATUSES = [
  'new',
  'shortlisted',
  'contacted',
  'meeting',
  'proposal',
  'won',
  'lost',
  'rejected',
] as const;

/** CRM status control on the detail page. */
export function CrmControl({
  businessId,
  initialStatus,
  initialNotes,
}: {
  businessId: string;
  initialStatus: string | null;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus ?? 'new');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/crm/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: notes.trim() === '' ? null : notes.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? 'Could not save');
      setMessage('Saved');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-[13px] outline-none focus:border-accent"
      >
        {CRM_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes"
        rows={3}
        className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-[13px] outline-none placeholder:text-ink-dim focus:border-accent"
      />

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-lg border border-line-strong px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save CRM status'}
      </button>

      {message ? <p className="text-[12px] text-ink-muted">{message}</p> : null}
    </div>
  );
}
