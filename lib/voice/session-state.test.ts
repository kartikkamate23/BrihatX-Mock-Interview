import { describe, expect, it } from "vitest";

import {
  canEndManually,
  canTransition,
  clockRunning,
  holdsResources,
  isTerminal,
  statusLabel,
  statusTone,
  transition,
  type SessionState,
} from "@/lib/voice/session-state";

/** Applies a sequence of events, for readable multi-step assertions. */
function run(from: SessionState, ...events: string[]): SessionState {
  return events.reduce<SessionState>(
    (state, type) => transition(state, { type } as never),
    from
  );
}

describe("the happy path", () => {
  it("runs idle -> permissions -> connecting -> connected -> interviewing", () => {
    expect(
      run("idle", "START", "PERMISSIONS_GRANTED", "CONNECTED", "FIRST_TURN")
    ).toBe("interviewing");
  });

  it("ends through `ending` and lands on completed", () => {
    expect(
      run(
        "idle",
        "START",
        "PERMISSIONS_GRANTED",
        "CONNECTED",
        "FIRST_TURN",
        "END_REQUESTED",
        "FINALIZED"
      )
    ).toBe("completed");
  });
});

describe("duration expiry", () => {
  it("goes interviewing -> duration_expired -> ending -> completed", () => {
    expect(
      run("interviewing", "DURATION_EXPIRED", "END_REQUESTED", "FINALIZED")
    ).toBe("completed");
  });

  it("cannot be reached twice: a second expiry from duration_expired is dropped", () => {
    const first = transition("interviewing", { type: "DURATION_EXPIRED" });
    expect(first).toBe("duration_expired");
    // A delayed second tick must not re-enter the expiry path.
    expect(transition(first, { type: "DURATION_EXPIRED" })).toBe("duration_expired");
  });

  it("still expires while reconnecting -- time does not stop for a dropped socket", () => {
    expect(transition("reconnecting", { type: "DURATION_EXPIRED" })).toBe(
      "duration_expired"
    );
  });
});

describe("manual end", () => {
  it("is available exactly while a live session is held", () => {
    expect(canEndManually("connected")).toBe(true);
    expect(canEndManually("interviewing")).toBe(true);
    expect(canEndManually("reconnecting")).toBe(true);
    expect(canEndManually("idle")).toBe(false);
    expect(canEndManually("ending")).toBe(false);
    expect(canEndManually("completed")).toBe(false);
  });

  it("is not an error state -- it finalizes like any other ending", () => {
    const state = run("interviewing", "END_REQUESTED", "FINALIZED");
    expect(state).toBe("completed");
    expect(isTerminal(state)).toBe(true);
  });

  it("is idempotent: a second end request from `ending` changes nothing", () => {
    const ending = transition("interviewing", { type: "END_REQUESTED" });
    expect(ending).toBe("ending");
    expect(transition(ending, { type: "END_REQUESTED" })).toBe("ending");
  });
});

describe("impossible transitions are dropped, not applied", () => {
  it("ignores a late CONNECTED after the interview has finished", () => {
    expect(transition("completed", { type: "CONNECTED" })).toBe("completed");
  });

  it("ignores a late transcript-era event after finalisation", () => {
    expect(transition("completed", { type: "FIRST_TURN" })).toBe("completed");
  });

  it("cannot start an interview from `interviewing`", () => {
    expect(canTransition("interviewing", "START")).toBe(false);
  });

  it("cannot finalize something that never began ending", () => {
    expect(canTransition("interviewing", "FINALIZED")).toBe(false);
  });
});

describe("resource and clock predicates", () => {
  it("reports resources held for every live state", () => {
    for (const state of [
      "connecting",
      "connected",
      "interviewing",
      "reconnecting",
      "duration_expired",
    ] as SessionState[]) {
      expect(holdsResources(state)).toBe(true);
    }
  });

  it("reports no resources held once the session is over", () => {
    for (const state of ["idle", "ending", "completed", "failed"] as SessionState[]) {
      expect(holdsResources(state)).toBe(false);
    }
  });

  it("runs the clock only while the interview is actually happening", () => {
    expect(clockRunning("connected")).toBe(true);
    expect(clockRunning("interviewing")).toBe(true);
    // Still running: a reconnect does not buy the candidate extra time.
    expect(clockRunning("reconnecting")).toBe(true);
    expect(clockRunning("duration_expired")).toBe(false);
    expect(clockRunning("ending")).toBe(false);
  });
});

describe("recovery", () => {
  it("returns to interviewing after a successful reconnect", () => {
    expect(run("interviewing", "CONNECTION_LOST", "RECONNECTED")).toBe(
      "interviewing"
    );
  });

  it("finalizes rather than failing when a reconnect gives up", () => {
    // The transcript so far is still worth saving, so a failed recovery ends the
    // interview rather than discarding it.
    expect(transition("reconnecting", { type: "FAILED" })).toBe("ending");
  });

  it("allows a fresh attempt after a failure", () => {
    expect(run("failed", "START")).toBe("requesting_permissions");
  });
});

describe("status labels", () => {
  it("gives every state a non-empty label", () => {
    const states: SessionState[] = [
      "idle",
      "requesting_permissions",
      "connecting",
      "connected",
      "interviewing",
      "reconnecting",
      "duration_expired",
      "ending",
      "completed",
      "failed",
    ];
    for (const state of states) {
      expect(statusLabel(state).length).toBeGreaterThan(0);
    }
  });

  it("distinguishes listening from the interviewer speaking", () => {
    expect(statusLabel("interviewing", { speaking: true })).toMatch(/speaking/i);
    expect(statusLabel("interviewing", { speaking: false })).toMatch(/listening/i);
  });
});

describe("statusTone", () => {
  const STATES: SessionState[] = [
    "idle",
    "requesting_permissions",
    "connecting",
    "connected",
    "interviewing",
    "reconnecting",
    "duration_expired",
    "ending",
    "completed",
    "failed",
  ];

  it("gives every state a tone", () => {
    // The room colours a pill from this. A state added later without a tone
    // would render undefined, so this asserts exhaustiveness at runtime too.
    for (const state of STATES) {
      expect(statusTone(state)).toBeTruthy();
    }
  });

  it("distinguishes the two halves of a live interview", () => {
    expect(statusTone("interviewing", { speaking: true })).toBe("speaking");
    expect(statusTone("interviewing", { speaking: false })).toBe("listening");
  });

  it("marks the states where the system is busy", () => {
    expect(statusTone("connecting")).toBe("working");
    expect(statusTone("reconnecting")).toBe("working");
    expect(statusTone("ending")).toBe("working");
    expect(statusTone("duration_expired")).toBe("working");
  });

  it("only calls a failure an error", () => {
    expect(statusTone("failed")).toBe("error");
    expect(statusTone("completed")).not.toBe("error");
  });

  it("never returns a tone without a label to go with it", () => {
    // Colour must never be the only signal a candidate has.
    for (const state of STATES) {
      expect(statusLabel(state).length).toBeGreaterThan(0);
    }
  });
});
