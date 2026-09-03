import { describe, expect, it } from "vitest";

import { getLiveTokenWindow } from "@/lib/voice/token-window";

describe("getLiveTokenWindow", () => {
  it("keeps connection startup inside the interview deadline", () => {
    const window = getLiveTokenWindow({
      startedAtMs: 1_000,
      grantedSeconds: 300,
      nowMs: 10_000,
    });

    expect(window).toEqual({
      valid: true,
      interviewEndsAtMs: 301_000,
      tokenExpiresAtMs: 421_000,
      newSessionExpiresAtMs: 130_000,
    });
  });

  it("caps a late connection window at the paid interview end", () => {
    const window = getLiveTokenWindow({
      startedAtMs: 1_000,
      grantedSeconds: 300,
      nowMs: 290_000,
    });

    expect(window.valid).toBe(true);
    if (window.valid) expect(window.newSessionExpiresAtMs).toBe(301_000);
  });

  it("rejects minting at or after the interview deadline", () => {
    expect(
      getLiveTokenWindow({ startedAtMs: 1_000, grantedSeconds: 300, nowMs: 301_000 })
    ).toEqual({ valid: false });
  });

  it("rejects malformed stored grants and timestamps", () => {
    expect(
      getLiveTokenWindow({ startedAtMs: Number.NaN, grantedSeconds: 300, nowMs: 1 })
    ).toEqual({ valid: false });
    expect(
      getLiveTokenWindow({ startedAtMs: 1, grantedSeconds: 0, nowMs: 1 })
    ).toEqual({ valid: false });
  });
});
