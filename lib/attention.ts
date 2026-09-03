/**
 * The 5-second camera-attention tracker.
 *
 * Pure state machine, no React, no camera. The detector (MediaPipe in the
 * browser) feeds it one sample at a time; this module decides when a stretch of
 * looking away is long enough to record, and when it has ended.
 *
 * It never ends or blocks an interview. A two-minute look-away is still one
 * recorded observation. Missing or low-confidence readings are not treated as
 * evidence of inattention until a grace period has passed, so a blink, a brief
 * motion blur, or a dropped frame cannot raise a warning on its own.
 */

export interface AttentionSample {
  attentive: boolean;
  /** 0..1. Below the tracker threshold the sample is ignored. */
  confidence: number;
}

export type AttentionState =
  | "attentive"
  | "looking-away"
  | "warning"
  | "recovered";

export interface AttentionEvent {
  type: "attention_warning";
  /** ms since the interview started. */
  startedAt: number;
  duration: number | null;
  resolvedAt: number | null;
}

export interface AttentionSnapshot {
  state: AttentionState;
  warningActive: boolean;
  warningCount: number;
  events: AttentionEvent[];
}

export interface AttentionTrackerOptions {
  /** How long a look-away must last before it becomes a warning. */
  awayThresholdMs?: number;
  /** Dropped detections shorter than this are ignored. */
  graceMs?: number;
  /** Sustained attention required to clear an active warning. */
  recoveryMs?: number;
  /** Samples below this confidence are treated as missing. */
  minConfidence?: number;
}

const DEFAULTS = {
  awayThresholdMs: 5_000,
  graceMs: 1_500,
  recoveryMs: 1_000,
  minConfidence: 0.4,
} as const;

export interface AttentionTracker {
  update(sample: AttentionSample | null, elapsedMs: number): AttentionSnapshot;
  snapshot(): AttentionSnapshot;
  finalize(elapsedMs: number): AttentionSnapshot;
}

export function createAttentionTracker(
  options: AttentionTrackerOptions = {}
): AttentionTracker {
  const awayThresholdMs = options.awayThresholdMs ?? DEFAULTS.awayThresholdMs;
  const graceMs = options.graceMs ?? DEFAULTS.graceMs;
  const recoveryMs = options.recoveryMs ?? DEFAULTS.recoveryMs;
  const minConfidence = options.minConfidence ?? DEFAULTS.minConfidence;

  let state: AttentionState = "attentive";
  let warningActive = false;
  let warningCount = 0;
  const events: AttentionEvent[] = [];

  let awayStartedAt: number | null = null;
  let lastTrustworthyAt: number | null = null;
  let lastTrustworthyAttentive = true;
  let recoveryStartedAt: number | null = null;
  let openEventIndex: number | null = null;

  const copyEvents = () => events.map((event) => ({ ...event }));

  const snapshot = (): AttentionSnapshot => ({
    state,
    warningActive,
    warningCount,
    events: copyEvents(),
  });

  const openWarning = (startedAt: number) => {
    if (warningActive) return;
    warningActive = true;
    warningCount += 1;
    events.push({
      type: "attention_warning",
      startedAt,
      duration: null,
      resolvedAt: null,
    });
    openEventIndex = events.length - 1;
    state = "warning";
  };

  const applyAway = (elapsedMs: number) => {
    recoveryStartedAt = null;
    if (awayStartedAt === null) awayStartedAt = elapsedMs;
    if (elapsedMs < awayStartedAt) return;
    const awayFor = elapsedMs - awayStartedAt;
    if (awayFor >= awayThresholdMs) {
      openWarning(awayStartedAt);
    } else if (!warningActive) {
      state = "looking-away";
    }
  };

  const applyAttentive = (elapsedMs: number) => {
    awayStartedAt = null;
    if (warningActive) {
      if (recoveryStartedAt === null) recoveryStartedAt = elapsedMs;
      if (elapsedMs - recoveryStartedAt >= recoveryMs) {
        if (openEventIndex !== null) {
          const event = events[openEventIndex];
          event.resolvedAt = elapsedMs;
          event.duration = elapsedMs - event.startedAt;
          openEventIndex = null;
        }
        warningActive = false;
        state = "recovered";
        recoveryStartedAt = null;
      }
      return;
    }
    recoveryStartedAt = null;
    state = state === "recovered" ? "recovered" : "attentive";
  };

  const update = (
    sample: AttentionSample | null,
    elapsedMs: number
  ): AttentionSnapshot => {
    const trustworthy =
      sample !== null && sample.confidence >= minConfidence;

    if (trustworthy) {
      lastTrustworthyAt = elapsedMs;
      lastTrustworthyAttentive = sample.attentive;
      if (sample.attentive) {
        applyAttentive(elapsedMs);
      } else {
        applyAway(elapsedMs);
      }
      return snapshot();
    }

    // Missing or low-confidence: never counts as recovery.
    recoveryStartedAt = null;

    if (
      lastTrustworthyAttentive &&
      lastTrustworthyAt !== null &&
      elapsedMs - lastTrustworthyAt < graceMs
    ) {
      return snapshot();
    }

    if (awayStartedAt === null) {
      awayStartedAt =
        lastTrustworthyAttentive && lastTrustworthyAt !== null
          ? lastTrustworthyAt + graceMs
          : (lastTrustworthyAt ?? elapsedMs);
    }

    if (elapsedMs >= awayStartedAt) applyAway(elapsedMs);
    return snapshot();
  };

  const finalize = (elapsedMs: number): AttentionSnapshot => {
    if (openEventIndex !== null) {
      const event = events[openEventIndex];
      event.resolvedAt = elapsedMs;
      event.duration = Math.max(0, elapsedMs - event.startedAt);
      openEventIndex = null;
    }
    return snapshot();
  };

  return { update, snapshot, finalize };
}
