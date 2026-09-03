import { describe, it, expect } from "vitest";

import {
  PLANS,
  allowedSessionLengths,
  checkInterviewQuota,
  clampSessionMinutes,
  formatPrice,
  getPlan,
  isSessionLengthAllowed,
} from "./plans";

describe("pricing is a product decision, not an implementation detail", () => {
  it("keeps the published prices exactly", () => {
    expect(PLANS.starter.priceInr).toBe(0);
    expect(PLANS.accelerator.priceInr).toBe(249);
    expect(PLANS.pro.priceInr).toBe(499);
    expect(PLANS.mastery.priceInr).toBe(749);
  });

  it("keeps the published plan names", () => {
    expect(PLANS.starter.name).toBe("Starter");
    expect(PLANS.accelerator.name).toBe("Accelerator");
    expect(PLANS.pro.name).toBe("Pro Achiever");
    expect(PLANS.mastery.name).toBe("Interview Mastery");
  });

  it("keeps the published interview counts and session lengths", () => {
    expect(PLANS.starter.interviewsPerMonth).toBe(2);
    expect(PLANS.starter.maxSessionMinutes).toBe(5);

    expect(PLANS.accelerator.interviewsPerMonth).toBe(5);
    expect(PLANS.accelerator.maxSessionMinutes).toBe(10);

    expect(PLANS.pro.interviewsPerMonth).toBe(15);
    expect(PLANS.pro.maxSessionMinutes).toBe(15);

    expect(PLANS.mastery.interviewsPerMonth).toBeNull(); // unlimited
    expect(PLANS.mastery.maxSessionMinutes).toBe(15);
  });

  it("renders prices in rupees", () => {
    expect(formatPrice(PLANS.starter)).toBe("Free");
    expect(formatPrice(PLANS.accelerator)).toBe("₹249/month");
    expect(formatPrice(PLANS.pro)).toBe("₹499/month");
    expect(formatPrice(PLANS.mastery)).toBe("₹749/month");
  });
});

describe("session length is gated by plan", () => {
  it("offers only 5 minutes on Starter", () => {
    expect(allowedSessionLengths("starter")).toEqual([5]);
    expect(isSessionLengthAllowed("starter", 10)).toBe(false);
    expect(isSessionLengthAllowed("starter", 15)).toBe(false);
  });

  it("offers 5 and 10 on Accelerator", () => {
    expect(allowedSessionLengths("accelerator")).toEqual([5, 10]);
    expect(isSessionLengthAllowed("accelerator", 15)).toBe(false);
  });

  it("offers all three on Pro and Mastery", () => {
    expect(allowedSessionLengths("pro")).toEqual([5, 10, 15]);
    expect(allowedSessionLengths("mastery")).toEqual([5, 10, 15]);
  });

  it("clamps a request that exceeds the plan instead of failing", () => {
    // A stale tab asking for 15 on the free plan gets a valid 5.
    expect(clampSessionMinutes("starter", 15)).toBe(5);
    expect(clampSessionMinutes("accelerator", 15)).toBe(10);
    expect(clampSessionMinutes("pro", 15)).toBe(15);
  });

  it("never returns an unpublished session length", () => {
    expect(clampSessionMinutes("pro", 7)).toBe(5);
    expect(clampSessionMinutes("pro", 12)).toBe(10);
  });

  it("falls back to the smallest length for nonsense input", () => {
    expect(clampSessionMinutes("pro", 0)).toBe(5);
    expect(clampSessionMinutes("pro", -30)).toBe(5);
    expect(clampSessionMinutes("pro", Number.NaN)).toBe(5);
  });

  it("treats an unknown or missing plan as Starter", () => {
    expect(getPlan(undefined).id).toBe("starter");
    expect(getPlan("enterprise-gold").id).toBe("starter");
    expect(clampSessionMinutes("not-a-plan", 15)).toBe(5);
  });
});

describe("interview quota is counted per session, never per question", () => {
  it("allows up to the limit and then stops", () => {
    expect(checkInterviewQuota("starter", 0).allowed).toBe(true);
    expect(checkInterviewQuota("starter", 1).allowed).toBe(true);
    expect(checkInterviewQuota("starter", 2).allowed).toBe(false);
  });

  it("reports what is left", () => {
    const q = checkInterviewQuota("accelerator", 3);
    expect(q.limit).toBe(5);
    expect(q.used).toBe(3);
    expect(q.remaining).toBe(2);
  });

  it("explains why it refused", () => {
    const q = checkInterviewQuota("starter", 2);
    expect(q.allowed).toBe(false);
    expect(q.reason).toContain("Starter");
  });

  it("never refuses on an unlimited plan", () => {
    const q = checkInterviewQuota("mastery", 9999);
    expect(q.allowed).toBe(true);
    expect(q.limit).toBeNull();
    expect(q.remaining).toBeNull();
  });

  it("counts sessions, so a long interview costs the same as a short one", () => {
    // Two sessions is two, whether they held 3 questions or 30.
    expect(checkInterviewQuota("starter", 2).allowed).toBe(false);
    expect(checkInterviewQuota("starter", 1).remaining).toBe(1);
  });
});
