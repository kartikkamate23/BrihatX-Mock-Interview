import { clampScore, scoreBand } from "@/lib/score";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  /** Outer diameter in pixels. */
  size?: number;
  /** Small caption under the number, e.g. "Overall". */
  label?: string;
  className?: string;
}

/**
 * The overall score, drawn as a ring.
 *
 * A single number in a paragraph -- which is what this page used to be -- gives
 * no sense of where 72 sits between a bad interview and a good one. The ring
 * makes the proportion the first thing read and the digits the confirmation.
 *
 * Pure SVG with a CSS-animated `stroke-dashoffset`, and no client component:
 * the score is known on the server, nothing here reacts to anything, and the
 * feedback page should not ship JavaScript to draw a circle. The reveal is a
 * keyframe, so `prefers-reduced-motion` lands it on the final value instantly
 * along with the rest of the project's motion.
 */
const ScoreRing = ({ score, size = 132, label, className }: Props) => {
  const value = clampScore(score);
  const band = scoreBand(value);

  // Geometry: the stroke straddles the radius, so the circle is inset by half
  // the stroke width or the ring is clipped by the viewBox.
  const stroke = Math.max(6, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / 100) * circumference;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} out of 100. ${band.label}.`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        // Rotated so the ring fills from twelve o'clock rather than three.
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-dark-200)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="animate-ring-fill"
          style={
            {
              // The keyframe animates between these two. `--ring-dash` is the
              // empty ring it starts from; `--ring-offset` is where the score
              // lands. `strokeDashoffset` repeats the end value so the ring is
              // still correct if the animation never runs at all.
              "--ring-dash": `${circumference}`,
              "--ring-offset": `${circumference - filled}`,
              strokeDashoffset: circumference - filled,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-semibold tabular-nums", band.text)}
          style={{ fontSize: size * 0.28 }}
        >
          {value}
        </span>
        <span
          className="text-light-100"
          style={{ fontSize: Math.max(10, size * 0.09) }}
        >
          {label ?? "/ 100"}
        </span>
      </div>
    </div>
  );
};

export default ScoreRing;
