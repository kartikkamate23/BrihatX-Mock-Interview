import { describe, expect, it } from "vitest";

import {
  extractMessage,
  isNormalClosure,
  normalizeVoiceError,
} from "@/lib/voice/errors";

/**
 * The behaviour these lock down is the one the previous architecture got wrong:
 * a session closing normally must never be reported as a failure, and a payload
 * that is not an Error must still produce a readable message rather than `{}`.
 */
describe("normalizeVoiceError", () => {
  it("treats a clean websocket close as the session ending, not an error", () => {
    const report = normalizeVoiceError({ code: 1000, reason: "", wasClean: true });
    expect(report.kind).toBe("closed");
    expect(report.fatal).toBe(false);
  });

  it("treats a going-away close as a normal closure too", () => {
    expect(isNormalClosure({ code: 1001, reason: "going away", wasClean: true })).toBe(
      true
    );
  });

  it("does not treat an abnormal close as normal", () => {
    const report = normalizeVoiceError({
      code: 1006,
      reason: "",
      wasClean: false,
    });
    expect(report.kind).not.toBe("closed");
    expect(report.retryable).toBe(true);
  });

  it("does not mistake a clean application-error close for normal shutdown", () => {
    const report = normalizeVoiceError({
      code: 4001,
      reason: "token expired",
      wasClean: true,
    });
    expect(report.kind).toBe("auth");
    expect(report.fatal).toBe(true);
  });

  it("recovers detail from an Error, whose fields are non-enumerable", () => {
    // JSON.stringify(new Error("boom")) is "{}" -- this is the exact shape that
    // used to print as an empty object in the console.
    const report = normalizeVoiceError(new Error("boom"));
    expect(JSON.stringify(report.detail)).toContain("boom");
  });

  it("never returns an empty message, whatever it is handed", () => {
    for (const value of [
      undefined,
      null,
      {},
      "",
      0,
      [],
      new Error(""),
      { error: {} },
    ]) {
      const report = normalizeVoiceError(value);
      expect(report.message.length).toBeGreaterThan(10);
    }
  });

  it("classifies a quota failure and does not advise retrying inside the session", () => {
    const report = normalizeVoiceError(
      new Error("429 RESOURCE_EXHAUSTED: You exceeded your current quota")
    );
    expect(report.kind).toBe("quota");
    expect(report.retryable).toBe(false);
    // The user gets one sentence, not several hundred characters of quota JSON.
    expect(report.message).not.toMatch(/RESOURCE_EXHAUSTED/);
  });

  it("classifies a rejected token as an auth problem without naming the credential", () => {
    const report = normalizeVoiceError({
      code: 1008,
      reason: "Request had invalid authentication credentials",
      wasClean: false,
    });
    expect(report.kind).toBe("auth");
    expect(report.message).not.toMatch(/api[_ ]?key/i);
  });

  it("classifies browser media refusals from the DOMException name", () => {
    expect(
      normalizeVoiceError({ name: "NotAllowedError", message: "Permission denied" })
        .kind
    ).toBe("permission");
    expect(normalizeVoiceError({ name: "NotFoundError", message: "" }).kind).toBe(
      "permission"
    );
    expect(
      normalizeVoiceError({ name: "NotReadableError", message: "" }).kind
    ).toBe("permission");
  });

  it("marks a dropped connection retryable", () => {
    const report = normalizeVoiceError(new Error("network timeout"));
    expect(report.kind).toBe("network");
    expect(report.retryable).toBe(true);
  });

  it("does not leak a stack trace into the user-facing message", () => {
    const error = new Error("internal failure");
    error.stack = "Error: internal failure\n    at processTicksAndRejections";
    expect(normalizeVoiceError(error).message).not.toMatch(/at process/);
  });
});

describe("extractMessage", () => {
  it("reads a plain string", () => {
    expect(extractMessage("just a string")).toBe("just a string");
  });

  it("reads a nested message two levels down", () => {
    expect(extractMessage({ error: { message: "deep failure" } })).toBe(
      "deep failure"
    );
  });

  it("reads a string cause when a transport does not provide message", () => {
    expect(extractMessage({ cause: "socket unavailable" })).toBe(
      "socket unavailable"
    );
  });

  it("prefers an explicit message over a reason", () => {
    expect(extractMessage({ message: "primary", reason: "secondary" })).toBe(
      "primary"
    );
  });

  it("returns undefined rather than an empty string", () => {
    expect(extractMessage({ message: "   " })).toBeUndefined();
    expect(extractMessage(42)).toBeUndefined();
  });
});
