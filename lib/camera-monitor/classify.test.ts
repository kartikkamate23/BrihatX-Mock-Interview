import { describe, expect, it } from "vitest";

import { classifyObservation } from "./classify";

const base = {
  atMs: 0,
  camera: "ready" as const,
  faceCount: 1,
  luminance: 120,
  attentive: true,
  confidence: 0.9,
  faceBox: { minX: 0.35, minY: 0.2, maxX: 0.65, maxY: 0.75 },
};

describe("strict camera observation classification", () => {
  it("accepts one centered, attentive face", () => {
    expect(classifyObservation(base).state).toBe("FACE_OK");
  });

  it("prioritizes multiple-face detection", () => {
    expect(classifyObservation({ ...base, faceCount: 2, attentive: false }).state)
      .toBe("MULTIPLE_FACES");
  });

  it("reports a missing face independently of gaze", () => {
    expect(classifyObservation({ ...base, faceCount: 0 }).state).toBe("NO_FACE");
  });

  it("reports eyes or head directed away", () => {
    expect(classifyObservation({ ...base, attentive: false }).state).toBe("HEAD_TURNED");
  });

  it("reports a face outside the framing guide", () => {
    expect(classifyObservation({
      ...base,
      faceBox: { minX: 0.01, minY: 0.2, maxX: 0.31, maxY: 0.75 },
    }).state).toBe("FACE_OFF_CENTER");
  });

  it("reports poor visibility before accepting a detected face", () => {
    expect(classifyObservation({ ...base, luminance: 8 }).state).toBe("POOR_VISIBILITY");
  });
});
