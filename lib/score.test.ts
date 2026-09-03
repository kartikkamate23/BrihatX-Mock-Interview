import { describe, expect, it } from "vitest";

import { averageScore, clampScore, scoreBand } from "./score";

describe("clampScore", () => {
  it("rounds to a whole score", () => {
    expect(clampScore(72.4)).toBe(72);
    expect(clampScore(72.6)).toBe(73);
  });

  it("holds the 0-100 range against anything the model returns", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe("scoreBand", () => {
  it("bands the range", () => {
    expect(scoreBand(92).tone).toBe("strong");
    expect(scoreBand(70).tone).toBe("solid");
    expect(scoreBand(50).tone).toBe("fair");
    expect(scoreBand(20).tone).toBe("weak");
  });

  it("puts each boundary in the higher band", () => {
    expect(scoreBand(80).tone).toBe("strong");
    expect(scoreBand(79).tone).toBe("solid");
    expect(scoreBand(65).tone).toBe("solid");
    expect(scoreBand(64).tone).toBe("fair");
    expect(scoreBand(45).tone).toBe("fair");
    expect(scoreBand(44).tone).toBe("weak");
  });

  it("does not flatter the middle of the range", () => {
    // 55/100 in a real interview is not a pass, and the label must not imply it.
    expect(scoreBand(55).label).toBe("Developing");
  });

  it("bands out-of-range input rather than throwing", () => {
    expect(scoreBand(1000).tone).toBe("strong");
    expect(scoreBand(Number.NaN).tone).toBe("weak");
  });

  it("carries a colour for every surface a score is drawn on", () => {
    const band = scoreBand(90);
    expect(band.text).toMatch(/^text-/);
    expect(band.fill).toMatch(/^bg-/);
    // SVG strokes cannot use a Tailwind background class.
    expect(band.stroke).toMatch(/^var\(--color-/);
  });
});

describe("averageScore", () => {
  it("averages the scores that exist", () => {
    expect(averageScore([80, 90, 70])).toBe(80);
  });

  it("ignores interviews that were never scored", () => {
    // Counting an unsat interview as zero would drop someone's average every
    // time they set one up.
    expect(averageScore([80, undefined, 90])).toBe(85);
  });

  it("is null when nothing has been scored", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([undefined, undefined])).toBeNull();
  });

  it("rounds the result", () => {
    expect(averageScore([80, 85])).toBe(83);
  });
});
