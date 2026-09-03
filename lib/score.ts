/**
 * How a 0-100 score is presented.
 *
 * Kept free of React so the banding rules can be tested directly, and kept in
 * one place so a score means the same thing everywhere it is drawn: the ring on
 * the feedback page, the per-category bars beneath it, and the score column of
 * an interview card must never disagree about whether 68 is "good".
 */

export type ScoreTone = "strong" | "solid" | "fair" | "weak";

export interface ScoreBand {
  tone: ScoreTone;
  /** Short human label, e.g. for a badge next to the number. */
  label: string;
  /** Tailwind text colour class. */
  text: string;
  /** Tailwind background class, for bar fills and dots. */
  fill: string;
  /** A stroke colour for SVG, which cannot use a Tailwind background. */
  stroke: string;
}

const BANDS: Record<ScoreTone, ScoreBand> = {
  strong: {
    tone: "strong",
    label: "Strong",
    text: "text-success-100",
    fill: "bg-success-100",
    stroke: "var(--color-success-100)",
  },
  solid: {
    tone: "solid",
    label: "Solid",
    text: "text-primary-200",
    fill: "bg-primary-200",
    stroke: "var(--color-primary-200)",
  },
  fair: {
    tone: "fair",
    label: "Developing",
    text: "text-warning-100",
    fill: "bg-warning-100",
    stroke: "var(--color-warning-100)",
  },
  weak: {
    tone: "weak",
    label: "Needs work",
    text: "text-destructive-100",
    fill: "bg-destructive-100",
    stroke: "var(--color-destructive-100)",
  },
};

/**
 * Bands a score.
 *
 * The thresholds are deliberately not a flattering curve. An interview score
 * that calls 55 "solid" is not preparing anyone for a real interview, so the
 * middle of the range reads as developing rather than as a pass.
 */
export function scoreBand(score: number): ScoreBand {
  const value = clampScore(score);
  if (value >= 80) return BANDS.strong;
  if (value >= 65) return BANDS.solid;
  if (value >= 45) return BANDS.fair;
  return BANDS.weak;
}

/** Keeps a score inside 0-100, including when the model returns nonsense. */
export function clampScore(score: number): number {
  // Only NaN falls back to zero. An infinity is a direction, and clamping it
  // through the same min/max as everything else lands it at the right end of
  // the range -- a `Number.isFinite` guard here sent +Infinity to 0, which
  // would have drawn a full-marks answer as a total failure.
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * The average of the scores that exist.
 *
 * Interviews that were never taken have no score, and counting those as zero
 * would tell someone their average is falling every time they create an
 * interview they have not sat yet. Returns null when nothing has been scored.
 */
export function averageScore(scores: (number | undefined)[]): number | null {
  const scored = scores.filter((s): s is number => typeof s === "number");
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, s) => sum + clampScore(s), 0);
  return Math.round(total / scored.length);
}
