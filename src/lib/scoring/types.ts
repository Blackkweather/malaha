/**
 * Every score in this application is explainable: a number is always produced
 * together with the reasons that moved it, so the UI never shows a black box.
 */
export interface ScoreReason {
  /** Stable machine code, e.g. `high_review_volume`. */
  code: string;
  /** Human sentence shown in the UI. */
  label: string;
  impact: 'positive' | 'negative' | 'neutral';
  /** Approximate contribution to the component score, in points. */
  points: number;
}

export interface ComponentScore {
  score: number;
  reasons: ScoreReason[];
  breakdown: Record<string, number>;
}

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
