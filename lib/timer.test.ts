import { describe, it, expect } from "vitest";

import {
  deadlineFor,
  formatRemaining,
  hasExpired,
  remainingMs,
  shouldWrapUp,
} from "./timer";

describe("interview clock", () => {
  it("formats mm:ss", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(9_000)).toBe("00:09");
    expect(formatRemaining(62_000)).toBe("01:02");
    expect(formatRemaining(15 * 60 * 1000)).toBe("15:00");
  });

  it("never displays negative time", () => {
    expect(formatRemaining(-5_000)).toBe("00:00");
    expect(remainingMs(1_000, 9_000)).toBe(0);
  });

  it("does not display zero before the deadline", () => {
    expect(formatRemaining(1)).toBe("00:01");
    expect(formatRemaining(8_001)).toBe("00:09");
  });

  it("builds the deadline from the selected duration", () => {
    expect(deadlineFor(1_000, 300)).toBe(301_000);
    expect(deadlineFor(0, 900)).toBe(900_000);
  });

  it("is derived from timestamps, so delayed ticks cannot add time", () => {
    const start = 1_000_000;
    const endsAt = deadlineFor(start, 300); // 5 minutes

    // A tick that arrives 45s late still reports the true remaining time; a
    // decrementing counter would have drifted by the whole 45s.
    const lateTick = start + 100_000;
    expect(remainingMs(endsAt, lateTick)).toBe(200_000);
    expect(formatRemaining(remainingMs(endsAt, lateTick))).toBe("03:20");
  });

  it("expires exactly at the deadline", () => {
    const endsAt = deadlineFor(0, 300);
    expect(hasExpired(endsAt, endsAt - 1)).toBe(false);
    expect(hasExpired(endsAt, endsAt)).toBe(true);
    expect(hasExpired(endsAt, endsAt + 60_000)).toBe(true);
  });

  it("ends a 5, 10 and 15 minute session at the right moment", () => {
    for (const minutes of [5, 10, 15]) {
      const endsAt = deadlineFor(0, minutes * 60);
      expect(hasExpired(endsAt, (minutes * 60 - 1) * 1000)).toBe(false);
      expect(hasExpired(endsAt, minutes * 60 * 1000)).toBe(true);
    }
  });
});

describe("wrap-up window", () => {
  it("does not ask for a wrap-up early in the interview", () => {
    const endsAt = deadlineFor(0, 300);
    expect(shouldWrapUp(endsAt, 0)).toBe(false);
    expect(shouldWrapUp(endsAt, 200_000)).toBe(false);
  });

  it("asks for a wrap-up inside the final window", () => {
    const endsAt = deadlineFor(0, 300);
    expect(shouldWrapUp(endsAt, 275_000)).toBe(true); // 25s left
  });

  it("stops asking once time is up, since the session is ending anyway", () => {
    const endsAt = deadlineFor(0, 300);
    expect(shouldWrapUp(endsAt, 300_000)).toBe(false);
  });

  it("honours a custom window", () => {
    const endsAt = deadlineFor(0, 300);
    expect(shouldWrapUp(endsAt, 250_000, 60)).toBe(true); // 50s left, 60s window
    expect(shouldWrapUp(endsAt, 230_000, 60)).toBe(false); // 70s left
  });
});
