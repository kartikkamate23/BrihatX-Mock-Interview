/**
 * Plans, prices and limits. This module is the single source of truth: the
 * pricing page, the duration selector, and the server-side gate all read from
 * here, so they cannot drift apart.
 *
 * Prices are in INR and are product decisions, not implementation details. Do
 * not change them to satisfy a refactor.
 */

export type PlanId = "starter" | "accelerator" | "pro" | "mastery";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in rupees. 0 is free. */
  priceInr: number;
  /** Interviews per month. null means unlimited. */
  interviewsPerMonth: number | null;
  /** Longest single session, in minutes. */
  maxSessionMinutes: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceInr: 0,
    interviewsPerMonth: 2,
    maxSessionMinutes: 5,
    features: [
      "2 AI Mock Interviews",
      "Sessions up to 5 Min",
      "AI Mock Interviews",
      "English Communication Practice",
      "Basic Performance Score",
      "Quick Feedback Summary",
    ],
  },
  accelerator: {
    id: "accelerator",
    name: "Accelerator",
    priceInr: 249,
    interviewsPerMonth: 5,
    maxSessionMinutes: 10,
    features: [
      "5 AI Interviews",
      "Sessions up to 10 Min",
      "Real-Time AI Voice Interviews",
      "Role-Specific Interview Practice",
      "Mock Interviews + English Practice",
      "Personalized AI Feedback",
      "Detailed Feedback Report",
      "AI Practice Suggestions",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Achiever",
    priceInr: 499,
    interviewsPerMonth: 15,
    maxSessionMinutes: 15,
    features: [
      "15 AI Interviews",
      "Sessions up to 15 Min",
      "Real-Time AI Voice Interviews",
      "History-Backed Personalized Interviews",
      "Adaptive AI Follow-Up Questions",
      "Resume & JD-Based Interviews",
      "Question-Level AI Feedback",
      "Expected Answers & Improvement Tips",
      "Unlimited ATS Resume Checks",
      "AI-Powered Practice Recommendations",
    ],
  },
  mastery: {
    id: "mastery",
    name: "Interview Mastery",
    priceInr: 749,
    interviewsPerMonth: null,
    maxSessionMinutes: 15,
    features: [
      "Unlimited Interviews",
      "Sessions up to 15 Min",
      "Unlimited Personalized AI Interviews",
      "Real-Time AI Voice Interviews",
      "History-Backed Personalized Interviews",
      "Adaptive AI Follow-Up Questions",
      "Role, Resume & JD-Based Interviews",
      "Question-Level AI Feedback",
      "Expected Answers & Improvement Tips",
      "Unlimited ATS Resume Checks",
      "AI-Powered Practice Recommendations",
      "Priority AI Responses",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "accelerator", "pro", "mastery"];

export const DEFAULT_PLAN: PlanId = "starter";

/** Every session length the product offers, in minutes. */
export const SESSION_LENGTHS = [5, 10, 15] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export function getPlan(id: string | undefined | null): Plan {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS[DEFAULT_PLAN];
}

/** The lengths this plan may actually start. */
export function allowedSessionLengths(planId: string | undefined | null): number[] {
  const plan = getPlan(planId);
  return SESSION_LENGTHS.filter((m) => m <= plan.maxSessionMinutes);
}

export function isSessionLengthAllowed(
  planId: string | undefined | null,
  minutes: number
): boolean {
  return allowedSessionLengths(planId).includes(minutes);
}

/**
 * Clamps a requested length to what the plan allows.
 *
 * The server uses this rather than rejecting outright, so a stale tab that
 * still shows 15 minutes starts a valid 5-minute interview instead of failing.
 */
export function clampSessionMinutes(
  planId: string | undefined | null,
  requestedMinutes: number
): number {
  const allowed = allowedSessionLengths(planId);
  if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
    return Math.min(...allowed);
  }
  // Never manufacture a duration the product does not support. A forged
  // seven-minute request, for example, must resolve to the nearest offered
  // length below it rather than creating a seven-minute session.
  const requested = Math.floor(requestedMinutes);
  return Math.max(...allowed.filter((minutes) => minutes <= requested), Math.min(...allowed));
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  /** null when the plan is unlimited. */
  limit: number | null;
  remaining: number | null;
  reason?: string;
}

/**
 * Whether another interview may be started this period.
 *
 * Counting completed interviews server-side is what makes this real: refreshing,
 * opening another tab, or editing localStorage cannot change the count, because
 * the count is derived from Firestore documents the client cannot forge.
 */
export function checkInterviewQuota(
  planId: string | undefined | null,
  interviewsUsedThisPeriod: number
): QuotaCheck {
  const plan = getPlan(planId);
  const limit = plan.interviewsPerMonth;

  if (limit === null) {
    return { allowed: true, used: interviewsUsedThisPeriod, limit: null, remaining: null };
  }

  const remaining = Math.max(0, limit - interviewsUsedThisPeriod);
  return {
    allowed: interviewsUsedThisPeriod < limit,
    used: interviewsUsedThisPeriod,
    limit,
    remaining,
    reason:
      interviewsUsedThisPeriod < limit
        ? undefined
        : `You have used all ${limit} interviews on the ${plan.name} plan this month.`,
  };
}

export function formatPrice(plan: Plan): string {
  return plan.priceInr === 0 ? "Free" : `₹${plan.priceInr}/month`;
}
