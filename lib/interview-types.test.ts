import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERVIEW_TYPE,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_DEFINITIONS,
  UNIVERSAL_INTERVIEW_RULES,
  getInterviewTypeDefinition,
  resolveInterviewType,
  usesRoleSelection,
} from "@/lib/interview-types";

describe("resolveInterviewType", () => {
  it("accepts every known type", () => {
    for (const type of INTERVIEW_TYPES) {
      expect(resolveInterviewType(type)).toBe(type);
    }
  });

  /**
   * This is the backward-compatibility rule. Interviews written before the field
   * existed carry no `interviewType`, and every one of them was a role-based
   * technical interview -- so an absent value has to resolve to "technical"
   * rather than throwing or rendering as something else.
   */
  it("treats a missing or unknown value as a technical interview", () => {
    expect(resolveInterviewType(undefined)).toBe(DEFAULT_INTERVIEW_TYPE);
    expect(resolveInterviewType(null)).toBe(DEFAULT_INTERVIEW_TYPE);
    expect(resolveInterviewType("")).toBe(DEFAULT_INTERVIEW_TYPE);
    expect(resolveInterviewType("something-else")).toBe(DEFAULT_INTERVIEW_TYPE);
    expect(resolveInterviewType(42)).toBe(DEFAULT_INTERVIEW_TYPE);
    expect(resolveInterviewType({})).toBe(DEFAULT_INTERVIEW_TYPE);
  });
});

describe("definitions", () => {
  it("every type has a complete definition", () => {
    for (const type of INTERVIEW_TYPES) {
      const definition = INTERVIEW_TYPE_DEFINITIONS[type];
      expect(definition.id).toBe(type);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.tagline.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(20);
      expect(definition.iconKey.length).toBeGreaterThan(0);
      expect(definition.cardLabel.length).toBeGreaterThan(0);
    }
  });

  it("resolves a definition for an unknown value rather than returning undefined", () => {
    expect(getInterviewTypeDefinition("nonsense").id).toBe(DEFAULT_INTERVIEW_TYPE);
  });

  it("gives each type a distinct icon", () => {
    const keys = INTERVIEW_TYPES.map((t) => INTERVIEW_TYPE_DEFINITIONS[t].iconKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not promise a real-world outcome anywhere in the copy", () => {
    for (const type of INTERVIEW_TYPES) {
      const definition = INTERVIEW_TYPE_DEFINITIONS[type];
      const copy = `${definition.tagline} ${definition.description}`;
      expect(copy).not.toMatch(/guarantee|will be approved|will be rejected|will pass/i);
    }
  });
});

describe("usesRoleSelection", () => {
  it("is true for the role-based types and false for visa", () => {
    expect(usesRoleSelection("technical")).toBe(true);
    expect(usesRoleSelection("communication")).toBe(true);
    expect(usesRoleSelection("visa")).toBe(false);
  });
});

/**
 * These rules are appended to every system instruction rather than retyped per
 * type, so that a category added later cannot quietly omit one of them.
 */
describe("UNIVERSAL_INTERVIEW_RULES", () => {
  it("forbids claiming a real-world outcome", () => {
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/never state or imply a real-world outcome/i);
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/approvals, rejections/i);
  });

  it("states that the session is time-based and that the model cannot end it", () => {
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/TIME-BASED/);
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/never when you run out of questions/i);
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/cannot end it yourself/i);
  });

  it("disclaims representing any real organisation", () => {
    expect(UNIVERSAL_INTERVIEW_RULES).toMatch(/government, embassy or consulate/i);
  });
});
