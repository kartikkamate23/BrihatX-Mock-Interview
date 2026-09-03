"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatRemaining as format } from "@/lib/timer";

export interface InterviewTimer {
  /** Milliseconds left, or null before the interview starts. */
  remainingMs: number | null;
  /** "04:31", or null before the interview starts. */
  display: string | null;
  running: boolean;
  /** Wall-clock start, for persistence. Null until started. */
  startedAt: number | null;
  /** Wall-clock deadline, for persistence. Null until started. */
  endsAt: number | null;
  /** The length actually running, which may differ from the requested one. */
  grantedSeconds: number;
  /** Optionally overrides the length, e.g. with the duration the server granted. */
  start: (durationSecondsOverride?: number) => void;
  stop: () => void;
}

export { formatRemaining } from "@/lib/timer";

/**
 * The authoritative end condition for an interview.
 *
 * Remaining time is derived from a fixed deadline (`endsAt - Date.now()`) rather
 * than by decrementing a counter each tick. A counter drifts: every tick the
 * browser delays -- and it delays a lot while WebRTC is negotiating, or while
 * the tab is backgrounded, where timers are throttled to once a minute -- is
 * time the interview silently gains. With a deadline the interview is the length
 * the candidate selected no matter how irregular the ticks are.
 *
 * `onExpire` and `onWarning` are read through a ref, so passing new inline
 * callbacks on every render cannot restart the timer.
 */
export function useInterviewTimer(
  durationSeconds: number,
  callbacks: {
    onExpire: () => void;
    /** Fired once, `warningAtSeconds` before the end, to let the AI wrap up. */
    onWarning?: () => void;
    warningAtSeconds?: number;
  }
): InterviewTimer {
  const { warningAtSeconds = 30 } = callbacks;

  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const endsAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);
  const grantedRef = useRef(durationSeconds);
  const warnedRef = useRef(false);
  /** The last whole second pushed into state, so identical values are skipped. */
  const lastRenderedSecondRef = useRef<number | null>(null);

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const clearInterval_ = useCallback(() => {
    // Browser timer ids are allowed to be zero.
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearInterval_();
    setRunning(false);
  }, [clearInterval_]);

  const tick = useCallback(() => {
    const endsAt = endsAtRef.current;
    if (endsAt === null) return;

    const left = Math.max(0, endsAt - Date.now());

    // State changes only when the displayed second changes.
    //
    // The countdown is rendered as mm:ss, so two ticks inside the same second
    // produce identical output. Setting state on every tick re-rendered the
    // whole interview room twice a second for no visible difference, and during
    // an interview that room is also holding a camera preview, an attention
    // detector and a live audio graph. Comparing the rounded value first makes
    // this exactly one render per second.
    const second = Math.ceil(left / 1000);
    if (second !== lastRenderedSecondRef.current) {
      lastRenderedSecondRef.current = second;
      setRemainingMs(left);
    }

    if (!warnedRef.current && left <= warningAtSeconds * 1000 && left > 0) {
      warnedRef.current = true;
      console.debug("[INTERVIEW] timer warning, wrapping up");
      cbRef.current.onWarning?.();
    }

    if (left <= 0 && !expiredRef.current) {
      // Latched: a delayed tick must not fire the end of the interview twice.
      expiredRef.current = true;
      clearInterval_();
      setRunning(false);
      console.debug("[INTERVIEW] timer expired");
      cbRef.current.onExpire();
    }
  }, [clearInterval_, warningAtSeconds]);

  const start = useCallback(
    (durationSecondsOverride?: number) => {
      // One timer per interview. A second start (Strict Mode, a re-render, a
      // late call-start event) must not extend or duplicate the countdown.
      if (intervalRef.current !== null || expiredRef.current) return;

      const seconds =
        durationSecondsOverride && durationSecondsOverride > 0
          ? durationSecondsOverride
          : durationSeconds;

      const now = Date.now();
      startedAtRef.current = now;
      endsAtRef.current = now + seconds * 1000;
      grantedRef.current = seconds;
      warnedRef.current = false;

      lastRenderedSecondRef.current = seconds;
      setRemainingMs(seconds * 1000);
      setRunning(true);

      intervalRef.current = setInterval(tick, 500);
      console.debug(`[INTERVIEW] timer started for ${seconds}s`);
    },
    [durationSeconds, tick]
  );

  /**
   * Re-reads the clock the moment the tab becomes visible again.
   *
   * Background tabs have their timers throttled to about once a minute, so a
   * candidate who switches away and back would otherwise see a stale countdown
   * until the next throttled tick. Nothing about the deadline changes -- it is an
   * absolute timestamp, so the elapsed time was always correct -- this only
   * refreshes what is on screen, and catches an expiry that fell due while the
   * tab was hidden.
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && intervalRef.current !== null) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tick]);

  useEffect(() => clearInterval_, [clearInterval_]);

  return {
    remainingMs,
    display: remainingMs === null ? null : format(remainingMs),
    running,
    startedAt: startedAtRef.current,
    endsAt: endsAtRef.current,
    grantedSeconds: grantedRef.current,
    start,
    stop,
  };
}
