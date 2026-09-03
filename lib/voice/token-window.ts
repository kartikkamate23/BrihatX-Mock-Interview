/**
 * Computes the two deadlines used by a Gemini Live ephemeral token.
 *
 * A token may keep an already-open socket alive for a short grace period, but
 * it must never be able to start a brand-new call after the paid interview time
 * has ended. Keeping those deadlines separate prevents a stale active session
 * from minting another call during its cleanup grace period.
 */
export function getLiveTokenWindow(params: {
  startedAtMs: number;
  grantedSeconds: number;
  nowMs?: number;
  graceMs?: number;
  connectWindowMs?: number;
}):
  | { valid: false }
  | {
      valid: true;
      interviewEndsAtMs: number;
      tokenExpiresAtMs: number;
      newSessionExpiresAtMs: number;
    } {
  const nowMs = params.nowMs ?? Date.now();
  const graceMs = params.graceMs ?? 2 * 60 * 1000;
  const connectWindowMs = params.connectWindowMs ?? 2 * 60 * 1000;

  if (
    !Number.isFinite(params.startedAtMs) ||
    !Number.isFinite(params.grantedSeconds) ||
    params.grantedSeconds <= 0 ||
    !Number.isFinite(nowMs) ||
    graceMs < 0 ||
    connectWindowMs <= 0
  ) {
    return { valid: false };
  }

  const interviewEndsAtMs = params.startedAtMs + params.grantedSeconds * 1000;
  if (!Number.isFinite(interviewEndsAtMs) || nowMs >= interviewEndsAtMs) {
    return { valid: false };
  }

  return {
    valid: true,
    interviewEndsAtMs,
    tokenExpiresAtMs: interviewEndsAtMs + graceMs,
    // Never advertise a connection window beyond the interview itself.
    newSessionExpiresAtMs: Math.min(nowMs + connectWindowMs, interviewEndsAtMs),
  };
}
