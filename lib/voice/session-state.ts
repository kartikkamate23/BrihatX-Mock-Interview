/**
 * The interview lifecycle as an explicit state machine.
 *
 * Pure, so the rules that decide what an interview may do next can be tested
 * directly instead of by driving a React component with a fake microphone.
 * Scattered booleans (`isConnecting && !isEnding && hasStarted`) are what let an
 * interview re-enter a call it had already left, or finish twice; an explicit
 * transition table makes those impossible rather than merely unlikely.
 */

export type SessionState =
  | "idle"
  | "requesting_permissions"
  | "connecting"
  | "connected"
  | "interviewing"
  | "reconnecting"
  | "duration_expired"
  | "ending"
  | "completed"
  | "failed";

export type SessionEvent =
  | { type: "START" }
  | { type: "PERMISSIONS_GRANTED" }
  | { type: "PERMISSIONS_DENIED" }
  | { type: "CONNECTED" }
  | { type: "FIRST_TURN" }
  | { type: "CONNECTION_LOST" }
  | { type: "RECONNECTED" }
  | { type: "DURATION_EXPIRED" }
  | { type: "END_REQUESTED" }
  | { type: "FINALIZED" }
  | { type: "FAILED" }
  | { type: "RESET" };

/**
 * Every legal move. Anything absent is dropped rather than applied: a transport
 * can deliver a late "connected" after teardown has begun, and honouring it
 * would restart an interview that is already being scored.
 */
const TRANSITIONS: Record<
  SessionState,
  Partial<Record<SessionEvent["type"], SessionState>>
> = {
  idle: {
    START: "requesting_permissions",
  },
  requesting_permissions: {
    PERMISSIONS_GRANTED: "connecting",
    PERMISSIONS_DENIED: "failed",
    FAILED: "failed",
    END_REQUESTED: "idle",
  },
  connecting: {
    CONNECTED: "connected",
    CONNECTION_LOST: "reconnecting",
    // Ending before audio ever flowed has nothing to finalize.
    END_REQUESTED: "ending",
    DURATION_EXPIRED: "ending",
    FAILED: "failed",
  },
  connected: {
    FIRST_TURN: "interviewing",
    CONNECTION_LOST: "reconnecting",
    DURATION_EXPIRED: "duration_expired",
    END_REQUESTED: "ending",
    FAILED: "failed",
  },
  interviewing: {
    CONNECTION_LOST: "reconnecting",
    DURATION_EXPIRED: "duration_expired",
    END_REQUESTED: "ending",
    FAILED: "failed",
  },
  reconnecting: {
    RECONNECTED: "interviewing",
    // Time does not stop for a reconnect; the deadline still governs.
    DURATION_EXPIRED: "duration_expired",
    END_REQUESTED: "ending",
    FAILED: "ending",
  },
  duration_expired: {
    // The only way out is a clean close-out, which is what makes automatic
    // expiry indistinguishable from a manual end downstream.
    END_REQUESTED: "ending",
    FAILED: "ending",
  },
  ending: {
    FINALIZED: "completed",
    FAILED: "failed",
  },
  completed: {
    RESET: "idle",
  },
  failed: {
    RESET: "idle",
    START: "requesting_permissions",
  },
};

export function canTransition(
  state: SessionState,
  event: SessionEvent["type"]
): boolean {
  return TRANSITIONS[state][event] !== undefined;
}

/** Applies an event, or returns the current state unchanged if it is illegal. */
export function transition(state: SessionState, event: SessionEvent): SessionState {
  return TRANSITIONS[state][event.type] ?? state;
}

/** True once the interview has finished for any reason, cleanly or not. */
export function isTerminal(state: SessionState): boolean {
  return state === "completed" || state === "failed";
}

/** True while the session holds a live transport, camera, or microphone. */
export function holdsResources(state: SessionState): boolean {
  return (
    state === "connecting" ||
    state === "connected" ||
    state === "interviewing" ||
    state === "reconnecting" ||
    state === "duration_expired"
  );
}

/** True while the countdown should be running. */
export function clockRunning(state: SessionState): boolean {
  return (
    state === "connected" || state === "interviewing" || state === "reconnecting"
  );
}

/** True when the End button should be offered. */
export function canEndManually(state: SessionState): boolean {
  return (
    state === "connected" || state === "interviewing" || state === "reconnecting"
  );
}

/**
 * The user-facing status line for each state.
 *
 * Kept here rather than in the component so the wording is covered by the same
 * tests as the transitions, and so a state added later cannot silently render as
 * a blank status.
 */
export function statusLabel(
  state: SessionState,
  options: { speaking?: boolean } = {}
): string {
  switch (state) {
    case "idle":
      return "Ready to start";
    case "requesting_permissions":
      return "Waiting for camera and microphone access...";
    case "connecting":
      return "Joining your interview room...";
    case "connected":
      return "Your interviewer is preparing the first question...";
    case "interviewing":
      return options.speaking
        ? "Your interviewer is speaking..."
        : "Listening for your answer...";
    case "reconnecting":
      return "Connection interrupted. Restoring your interview...";
    case "duration_expired":
      return "Time is up. Wrapping up...";
    case "ending":
      return "Saving and scoring your interview...";
    case "completed":
      return "Interview complete.";
    case "failed":
      return "The interview did not complete. You can start it again.";
  }
}

/**
 * How a state should read at a glance.
 *
 * The interview room shows the status as a pill over the camera, because during
 * an interview the candidate is looking at the video, not at a line of text
 * below it. Colour carries the same information as the wording for anyone
 * scanning rather than reading, but never only the colour: the label is always
 * present, so this is redundant reinforcement rather than a colour-only signal.
 *
 * Kept beside `statusLabel` and covered by the same tests, so a state added
 * later cannot render with a tone nobody chose.
 */
export type StatusTone = "speaking" | "listening" | "working" | "idle" | "error";

export function statusTone(
  state: SessionState,
  options: { speaking?: boolean } = {}
): StatusTone {
  switch (state) {
    case "idle":
    case "connected":
      return "idle";
    case "requesting_permissions":
    case "connecting":
    case "reconnecting":
    case "duration_expired":
    case "ending":
      return "working";
    case "interviewing":
      return options.speaking ? "speaking" : "listening";
    case "completed":
      return "idle";
    case "failed":
      return "error";
  }
}

/** Why an interview ended, recorded on the session document. */
export type EndReason = "duration_expired" | "manual" | "connection_lost" | "error";
