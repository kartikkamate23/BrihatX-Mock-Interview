import { describe, expect, it } from "vitest";

import {
  CUSTOM_VISA_CATEGORY_ID,
  DEFAULT_VISA_CATEGORY_ID,
  DEFAULT_VISA_MODE_ID,
  VISA_CATEGORIES,
  VISA_MODES,
  type VisaSetup,
  getVisaCategory,
  getVisaMode,
  resolveVisaTypeLabel,
  validateVisaSetup,
  visaTopicsFor,
} from "@/lib/visa";

/** A setup that must always pass, so a failing case proves what it changed. */
const validSetup: VisaSetup = {
  visaTypeId: "f1-student",
  visaModeId: "standard",
  destination: "United States",
  details: { university: "Stanford", course: "MS Computer Science" },
};

describe("visa categories", () => {
  it("have unique kebab-case ids, since they are persisted as visaType", () => {
    const ids = VISA_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("each carry a focus substantial enough to steer the prompt", () => {
    for (const category of VISA_CATEGORIES) {
      expect(category.focus.trim().length).toBeGreaterThan(60);
      expect(category.label.trim()).not.toBe("");
      expect(category.shortLabel.trim()).not.toBe("");
      expect(category.description.trim()).not.toBe("");
    }
  });

  it("always collect the destination, and never list a detail field twice", () => {
    for (const category of VISA_CATEGORIES) {
      expect(category.detailFields).toContain("destination");
      expect(new Set(category.detailFields).size).toBe(category.detailFields.length);
    }
  });

  it("give each category a focus of its own rather than one shared blurb", () => {
    const focuses = VISA_CATEGORIES.map((c) => c.focus);
    expect(new Set(focuses).size).toBe(focuses.length);
  });

  it("include the custom category and the default category", () => {
    expect(VISA_CATEGORIES.some((c) => c.id === CUSTOM_VISA_CATEGORY_ID)).toBe(true);
    expect(VISA_CATEGORIES.some((c) => c.id === DEFAULT_VISA_CATEGORY_ID)).toBe(true);
  });

  it("collect the fields each category actually needs", () => {
    expect(getVisaCategory("f1-student").detailFields).toEqual(
      expect.arrayContaining(["university", "course", "sponsor", "duration"])
    );
    expect(getVisaCategory("h1b-work").detailFields).toEqual(
      expect.arrayContaining(["employer", "jobTitle", "duration"])
    );
    expect(getVisaCategory("h4-dependent").detailFields).toEqual(
      expect.arrayContaining(["relationship", "duration"])
    );
    // A dependent visa has no course or employer of its own to ask about.
    expect(getVisaCategory("h4-dependent").detailFields).not.toContain("course");
  });
});

describe("visa modes", () => {
  it("have unique kebab-case ids, since they are persisted as visaMode", () => {
    const ids = VISA_MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("allow in-interview coaching in exactly one mode, custom-practice", () => {
    const coaching = VISA_MODES.filter((m) => m.allowsCoaching);
    expect(coaching).toHaveLength(1);
    expect(coaching[0].id).toBe("custom-practice");
  });

  it("describe a questioning style long enough to be worth sending", () => {
    for (const mode of VISA_MODES) {
      expect(mode.behaviour.trim().length).toBeGreaterThan(80);
    }
  });

  /**
   * The product safety rule, enforced. This is a practice simulation and must
   * never imply it can predict a real visa outcome, so no mode may tell the
   * model to approve, refuse or promise anything.
   */
  it("never use outcome language in the behaviour sent to the model", () => {
    for (const mode of VISA_MODES) {
      expect(mode.behaviour).not.toMatch(/approv|reject|denied|guarantee/i);
    }
  });
});

describe("getVisaCategory / getVisaMode", () => {
  it("fall back to the default instead of returning undefined", () => {
    expect(getVisaCategory("no-such-visa").id).toBe(DEFAULT_VISA_CATEGORY_ID);
    expect(getVisaCategory(undefined).id).toBe(DEFAULT_VISA_CATEGORY_ID);
    expect(getVisaCategory(null).id).toBe(DEFAULT_VISA_CATEGORY_ID);
    expect(getVisaMode("no-such-mode").id).toBe(DEFAULT_VISA_MODE_ID);
    expect(getVisaMode(undefined).id).toBe(DEFAULT_VISA_MODE_ID);
    expect(getVisaMode(null).id).toBe(DEFAULT_VISA_MODE_ID);
  });

  it("return the requested entry when the id is known", () => {
    expect(getVisaCategory("tourist").shortLabel).toBe("Tourist");
    expect(getVisaMode("strict").label).toBe("Strict Visa Officer");
  });
});

describe("resolveVisaTypeLabel", () => {
  it("uses the catalogue label for a known category", () => {
    expect(resolveVisaTypeLabel({ visaTypeId: "f1-student" })).toBe("F1 Student Visa");
    // Custom text is ignored unless the category actually is the custom one.
    expect(
      resolveVisaTypeLabel({ visaTypeId: "tourist", customVisaType: "Ignore me" })
    ).toBe("Tourist / Visitor Visa");
  });

  it("uses the trimmed custom text for the custom category", () => {
    expect(
      resolveVisaTypeLabel({
        visaTypeId: CUSTOM_VISA_CATEGORY_ID,
        customVisaType: "  Schengen Work Permit  ",
      })
    ).toBe("Schengen Work Permit");
  });

  it("degrades to a sensible label when the custom text is blank", () => {
    // Reached only via old or malformed documents, but it must never emit an
    // empty string into the prompt.
    for (const custom of [undefined, "", "   "]) {
      const label = resolveVisaTypeLabel({
        visaTypeId: CUSTOM_VISA_CATEGORY_ID,
        customVisaType: custom,
      });
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label).toBe("Other / Custom Visa");
    }
  });
});

describe("validateVisaSetup", () => {
  it("accepts a complete setup", () => {
    const result = validateVisaSetup(validSetup);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("rejects a missing or too-short destination", () => {
    expect(validateVisaSetup({ ...validSetup, destination: "" }).errors.destination)
      .toBeDefined();
    expect(validateVisaSetup({ ...validSetup, destination: "   " }).errors.destination)
      .toBeDefined();
    expect(validateVisaSetup({ ...validSetup, destination: "U" }).errors.destination)
      .toBeDefined();
    expect(
      validateVisaSetup({ ...validSetup, destination: "x".repeat(81) }).errors.destination
    ).toBeDefined();
  });

  it("requires customVisaType only for the custom category", () => {
    // Absent for a normal category: fine, the field is not even shown.
    expect(validateVisaSetup(validSetup).errors.customVisaType).toBeUndefined();

    const blankCustom = validateVisaSetup({
      ...validSetup,
      visaTypeId: CUSTOM_VISA_CATEGORY_ID,
    });
    expect(blankCustom.valid).toBe(false);
    expect(blankCustom.errors.customVisaType).toBeDefined();

    const filledCustom = validateVisaSetup({
      ...validSetup,
      visaTypeId: CUSTOM_VISA_CATEGORY_ID,
      customVisaType: "Digital Nomad Visa",
    });
    expect(filledCustom.valid).toBe(true);

    expect(
      validateVisaSetup({
        ...validSetup,
        visaTypeId: CUSTOM_VISA_CATEGORY_ID,
        customVisaType: "x".repeat(81),
      }).errors.customVisaType
    ).toBeDefined();
  });

  it("rejects unknown visa type and mode ids", () => {
    const badType = validateVisaSetup({ ...validSetup, visaTypeId: "made-up" });
    expect(badType.valid).toBe(false);
    expect(badType.errors.visaType).toBeDefined();
    // An unknown type must not also demand the custom text box be filled in.
    expect(badType.errors.customVisaType).toBeUndefined();

    const badMode = validateVisaSetup({ ...validSetup, visaModeId: "made-up" });
    expect(badMode.valid).toBe(false);
    expect(badMode.errors.visaMode).toBeDefined();

    expect(validateVisaSetup({}).valid).toBe(false);
  });

  it("raises a terms error only when acceptance is explicitly false", () => {
    // The wizard validates intermediate steps before the checkbox exists, so an
    // absent option must never look like a refusal.
    expect(validateVisaSetup(validSetup).errors.terms).toBeUndefined();
    expect(validateVisaSetup(validSetup, {}).errors.terms).toBeUndefined();
    expect(validateVisaSetup(validSetup, { termsAccepted: true }).errors.terms)
      .toBeUndefined();

    const refused = validateVisaSetup(validSetup, { termsAccepted: false });
    expect(refused.valid).toBe(false);
    expect(refused.errors.terms).toBeDefined();
  });
});

describe("visaTopicsFor", () => {
  it("covers different ground for a student visa than for a visitor visa", () => {
    const f1 = visaTopicsFor({ visaTypeId: "f1-student" });
    const b1b2 = visaTopicsFor({ visaTypeId: "b1-b2-visitor" });
    expect(f1).not.toEqual(b1b2);
    expect(f1).toContain("course/programme details");
    expect(b1b2).not.toContain("course/programme details");
    expect(b1b2).toContain("duration and itinerary");
  });

  it("returns a usable set for every category, including custom and unknown ids", () => {
    for (const category of VISA_CATEGORIES) {
      const topics = visaTopicsFor({ visaTypeId: category.id });
      expect(topics.length).toBeGreaterThan(0);
      expect(new Set(topics).size).toBe(topics.length);
    }
    expect(visaTopicsFor({ visaTypeId: CUSTOM_VISA_CATEGORY_ID }).length)
      .toBeGreaterThan(0);
    expect(visaTopicsFor({ visaTypeId: "not-a-category" }).length).toBeGreaterThan(0);
  });

  it("hands back a copy so a caller appending topics cannot edit the catalogue", () => {
    const first = visaTopicsFor({ visaTypeId: "f1-student" });
    first.push("mutated");
    expect(visaTopicsFor({ visaTypeId: "f1-student" })).not.toContain("mutated");
  });
});
