import { describe, it, expect } from "vitest";

import {
  evaluateGaze,
  gazeOffset,
  headAnglesFromMatrix,
} from "./gaze";

/** Column-major 4x4 with a yaw rotation about Y, as MediaPipe returns. */
function yawMatrix(deg: number): number[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // prettier-ignore
  return [
     c, 0, -s, 0,
     0, 1,  0, 0,
     s, 0,  c, 0,
     0, 0,  0, 1,
  ];
}

describe("head angles", () => {
  it("reads a forward-facing head as roughly zero", () => {
    const a = headAnglesFromMatrix(yawMatrix(0));
    expect(a).not.toBeNull();
    expect(Math.abs(a!.yawDeg)).toBeLessThan(1);
  });

  it("reads a turned head", () => {
    const a = headAnglesFromMatrix(yawMatrix(40));
    expect(Math.abs(a!.yawDeg)).toBeGreaterThan(30);
  });

  it("returns null for a malformed matrix", () => {
    expect(headAnglesFromMatrix([1, 2, 3])).toBeNull();
  });
});

describe("gaze offset", () => {
  it("is near zero when the eyes are centred", () => {
    expect(gazeOffset({})).toBe(0);
  });

  it("rises when both eyes look the same way", () => {
    const offset = gazeOffset({ eyeLookOutLeft: 0.9, eyeLookInRight: 0.9 });
    expect(offset).toBeGreaterThan(0.4);
  });

  it("does not double-count one sideways glance", () => {
    // Looking right lights "out" on one eye and "in" on the other; that is one
    // glance, so the score must stay within range rather than summing to ~2.
    const offset = gazeOffset({ eyeLookOutLeft: 1, eyeLookInRight: 1 });
    expect(offset).toBeLessThanOrEqual(1);
  });
});

describe("attention reading", () => {
  it("counts a forward face with centred eyes as attentive", () => {
    const s = evaluateGaze({
      faceDetected: true,
      matrix: yawMatrix(0),
      blendshapes: {},
    });
    expect(s.attentive).toBe(true);
    expect(s.confidence).toBeGreaterThan(0.5);
  });

  it("counts a strongly turned head as not attentive", () => {
    const s = evaluateGaze({
      faceDetected: true,
      matrix: yawMatrix(55),
      blendshapes: {},
    });
    expect(s.attentive).toBe(false);
  });

  it("tolerates a small natural head shift", () => {
    const s = evaluateGaze({
      faceDetected: true,
      matrix: yawMatrix(12),
      blendshapes: {},
    });
    expect(s.attentive).toBe(true);
  });

  it("counts eyes looking far off-centre as not attentive", () => {
    const s = evaluateGaze({
      faceDetected: true,
      matrix: yawMatrix(0),
      blendshapes: { eyeLookOutLeft: 1, eyeLookInRight: 1 },
    });
    expect(s.attentive).toBe(false);
  });

  it("reports no face as zero confidence, NOT as looking away", () => {
    // The tracker must be free to apply its grace period rather than treating a
    // dropped detection as evidence of inattention.
    const s = evaluateGaze({ faceDetected: false });
    expect(s.confidence).toBe(0);
  });
});
