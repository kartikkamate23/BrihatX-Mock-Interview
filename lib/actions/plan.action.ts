"use server";

import { db, FirebaseAdminNotConfiguredError } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  allowedSessionLengths,
  checkInterviewQuota,
  getPlan,
  type PlanId,
} from "@/lib/plans";
import { errorMessage, errorNumericCode } from "@/lib/errors";
import { startInterviewSession } from "@/lib/actions/session.action";

/** First instant of the current calendar month, UTC. */
function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Sessions started by this user in the current period.
 *
 * Counted from Firestore rather than anything the browser holds, which is the
 * whole point: a refresh, a second tab, or an edited localStorage value cannot
 * change a number the client never owns.
 */
async function countSessionsThisPeriod(userId: string): Promise<number> {
  const since = periodStart().toISOString();
  try {
    const snap = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .where("startedAt", ">=", since)
      .get();
    return snap.size;
  } catch (error) {
    // A missing composite index must not hand out free interviews, but it must
    // not lock everyone out either. Fall back to an unindexed read.
    if (errorNumericCode(error) === 9 && /index/i.test(errorMessage(error))) {
      const snap = await db.collection("sessions").where("userId", "==", userId).get();
      return snap.docs.filter((d) => String(d.data().startedAt ?? "") >= since).length;
    }
    throw error;
  }
}

export interface InterviewAccess {
  planId: PlanId;
  planName: string;
  allowedMinutes: number[];
  used: number;
  limit: number | null;
  remaining: number | null;
  canStart: boolean;
  reason?: string;
}

/** What the current user may do right now. Drives the duration selector. */
export async function getInterviewAccess(): Promise<InterviewAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const plan = getPlan(user.plan);

  try {
    const used = await countSessionsThisPeriod(user.id);
    const quota = checkInterviewQuota(plan.id, used);
    return {
      planId: plan.id,
      planName: plan.name,
      allowedMinutes: allowedSessionLengths(plan.id),
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      canStart: quota.allowed,
      reason: quota.reason,
    };
  } catch (error) {
    console.error("[PLAN] could not read interview quota:", error);
    if (error instanceof FirebaseAdminNotConfiguredError) return null;
    // Do not strand a paying user because a read failed; the authorize step
    // below still gates the actual start.
    return {
      planId: plan.id,
      planName: plan.name,
      allowedMinutes: allowedSessionLengths(plan.id),
      used: 0,
      limit: plan.interviewsPerMonth,
      remaining: plan.interviewsPerMonth,
      canStart: true,
    };
  }
}

export interface SessionAuthorization {
  allowed: boolean;
  /** The length the interview may actually run. Never longer than the plan. */
  durationSeconds: number;
  planName: string;
  remaining: number | null;
  sessionId?: string;
  reason?: string;
}

/**
 * Server-side gate for starting an interview.
 *
 * Returns the authoritative duration rather than trusting the number the client
 * asked for, and records the session so it counts against the quota. The client
 * cannot grant itself a longer interview or a extra session by editing state,
 * because both values come back from here.
 */
export async function authorizeInterviewSession(params: {
  interviewId: string;
  requestedMinutes: number;
}): Promise<SessionAuthorization> {
  // Keep this legacy entry point, but route it through the single transactional
  // gate. The previous implementation performed a count and a write separately,
  // allowing two tabs to spend the final credit at the same time, and trusted an
  // interview id without checking whether the caller could use it.
  const result = await startInterviewSession({ interviewId: params.interviewId });
  return {
    allowed: result.allowed,
    durationSeconds: result.durationSeconds ?? 0,
    planName: result.planName ?? "",
    remaining: result.remaining ?? null,
    sessionId: result.sessionId,
    reason: result.reason,
  };
}
