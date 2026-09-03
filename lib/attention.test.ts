import { describe, it, expect } from "vitest";

import { createAttentionTracker } from "./attention";

/** Feeds samples at a fixed cadence, as the detector does. */
function play(
  tracker: ReturnType<typeof createAttentionTracker>,
  opts: { attentive: boolean; confidence?: number } | null,
  fromMs: number,
  toMs: number,
  stepMs = 100
) {
  let last = tracker.snapshot();
  for (let t = fromMs; t <= toMs; t += stepMs) {
    last = tracker.update(
      opts === null
        ? null
        : { attentive: opts.attentive, confidence: opts.confidence ?? 0.9 },
      t
    );
  }
  return last;
}

describe("attention tracker — the 5 second rule", () => {
  it("stays attentive while the candidate looks at the screen", () => {
    const t = createAttentionTracker();
    const s = play(t, { attentive: true }, 0, 10_000);
    expect(s.state).toBe("attentive");
    expect(s.warningActive).toBe(false);
    expect(s.warningCount).toBe(0);
  });

  it("does NOT warn for a brief glance away", () => {
    const t = createAttentionTracker();
    play(t, { attentive: true }, 0, 1000);
    // Look away for 2s -- well under the threshold.
    play(t, { attentive: false }, 1100, 3100);
    const s = play(t, { attentive: true }, 3200, 5000);
    expect(s.warningCount).toBe(0);
    expect(s.state).toBe("attentive");
  });

  it("does not warn at 4.9s, and warns once past 5s", () => {
    const t = createAttentionTracker();
    play(t, { attentive: true }, 0, 500);

    const justUnder = play(t, { attentive: false }, 600, 5400);
    expect(justUnder.warningActive).toBe(false);
    expect(justUnder.state).toBe("looking-away");

    const past = play(t, { attentive: false }, 5500, 5800);
    expect(past.warningActive).toBe(true);
    expect(past.state).toBe("warning");
    expect(past.warningCount).toBe(1);
  });

  it("raises exactly one warning for one continuous look-away", () => {
    const t = createAttentionTracker();
    const s = play(t, { attentive: false }, 0, 30_000);
    expect(s.warningCount).toBe(1);
  });

  it("clears the warning once attention is sustained, and records the event", () => {
    const t = createAttentionTracker();
    play(t, { attentive: false }, 0, 6000);
    expect(t.snapshot().warningActive).toBe(true);

    const s = play(t, { attentive: true }, 6100, 7500);
    expect(s.warningActive).toBe(false);
    expect(s.state).toBe("recovered");

    const [event] = s.events;
    expect(event.type).toBe("attention_warning");
    expect(event.resolvedAt).not.toBeNull();
    expect(event.duration).toBeGreaterThan(0);
  });

  it("does not count missing readings as sustained recovery", () => {
    const t = createAttentionTracker();
    play(t, { attentive: false }, 0, 6000);

    // One good frame starts recovery, but the camera then stops producing a
    // trustworthy reading. The warning must remain active.
    t.update({ attentive: true, confidence: 0.9 }, 6100);
    const s = play(t, null, 6200, 8000);
    expect(s.warningActive).toBe(true);
    expect(s.warningCount).toBe(1);
  });

  it("can warn again after recovering", () => {
    const t = createAttentionTracker();
    play(t, { attentive: false }, 0, 6000);
    play(t, { attentive: true }, 6100, 8000);
    const s = play(t, { attentive: false }, 8100, 14_000);
    expect(s.warningCount).toBe(2);
    expect(s.warningActive).toBe(true);
  });
});

describe("attention tracker — resilience", () => {
  it("tolerates dropped detections within the grace period", () => {
    const t = createAttentionTracker();
    play(t, { attentive: true }, 0, 2000);
    // Detector loses the face for under the grace period (blink, motion blur).
    play(t, null, 2100, 3000);
    const s = play(t, { attentive: true }, 3100, 4000);
    expect(s.warningCount).toBe(0);
    expect(s.warningActive).toBe(false);
  });

  it("ignores low-confidence samples rather than treating them as look-away", () => {
    const t = createAttentionTracker();
    play(t, { attentive: true }, 0, 1000);
    // Poor lighting: readings arrive but are not trustworthy.
    const s = play(t, { attentive: false, confidence: 0.1 }, 1100, 2000);
    expect(s.warningActive).toBe(false);
  });

  it("eventually warns if the face is missing for far longer than the grace period", () => {
    const t = createAttentionTracker();
    play(t, { attentive: true }, 0, 500);
    const s = play(t, null, 600, 12_000);
    expect(s.warningActive).toBe(true);
    expect(s.warningCount).toBe(1);
  });

  it("never ends or blocks the interview -- it only reports", () => {
    const t = createAttentionTracker();
    const s = play(t, { attentive: false }, 0, 120_000);
    // A two minute look-away is still just one recorded observation.
    expect(s.warningCount).toBe(1);
    expect(s.events.every((e) => e.type === "attention_warning")).toBe(true);
  });

  it("closes an open warning when the interview ends mid-warning", () => {
    const t = createAttentionTracker();
    play(t, { attentive: false }, 0, 7000);
    const s = t.finalize(9000);
    expect(s.events[0].resolvedAt).toBe(9000);
    expect(s.events[0].duration).toBe(9000);
  });

  it("honours a custom threshold", () => {
    const t = createAttentionTracker({ awayThresholdMs: 2000 });
    const s = play(t, { attentive: false }, 0, 2500);
    expect(s.warningActive).toBe(true);
  });
});
