import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatRemaining } from "@/lib/timer";

interface Props {
  attention: InterviewAttentionSummary;
  /** How long the session ran, to put the warnings in proportion. */
  elapsedSeconds?: number;
}

/**
 * What the camera-attention monitor observed during the interview.
 *
 * This was recorded on every interview and then never shown, so the one signal
 * a candidate cannot self-assess -- whether they held the camera -- was
 * collected and thrown away.
 *
 * The wording is careful on purpose, and should stay that way. The detector
 * reports that a face was not oriented towards the camera for a stretch of
 * seconds. It cannot tell why: a candidate may have been thinking, reading the
 * question, or sitting under a light that defeated the model. So this reports
 * observations and their timestamps, and never characterises them as
 * dishonesty, cheating, or even certain inattention.
 */
const AttentionSummaryPanel = ({ attention, elapsedSeconds }: Props) => {
  const warnings = attention.warnings ?? 0;
  const events = attention.events ?? [];

  // Only completed events have a duration; one still open when the interview
  // ended has null, and must not be counted as zero seconds of looking away.
  const measured = events.filter(
    (event): event is InterviewAttentionEvent & { duration: number } =>
      typeof event.duration === "number"
  );
  const totalAway = measured.reduce((sum, event) => sum + event.duration, 0);
  const longest = measured.reduce(
    (max, event) => Math.max(max, event.duration),
    0
  );

  const clean = warnings === 0;

  return (
    <Panel>
      <PanelHeader
        title="Camera attention"
        hint="Observed on your device. No video ever left your browser."
        action={
          <Badge variant={clean ? "success" : "warning"} dot>
            {clean
              ? "No warnings"
              : `${warnings} warning${warnings === 1 ? "" : "s"}`}
          </Badge>
        }
      />

      {clean ? (
        <p className="text-sm leading-6 text-light-100">
          You held the camera throughout. In a real interview that reads as
          engagement, and it is one of the easier things to get right on video.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-6 text-light-100">
            The monitor noticed{" "}
            {warnings === 1 ? "one stretch" : `${warnings} stretches`} where you
            did not appear to be looking towards the camera for around five
            seconds or more. It cannot tell why — thinking and reading the
            question look the same to it — so treat this as a prompt to check
            your habits on video, not as a verdict.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-light-100">Warnings</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">
                {warnings}
              </dd>
            </div>
            {longest > 0 && (
              <div>
                <dt className="text-xs text-light-100">Longest stretch</dt>
                <dd className="text-lg font-semibold tabular-nums text-white">
                  {Math.round(longest / 1000)}s
                </dd>
              </div>
            )}
            {totalAway > 0 && elapsedSeconds ? (
              <div>
                <dt className="text-xs text-light-100">Share of the session</dt>
                <dd className="text-lg font-semibold tabular-nums text-white">
                  {Math.round((totalAway / (elapsedSeconds * 1000)) * 100)}%
                </dd>
              </div>
            ) : null}
          </dl>

          {measured.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs uppercase tracking-wide text-light-100">
                When it happened
              </h4>
              <ul className="flex list-none flex-wrap gap-2 p-0">
                {measured.slice(0, 12).map((event, index) => (
                  <li key={`${event.startedAt}-${index}`}>
                    <Badge variant="neutral" size="sm">
                      <span className="tabular-nums">
                        {formatRemaining(event.startedAt)}
                      </span>
                      <span className="text-light-100/70">
                        · {Math.round(event.duration / 1000)}s
                      </span>
                    </Badge>
                  </li>
                ))}
                {measured.length > 12 && (
                  <li>
                    <Badge variant="neutral" size="sm">
                      +{measured.length - 12} more
                    </Badge>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};

export default AttentionSummaryPanel;
