import { describe, expect, it } from "vitest";

import { iconKeyForInterview, iconKeyForNewInterview } from "@/lib/icons";
import { getRoleCategory } from "@/lib/roles";

/**
 * The property under test is stability.
 *
 * The previous implementation picked a company logo with `Math.random()` inside
 * the card's render, so the same interview showed a different brand on every
 * render and every refresh. These assert that the icon is a pure function of the
 * stored record -- which is the only way "the same interview always looks the
 * same" can be true.
 */
describe("iconKeyForInterview", () => {
  it("returns the same key every time for the same record", () => {
    const interview = { interviewType: "technical", role: "Data Scientist" };
    const keys = new Set(Array.from({ length: 50 }, () => iconKeyForInterview(interview)));
    expect(keys.size).toBe(1);
  });

  it("prefers the stored iconKey over anything derived", () => {
    // An interview keeps the identity it was created with even if the taxonomy
    // is later reorganised underneath it.
    expect(
      iconKeyForInterview({
        iconKey: "shield",
        interviewType: "technical",
        role: "Data Scientist",
      })
    ).toBe("shield");
  });

  it("falls back to the stored role category when there is no iconKey", () => {
    expect(
      iconKeyForInterview({ interviewType: "technical", roleCategory: "cloud-devops" })
    ).toBe(getRoleCategory("cloud-devops").iconKey);
  });

  /**
   * Interviews saved under the previous taxonomy carry its category ids. They
   * must keep resolving to a sensible icon, or every old card on the dashboard
   * silently changes appearance.
   */
  it("resolves legacy category ids from older records", () => {
    expect(
      iconKeyForInterview({ interviewType: "technical", roleCategory: "software-development" })
    ).toBe("code");
    expect(
      iconKeyForInterview({ interviewType: "technical", roleCategory: "qa-testing" })
    ).toBe("test");
    expect(
      iconKeyForInterview({ interviewType: "technical", roleCategory: "data-ai" })
    ).toBe("chart");
  });

  it("derives from the role name when that is all the record has", () => {
    // This is the shape of every interview written before these fields existed.
    expect(iconKeyForInterview({ role: "DevOps Engineer" })).toBe("cloud");
    expect(iconKeyForInterview({ role: "Penetration Tester" })).toBe("shield");
    // Data Scientist resolves to the Data icon, not the AI one. AI is now its
    // own category rather than being folded in with analytics, so `brain` is
    // reserved for roles that are actually about models.
    expect(iconKeyForInterview({ role: "Data Scientist" })).toBe("chart");
    expect(iconKeyForInterview({ role: "Machine Learning Engineer" })).toBe("brain");
    expect(iconKeyForInterview({ role: "Generative AI Engineer" })).toBe("brain");
  });

  it("gives visa interviews the visa identity, never a role icon", () => {
    expect(iconKeyForInterview({ interviewType: "visa", role: "F1 Student Visa" })).toBe(
      "globe"
    );
    // Even if a stray role field survived on the record.
    expect(
      iconKeyForInterview({ interviewType: "visa", role: "Software Engineer" })
    ).toBe("globe");
  });

  it("gives communication practice its own identity", () => {
    expect(
      iconKeyForInterview({ interviewType: "communication", role: "Product Manager" })
    ).toBe("message");
  });

  it("resolves an empty record rather than throwing", () => {
    expect(typeof iconKeyForInterview({})).toBe("string");
    expect(iconKeyForInterview({}).length).toBeGreaterThan(0);
  });

  it("ignores blank strings rather than treating them as a choice", () => {
    expect(iconKeyForInterview({ iconKey: "   ", role: "DevOps Engineer" })).toBe("cloud");
    expect(iconKeyForInterview({ roleCategory: "  ", role: "Data Scientist" })).toBe("chart");
  });

  it("falls back for a role nobody anticipated", () => {
    // A custom role must still get a stable, sensible icon.
    const key = iconKeyForInterview({ role: "Underwater Basket Weaver" });
    expect(key).toBe(getRoleCategory("other").iconKey);
    expect(iconKeyForInterview({ role: "Underwater Basket Weaver" })).toBe(key);
  });
});

describe("iconKeyForNewInterview", () => {
  it("resolves the key to store at creation", () => {
    expect(iconKeyForNewInterview({ interviewType: "visa" })).toBe("globe");
    expect(
      iconKeyForNewInterview({ interviewType: "technical", role: "QA Engineer" })
    ).toBe("test");
  });

  it("round-trips: what is stored is what is later read back", () => {
    const stored = iconKeyForNewInterview({
      interviewType: "technical",
      role: "Machine Learning Engineer",
    });
    expect(iconKeyForInterview({ iconKey: stored })).toBe(stored);
  });
});
