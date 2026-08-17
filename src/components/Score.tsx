/** Colour ramp shared by every score display, so a number always reads the same. */
export function scoreTone(score: number): { text: string; bg: string; bar: string } {
  if (score >= 85) return { text: 'text-positive', bg: 'bg-positive/10', bar: 'bg-positive' };
  if (score >= 70) return { text: 'text-accent', bg: 'bg-accent/10', bar: 'bg-accent' };
  if (score >= 50) return { text: 'text-warn', bg: 'bg-warn/10', bar: 'bg-warn' };
  return { text: 'text-ink-muted', bg: 'bg-ink-muted/10', bar: 'bg-ink-muted' };
}

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone = scoreTone(score);
  return (
    <div className={`flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 ${tone.bg}`}>
      <span className={`font-mono text-[17px] font-bold leading-none ${tone.text}`}>
        {Math.round(score)}
      </span>
      {label ? (
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-dim">{label}</span>
      ) : null}
    </div>
  );
}

export function ScoreBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight?: number;
}) {
  const tone = scoreTone(score);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-ink-muted">
          {label}
          {weight !== undefined ? (
            <span className="ml-1.5 font-mono text-[10px] text-ink-dim">
              {Math.round(weight * 100)}%
            </span>
          ) : null}
        </span>
        <span className={`font-mono text-[13px] font-semibold ${tone.text}`}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-ink-dim">no rating</span>;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-warn">&#9733;</span>
      <span className="font-mono font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}
