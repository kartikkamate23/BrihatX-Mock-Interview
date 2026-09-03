import { describe, expect, it } from "vitest";

import {
  ALL_TOPICS,
  DEFAULT_INTERVIEWER_ID,
  EXPERIENCE_LEVELS,
  INTERVIEWERS,
  MAX_TOPICS,
  getExperienceLevel,
  getInterviewer,
  normaliseTopics,
  topicsToTechstack,
  validateSetup,
} from "@/lib/interview-config";

const validSetup = {
  role: "Software Engineer",
  topics: ["System Design"],
  experienceLevel: "intermediate",
  interviewerId: "tanya",
  durationMinutes: 10,
};

describe("interviewers", () => {
  it("all have a distinct id and a Live API voice", () => {
    const ids = new Set(INTERVIEWERS.map((i) => i.id));
    expect(ids.size).toBe(INTERVIEWERS.length);
    for (const interviewer of INTERVIEWERS) {
      expect(interviewer.voiceName).toMatch(/^[A-Z][A-Za-z]+$/);
    }
  });

  it("falls back to the default rather than returning undefined", () => {
    expect(getInterviewer("does-not-exist").id).toBe(DEFAULT_INTERVIEWER_ID);
    expect(getInterviewer(undefined).id).toBe(DEFAULT_INTERVIEWER_ID);
  });
});

describe("experience levels", () => {
  it("each carry guidance the prompt can use", () => {
    for (const level of EXPERIENCE_LEVELS) {
      expect(level.guidance.length).toBeGreaterThan(30);
    }
  });

  it("falls back for an unknown id", () => {
    expect(getExperienceLevel("nonsense").id).toBe("intermediate");
  });
});

describe("normaliseTopics", () => {
  it("trims, de-duplicates case-insensitively, and caps the count", () => {
    expect(normaliseTopics(["  React ", "react", "React"])).toEqual(["React"]);
    expect(normaliseTopics(Array(20).fill(0).map((_, i) => `Topic ${i}`)).length).toBe(
      MAX_TOPICS
    );
  });

  it("drops empty entries", () => {
    expect(normaliseTopics(["", "   ", "React"])).toEqual(["React"]);
  });

  it("collapses internal whitespace", () => {
    expect(normaliseTopics(["System    Design"])).toEqual(["System Design"]);
  });
});

describe("topicsToTechstack", () => {
  it("produces lowercase tags the existing dashboard can render", () => {
    expect(topicsToTechstack(["JavaScript & TypeScript"])).toEqual([
      "javascript and typescript",
    ]);
  });

  it("keeps every catalogue topic convertible without throwing", () => {
    expect(topicsToTechstack(ALL_TOPICS.slice(0, MAX_TOPICS)).length).toBe(MAX_TOPICS);
  });
});

describe("validateSetup", () => {
  it("accepts a complete setup", () => {
    expect(validateSetup(validSetup, { termsAccepted: true }).valid).toBe(true);
  });

  it("rejects a missing or too-short role", () => {
    expect(validateSetup({ ...validSetup, role: "" }).errors.role).toBeDefined();
    expect(validateSetup({ ...validSetup, role: "a" }).errors.role).toBeDefined();
  });

  it("rejects no topics and too many topics", () => {
    expect(validateSetup({ ...validSetup, topics: [] }).errors.topics).toBeDefined();
    expect(
      validateSetup({ ...validSetup, topics: Array(MAX_TOPICS + 1).fill("x") }).errors
        .topics
    ).toBeDefined();
  });

  it("rejects an unknown experience level or interviewer", () => {
    expect(
      validateSetup({ ...validSetup, experienceLevel: "wizard" }).errors
        .experienceLevel
    ).toBeDefined();
    expect(
      validateSetup({ ...validSetup, interviewerId: "nobody" }).errors.interviewerId
    ).toBeDefined();
  });

  it("requires the terms only when they are being checked", () => {
    // The wizard passes termsAccepted; intermediate steps do not, and must not
    // be blocked by a box the candidate has not reached yet.
    expect(validateSetup(validSetup).errors.terms).toBeUndefined();
    expect(validateSetup(validSetup, { termsAccepted: false }).errors.terms).toBeDefined();
  });

  it("rejects a missing duration", () => {
    expect(
      validateSetup({ ...validSetup, durationMinutes: 0 }).errors.durationMinutes
    ).toBeDefined();
  });
});
