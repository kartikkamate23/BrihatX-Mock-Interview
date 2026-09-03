import { Badge } from "@/components/ui/badge";
import { clampScore, scoreBand } from "@/lib/score";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  score: number;
  /** The model's note for this category, shown under the bar. */
  comment?: string;
  /** Staggers the fill so a column of bars sweeps rather than snapping. */
  index?: number;
  className?: string;
}

/**
 * One scored category.
 *
 * The bar is a real proportion rather than decoration, so the eye can compare
 * "Communication" against "Technical Knowledge" without reading either number.
 * It carries proper `meter` semantics: a screen reader gets the value and the
 * range, not a pair of nested empty divs.
 *
 * The fill is a CSS keyframe on `transform: scaleX`, which is composited, so a
 * page of these costs no layout work and no JavaScript.
 */
const ScoreBar = ({ label, score, comment, index = 0, className }: Props) => {
  const value = clampScore(score);
  const band = scoreBand(value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="flex items-center gap-2">
          <Badge
            variant={
              band.tone === "strong"
                ? "success"
                : band.tone === "solid"
                  ? "accent"
                  : band.tone === "fair"
                    ? "warning"
                    : "danger"
            }
            size="sm"
          >
            {band.label}
          </Badge>
          <span className={cn("text-sm font-semibold tabular-nums", band.text)}>
            {value}
          </span>
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value} out of 100`}
        className="h-2 w-full overflow-hidden rounded-full bg-dark-200"
      >
        <div
          className={cn("h-full origin-left rounded-full animate-bar-fill", band.fill)}
          style={{
            width: `${value}%`,
            // Capped so the last bar in a long list is not left waiting.
            animationDelay: `${Math.min(index, 6) * 70}ms`,
          }}
        />
      </div>

      {comment && <p className="text-sm leading-6 text-light-100">{comment}</p>}
    </div>
  );
};

export default ScoreBar;
