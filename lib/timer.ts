/**
 * Deadline arithmetic for the interview clock, kept free of React so the rules
 * that decide when an interview ends can be tested directly.
 */

export function formatRemaining(ms: number): string {
  // A countdown must not display 00:00 while the deadline is still in the
  // future. Using ceil also keeps this formatter aligned with the timer hook,
  // which only publishes when the visible whole second changes.
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Milliseconds left, never negative. */
export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

export function hasExpired(endsAt: number, now: number): boolean {
  return now >= endsAt;
}

/** The deadline for a session of `durationSeconds` starting at `startedAt`. */
export function deadlineFor(startedAt: number, durationSeconds: number): number {
  return startedAt + durationSeconds * 1000;
}

/**
 * True once the assistant should stop opening new topics.
 *
 * Separate from expiry so the interview can land gently instead of being cut
 * off mid-question.
 */
export function shouldWrapUp(
  endsAt: number,
  now: number,
  warningAtSeconds = 30
): boolean {
  const left = remainingMs(endsAt, now);
  return left > 0 && left <= warningAtSeconds * 1000;
}
