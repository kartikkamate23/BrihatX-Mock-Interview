"use server";

import { FieldValue, type DocumentReference } from "firebase-admin/firestore";

import { db, FirebaseAdminNotConfiguredError } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { createFeedback } from "@/lib/actions/general.action";
import { errorMessage, errorNumericCode } from "@/lib/errors";
import {
  generateInterviewQuestions,
  isGeminiConfigured,
  GEMINI_CONFIG_MESSAGE,
  describeModelError,
  isModelAuthIssue,
} from "@/lib/ai";
import {
  getExperienceLevel,
  getInterviewer,
  normaliseTopics,
  topicsToTechstack,
  validateSetup,
} from "@/lib/interview-config";
import { iconKeyForNewInterview } from "@/lib/icons";
import {
  resolveInterviewType,
  type InterviewType,
} from "@/lib/interview-types";
import {
  categoryIdForRole,
  roleIdForRole,
  sanitiseRoleName,
  subcategoryForRole,
} from "@/lib/roles";
import {
  getVisaCategory,
  getVisaMode,
  resolveVisaTypeLabel,
  validateVisaSetup,
  visaTopicsFor,
} from "@/lib/visa";
import { checkInterviewQuota, clampSessionMinutes, getPlan } from "@/lib/plans";
import { describeResumeProfile, resumeProfileSchema } from "@/lib/resume/profile";
import type { EndReason } from "@/lib/voice/session-state";

/** First instant of the current calendar month, UTC. */
function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * A refresh, a double click, or a retried connect must not each cost a credit.
 * Within this window an unfinalised session for the same interview is treated as
 * the same attempt and reused. A genuine retake happens after the previous
 * session was finalised, so it falls outside this and is charged normally.
 */
const RESUME_WINDOW_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Creating an interview from the setup wizard
// ---------------------------------------------------------------------------

export interface CreateInterviewInput {
  /** Absent from older callers; treated as a technical interview. */
  interviewType?: InterviewType;
  durationMinutes: number;
  termsAccepted: boolean;

  // Role-based interviews (technical, communication).
  role?: string;
  topics?: string[];
  experienceLevel?: string;
  interviewerId?: string;

  // Resume interviews.
  resumeId?: string;
  resumeFileName?: string;

  // Visa interviews.
  visaTypeId?: string;
  customVisaType?: string;
  visaModeId?: string;
  destination?: string;
  visaDetails?: Record<string, string>;
}

export interface CreateInterviewResult {
  success: boolean;
  interviewId?: string;
  /** The length the plan actually allows, which may be shorter than requested. */
  durationSeconds?: number;
  message?: string;
}

/**
 * Writes the interview the wizard described.
 *
 * Everything the client sent is re-validated here. The wizard disables the
 * options a plan cannot use, but a disabled button is a courtesy, not a control:
 * the duration written to the document is the clamped one, computed from the
 * account's plan on the server.
 */
export async function createInterviewFromSetup(
  input: CreateInterviewInput
): Promise<CreateInterviewResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "You must be signed in to start an interview." };
  }

  const interviewType = resolveInterviewType(input.interviewType);
  const plan = getPlan(user.plan);
  // The plan is the ceiling regardless of what the wizard offered. Every
  // interview type goes through this same clamp -- there is no second credit
  // system and no per-type exemption.
  const minutes = clampSessionMinutes(plan.id, input.durationMinutes);

  const built =
    interviewType === "visa"
      ? buildVisaInterview(input)
      : await buildRoleInterview(input, interviewType, minutes, user.id);

  if ("error" in built) return { success: false, message: built.error };

  try {
    const ref = await db.collection("interviews").add({
      ...built.document,
      interviewType,
      durationSeconds: minutes * 60,
      userId: user.id,
      finalized: true,
      status: "ready",
      createdAt: new Date().toISOString(),
    });
    return { success: true, interviewId: ref.id, durationSeconds: minutes * 60 };
  } catch (error) {
    console.error("[SESSION] could not create interview:", error);
    if (error instanceof FirebaseAdminNotConfiguredError) {
      return {
        success: false,
        message:
          "The interview could not be saved: the server is missing Firebase Admin credentials.",
      };
    }
    if (isModelAuthIssue(error)) {
      return { success: false, message: describeModelError(error) };
    }
    return { success: false, message: "Could not build the interview. Please try again." };
  }
}

/** Everything a role-based interview needs written down. */
async function buildRoleInterview(
  input: CreateInterviewInput,
  interviewType: InterviewType,
  minutes: number,
  userId: string
): Promise<{ document: Record<string, unknown> } | { error: string }> {
  // A resume interview without a resume is just a generic interview with a
  // misleading label, so the reference is required and its ownership is checked
  // here -- a resumeId is a client-supplied value, and one belonging to another
  // account must never be readable through it.
  let resumeFields: Record<string, unknown> = {};
  if (interviewType === "resume") {
    if (!input.resumeId) {
      return { error: "Upload a resume before starting a resume-based interview." };
    }
    const snapshot = await db.collection("resumes").doc(input.resumeId).get();
    const resume = snapshot.data();
    if (!snapshot.exists || !resume || resume.userId !== userId) {
      return { error: "That resume could not be found. Please upload it again." };
    }
    resumeFields = {
      resumeId: input.resumeId,
      resumeFileName: String(resume.fileName ?? input.resumeFileName ?? "resume"),
    };
  }

  const topics = normaliseTopics(input.topics ?? []);
  const validation = validateSetup(
    {
      role: input.role,
      topics,
      experienceLevel: input.experienceLevel,
      interviewerId: input.interviewerId,
      durationMinutes: minutes,
    },
    { termsAccepted: input.termsAccepted }
  );
  if (!validation.valid) {
    return {
      error: Object.values(validation.errors)[0] ?? "That interview setup is not valid.",
    };
  }

  const level = getExperienceLevel(input.experienceLevel);
  const interviewer = getInterviewer(input.interviewerId);
  // Sanitised rather than merely trimmed: a custom role is free text that
  // reaches both a model prompt and a stored field.
  const role = sanitiseRoleName(input.role!);

  // Only the technical flow spends a model call here. The question list is a
  // seeded topic guide -- the live interviewer works from `topics` and follows
  // the conversation -- so generating one for a communication session would buy
  // nothing and burn a request against a daily quota that is not generous.
  let questions: string[] = topics;
  if (interviewType === "technical") {
    if (!isGeminiConfigured()) {
      console.error(GEMINI_CONFIG_MESSAGE);
      return { error: "Interview generation is unavailable: " + GEMINI_CONFIG_MESSAGE };
    }
    try {
      questions = await generateInterviewQuestions({
        role,
        level: level.label,
        techstack: topics.join(", "),
        type: topics.some((t) =>
          /behavioural|communication|teamwork|career|ownership/i.test(t)
        )
          ? "mixed"
          : "technical",
        amount: Math.max(5, Math.min(12, Math.round(minutes * 1.2))),
      });
    } catch (error) {
      console.error("[SESSION] question generation failed:", error);
      if (isModelAuthIssue(error)) return { error: describeModelError(error) };
      return { error: "Could not build the interview. Please try again." };
    }
  }

  const roleCategory = categoryIdForRole(role);
  const roleId = roleIdForRole(role);
  const roleSubcategory = subcategoryForRole(role);

  return {
    document: {
      role,
      // Written alongside the name, never instead of it: the name is what every
      // existing record and every heading already reads.
      ...(roleId ? { roleId } : {}),
      ...(roleSubcategory ? { roleSubcategory } : {}),
      // Only the id: the profile lives in its own document so one resume can
      // back several practice interviews without being duplicated into each.
      ...resumeFields,
      type:
        interviewType === "communication"
          ? "communication"
          : interviewType === "resume"
            ? "resume"
            : "mixed",
      level: level.id,
      levelLabel: level.label,
      topics,
      roleCategory,
      interviewerId: interviewer.id,
      interviewerName: interviewer.name,
      // Kept so the existing dashboard card and tech icons keep working.
      techstack: topicsToTechstack(topics),
      questions,
      iconKey: iconKeyForNewInterview({ interviewType, role }),
    },
  };
}

/**
 * Everything a visa interview needs written down.
 *
 * No model call: the topic areas an officer covers are a property of the visa
 * category, not something worth asking a language model to invent, and the
 * officer decides its actual questions live from the candidate's answers.
 */
function buildVisaInterview(
  input: CreateInterviewInput
): { document: Record<string, unknown> } | { error: string } {
  const setup = {
    visaTypeId: input.visaTypeId ?? "",
    customVisaType: input.customVisaType,
    visaModeId: input.visaModeId ?? "",
    destination: input.destination ?? "",
    details: input.visaDetails ?? {},
  };

  const validation = validateVisaSetup(setup, { termsAccepted: input.termsAccepted });
  if (!validation.valid) {
    return {
      error: Object.values(validation.errors)[0] ?? "That visa interview setup is not valid.",
    };
  }

  const category = getVisaCategory(setup.visaTypeId);
  const mode = getVisaMode(setup.visaModeId);
  const label = resolveVisaTypeLabel(setup);
  const topics = visaTopicsFor(setup);

  // Only the fields the candidate actually filled in. Firestore rejects an
  // undefined value, and an empty string in the prompt reads as a real answer.
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(setup.details)) {
    if (typeof value === "string" && value.trim() !== "") details[key] = value.trim();
  }

  return {
    document: {
      // `role` carries the human label so every existing list, card and heading
      // that reads it keeps working without being taught about visa interviews.
      role: label,
      type: "visa",
      level: "n/a",
      levelLabel: "Visa applicant",
      topics,
      roleCategory: "visa",
      visaType: category.id,
      visaTypeLabel: label,
      visaMode: mode.id,
      destination: setup.destination.trim(),
      visaDetails: details,
      techstack: [],
      questions: topics,
      iconKey: iconKeyForNewInterview({ interviewType: "visa" }),
    },
  };
}

// ---------------------------------------------------------------------------
// Starting a session
// ---------------------------------------------------------------------------

export interface StartSessionResult {
  allowed: boolean;
  sessionId?: string;
  /** Authoritative. Never the number the client asked for. */
  durationSeconds?: number;
  planName?: string;
  remaining?: number | null;
  /** True when an in-flight attempt was reused rather than a credit spent. */
  resumed?: boolean;
  reason?: string;
}

async function countSessionsThisPeriod(userId: string): Promise<number> {
  const since = periodStart().toISOString();
  try {
    const snapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .where("startedAt", ">=", since)
      .get();
    return snapshot.size;
  } catch (error) {
    // A missing composite index must not hand out free interviews, but it must
    // not lock everyone out either. Fall back to an unindexed read.
    if (errorNumericCode(error) === 9 && /index/i.test(errorMessage(error))) {
      const snapshot = await db.collection("sessions").where("userId", "==", userId).get();
      return snapshot.docs.filter((d) => String(d.data().startedAt ?? "") >= since).length;
    }
    throw error;
  }
}

/**
 * An unfinished attempt at this interview, if there is one.
 *
 * The indexed form needs a composite index over three equality filters. If it
 * is missing this falls back to an unindexed read rather than returning
 * nothing: "no resumable session" is not a safe default here, because it would
 * silently charge a second interview credit for what is really one attempt
 * being retried.
 */
async function findResumableSession(
  userId: string,
  interviewId: string
): Promise<{ id: string; grantedSeconds: number } | null> {
  const isFresh = (data: FirebaseFirestore.DocumentData): boolean => {
    const startedAt = Date.parse(String(data.startedAt ?? ""));
    const grant = Number(data.grantedSeconds ?? 0);
    const age = Date.now() - startedAt;
    return (
      Number.isFinite(startedAt) &&
      Number.isFinite(grant) &&
      grant > 0 &&
      age >= 0 &&
      age < Math.min(RESUME_WINDOW_MS, grant * 1000 + 2 * 60 * 1000)
    );
  };

  try {
    const snapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .where("interviewId", "==", interviewId)
      .where("status", "==", "active")
      .limit(5)
      .get();
    const match = snapshot.docs.find((doc) => isFresh(doc.data()));
    return match
      ? { id: match.id, grantedSeconds: Number(match.data().grantedSeconds ?? 0) }
      : null;
  } catch (error) {
    console.warn(
      "[SESSION] resumable-session lookup failed; falling back to an unindexed read:",
      errorMessage(error)
    );
    try {
      const snapshot = await db
        .collection("sessions")
        .where("userId", "==", userId)
        .get();
      const match = snapshot.docs.find((doc) => {
        const data = doc.data();
        return (
          data.interviewId === interviewId &&
          data.status === "active" &&
          isFresh(data)
        );
      });
      return match
        ? { id: match.id, grantedSeconds: Number(match.data().grantedSeconds ?? 0) }
        : null;
    } catch (fallbackError) {
      console.error(
        "[SESSION] could not check for a resumable session:",
        errorMessage(fallbackError)
      );
      return null;
    }
  }
}

/**
 * The gate every interview passes through.
 *
 * Returns the duration the account may actually have and records the session
 * against the monthly quota, both server-side, so neither can be changed from
 * the browser. `devDurationSeconds` may shorten a session for testing but is
 * ignored in production and can never lengthen one past the plan.
 */
export async function startInterviewSession(params: {
  interviewId: string;
  /** Selected by the pre-flight UI; always clamped to a published plan length. */
  requestedDurationSeconds?: number;
  /** Dev-only, and only ever honoured when it is SHORTER than the grant. */
  devDurationSeconds?: number;
}): Promise<StartSessionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { allowed: false, reason: "You must be signed in to start an interview." };
  }

  const plan = getPlan(user.plan);

  if (!params || typeof params.interviewId !== "string" || !params.interviewId.trim()) {
    return { allowed: false, reason: "Choose an interview before starting." };
  }

  try {
    const interviewSnap = await db.collection("interviews").doc(params.interviewId).get();
    if (!interviewSnap.exists) {
      return { allowed: false, reason: "That interview no longer exists." };
    }
    const interview = interviewSnap.data() ?? {};
    const interviewType = resolveInterviewType(interview.interviewType);

    // Shared role-based interview templates may be practised by another user,
    // but resume and visa records contain private, candidate-specific context.
    // Never let an id copied from a URL turn either into another account's
    // live prompt.
    if (
      interview.userId !== user.id &&
      (interviewType === "resume" || interviewType === "visa")
    ) {
      return { allowed: false, reason: "That interview is not available to this account." };
    }

    // A retake may choose a different published length in the pre-flight UI.
    // The saved setup remains the fallback, and the plan is always the ceiling.
    const selectedSeconds = Number(params.requestedDurationSeconds);
    const durationSource =
      Number.isFinite(selectedSeconds) && selectedSeconds > 0
        ? selectedSeconds
        : Number(interview.durationSeconds ?? plan.maxSessionMinutes * 60);
    const requestedMinutes = Math.round(
      durationSource / 60
    );
    const minutes = clampSessionMinutes(plan.id, requestedMinutes);
    let grantedSeconds = minutes * 60;

    if (
      process.env.NODE_ENV !== "production" &&
      params.devDurationSeconds &&
      params.devDurationSeconds > 0
    ) {
      // Shorter only. A dev override that could lengthen a session would be a
      // plan bypass wearing a different name.
      grantedSeconds = Math.min(grantedSeconds, Math.floor(params.devDurationSeconds));
    }

    // Reuse an attempt that is already in flight rather than charging again.
    const fresh = await findResumableSession(user.id, params.interviewId);
    if (fresh) {
      console.debug(`[SESSION] reusing in-flight session ${fresh.id}`);
      return {
        allowed: true,
        sessionId: fresh.id,
        // Re-apply today's plan ceiling in case the account was downgraded
        // after this in-flight session was first created.
        durationSeconds: Math.min(fresh.grantedSeconds, grantedSeconds),
        planName: plan.name,
        remaining: null,
        resumed: true,
      };
    }

    const used = await countSessionsThisPeriod(user.id);
    const quota = checkInterviewQuota(plan.id, used);
    if (!quota.allowed) {
      return {
        allowed: false,
        planName: plan.name,
        remaining: 0,
        reason: quota.reason ?? "You have used all your interviews for this month.",
      };
    }

    const ref = db.collection("sessions").doc();
    const startedAtIso = new Date().toISOString();

    // The count and the write happen together. Two tabs starting at the same
    // moment on the last remaining credit would otherwise both read "one left"
    // and both be allowed through.
    //
    // Deliberately a single equality filter, with the period applied in memory:
    // adding `where("startedAt", ">=")` makes this a composite query, and a
    // transaction has no way to fall back when that index is missing. It fails
    // the whole transaction instead, which is how every interview start began
    // reporting "could not verify your plan". One account has at most a few
    // dozen sessions a month, so reading them all costs nothing worth having a
    // second index for.
    await db.runTransaction(async (tx) => {
      const recheck = await tx.get(
        db.collection("sessions").where("userId", "==", user.id)
      );
      const since = periodStart().toISOString();
      const usedNow = recheck.docs.filter(
        (doc) => String(doc.data().startedAt ?? "") >= since
      ).length;

      const limit = plan.interviewsPerMonth;
      if (limit !== null && usedNow >= limit) {
        throw new Error("QUOTA_EXHAUSTED");
      }
      tx.set(ref, {
        userId: user.id,
        interviewId: params.interviewId,
        planId: plan.id,
        interviewType,
        role: interview.role ?? "",
        topics: interview.topics ?? [],
        experienceLevel: interview.level ?? "",
        interviewerId: interview.interviewerId ?? "",
        requestedSeconds: requestedMinutes * 60,
        grantedSeconds,
        status: "active",
        startedAt: startedAtIso,
        // Server clock, so elapsed time cannot be backdated from the browser.
        startedAtServer: FieldValue.serverTimestamp(),
      });
    });

    return {
      allowed: true,
      sessionId: ref.id,
      durationSeconds: grantedSeconds,
      planName: plan.name,
      remaining: quota.remaining === null ? null : Math.max(0, quota.remaining - 1),
      resumed: false,
    };
  } catch (error) {
    if (errorMessage(error) === "QUOTA_EXHAUSTED") {
      return {
        allowed: false,
        planName: plan.name,
        remaining: 0,
        reason: `You have used all ${plan.interviewsPerMonth} interviews on the ${plan.name} plan this month.`,
      };
    }
    console.error("[SESSION] could not start session:", error);
    return {
      allowed: false,
      reason: "Could not verify your plan right now. Check your connection and try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Finalising a session
// ---------------------------------------------------------------------------

export interface FinalizeSessionResult {
  success: boolean;
  feedbackId?: string;
  /** True when this call found the work already done. */
  alreadyFinalized?: boolean;
  message?: string;
}

export interface FinalizeSessionInput {
  sessionId: string;
  interviewId: string;
  transcript: { speaker: "ai" | "user"; text: string; timestamp: number }[];
  monitoringEvents: {
    type: "attention_warning";
    startedAt: number;
    duration: number | null;
    resolvedAt: number | null;
  }[];
  endReason: EndReason;
  feedbackId?: string;
}

/**
 * The single way an interview is written down, and the single place feedback is
 * generated.
 *
 * Idempotent by construction: the session document is flipped from `active` to
 * `finalizing` inside a transaction, so of the several callers that can race to
 * end an interview (the expiry timer, the End button, a transport close, an
 * unmount) exactly one proceeds. Every other one is told the work is already
 * done and returns the same feedback id, which is what stops a double
 * completion producing two scores.
 */
export async function finalizeInterviewSession(
  input: FinalizeSessionInput
): Promise<FinalizeSessionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  if (
    !input ||
    typeof input.sessionId !== "string" ||
    !input.sessionId.trim() ||
    typeof input.interviewId !== "string" ||
    !input.interviewId.trim() ||
    !Array.isArray(input.transcript) ||
    !Array.isArray(input.monitoringEvents) ||
    input.transcript.length > 2000 ||
    input.monitoringEvents.length > 200 ||
    !["duration_expired", "manual", "connection_lost", "error"].includes(
      input.endReason
    )
  ) {
    return { success: false, message: "The interview result is not valid." };
  }

  const transcriptIsValid = input.transcript.every(
    (line) =>
      line &&
      (line.speaker === "ai" || line.speaker === "user") &&
      typeof line.text === "string" &&
      line.text.length <= 8_000 &&
      Number.isFinite(line.timestamp)
  );
  const monitoringIsValid = input.monitoringEvents.every(
    (event) =>
      event &&
      event.type === "attention_warning" &&
      Number.isFinite(event.startedAt) &&
      (event.duration === null ||
        (Number.isFinite(event.duration) && event.duration >= 0)) &&
      (event.resolvedAt === null ||
        (Number.isFinite(event.resolvedAt) && event.resolvedAt >= event.startedAt))
  );
  const transcriptCharacters = input.transcript.reduce(
    (total, line) => total + (typeof line?.text === "string" ? line.text.length : 0),
    0
  );
  if (!transcriptIsValid || !monitoringIsValid || transcriptCharacters > 100_000) {
    return { success: false, message: "The interview result is not valid." };
  }

  const sessionRef = db.collection("sessions").doc(input.sessionId);

  let claimed = false;
  let grantedSeconds = 0;
  let startedAtMs = Date.now();
  let existingFeedbackId: string | undefined;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new Error("SESSION_NOT_FOUND");

      const data = snap.data() ?? {};
      if (data.userId !== user.id) throw new Error("NOT_YOURS");
      if (data.interviewId !== input.interviewId) throw new Error("INTERVIEW_MISMATCH");

      grantedSeconds = Number(data.grantedSeconds ?? 0);
      const parsed = Date.parse(String(data.startedAt ?? ""));
      if (Number.isFinite(parsed)) startedAtMs = parsed;
      existingFeedbackId = data.feedbackId;

      if (data.status !== "active") {
        // Someone else already ended this interview.
        claimed = false;
        return;
      }

      claimed = true;

      const endedAt = Date.now();
      // Elapsed time is measured against the server-recorded start and clamped
      // to the grant, so a tampered client clock cannot record a longer session
      // than the plan allows.
      const elapsedSeconds = Math.min(
        grantedSeconds,
        Math.max(0, Math.round((endedAt - startedAtMs) / 1000))
      );

      tx.update(sessionRef, {
        status: "finalizing",
        endedAt: new Date(endedAt).toISOString(),
        endedAtServer: FieldValue.serverTimestamp(),
        elapsedSeconds,
        completedFullDuration:
          grantedSeconds > 0 && elapsedSeconds >= grantedSeconds - 5,
        endReason: input.endReason,
        // Transcript text only. No audio, no imagery, and no camera frames --
        // the monitoring events are counts and durations by design.
        transcript: input.transcript.slice(0, 2000),
        transcriptLines: input.transcript.length,
        monitoringEvents: input.monitoringEvents.slice(0, 200),
        attentionWarnings: input.monitoringEvents.length,
      });
    });
  } catch (error) {
    const message = errorMessage(error);
    if (message === "SESSION_NOT_FOUND") {
      return { success: false, message: "That interview session no longer exists." };
    }
    if (message === "NOT_YOURS") {
      return { success: false, message: "That interview session belongs to another account." };
    }
    if (message === "INTERVIEW_MISMATCH") {
      return { success: false, message: "That interview does not match this session." };
    }
    console.error("[SESSION] could not finalize:", error);
    return { success: false, message: "Could not save the interview. Please try again." };
  }

  if (!claimed) {
    console.debug(`[SESSION] ${input.sessionId} was already finalized`);
    return { success: true, alreadyFinalized: true, feedbackId: existingFeedbackId };
  }

  if (input.transcript.length === 0) {
    await sessionRef.update({ status: "completed", outcome: "empty" });
    return {
      success: false,
      message:
        "The interview ended before anything was said, so there was nothing to score.",
    };
  }

  // The scorer needs to know what it is scoring, and the context the transcript
  // itself does not carry (which visa category, which role, which mode).
  const interviewSnap = await db.collection("interviews").doc(input.interviewId).get();
  const interview = interviewSnap.data() ?? {};
  const interviewType = resolveInterviewType(interview.interviewType);

  // The scorer is told what the resume claimed, so it can judge whether the
  // answers substantiated it. Read rather than duplicated onto the interview.
  let resumeSummary: string | null = null;
  if (interviewType === "resume" && interview.resumeId) {
    try {
      const resumeSnap = await db
        .collection("resumes")
        .doc(String(interview.resumeId))
        .get();
      const stored = resumeSnap.data();
      if (stored?.profile) {
        resumeSummary = describeResumeProfile(
          resumeProfileSchema.parse(stored.profile)
        );
      }
    } catch (error) {
      // Scoring without the resume summary is degraded but still useful.
      console.warn("[SESSION] could not read resume profile for scoring:", errorMessage(error));
    }
  }

  const feedback = await createFeedback({
    sessionId: input.sessionId,
    interviewId: input.interviewId,
    userId: user.id,
    interviewType,
    context: {
      role: typeof interview.role === "string" ? interview.role : undefined,
      topics: Array.isArray(interview.topics) ? interview.topics.map(String) : undefined,
      visaTypeLabel:
        typeof interview.visaTypeLabel === "string" ? interview.visaTypeLabel : undefined,
      visaModeLabel: interview.visaMode ? getVisaMode(String(interview.visaMode)).label : undefined,
      destination:
        typeof interview.destination === "string" ? interview.destination : undefined,
      resumeSummary: resumeSummary ?? undefined,
    },
    // createFeedback speaks the transcript shape the scoring prompt expects.
    transcript: input.transcript.map((line) => ({
      role: line.speaker === "ai" ? "assistant" : "user",
      content: line.text,
    })),
    feedbackId: input.feedbackId,
    session: await sessionMetaFor(sessionRef),
    attention: {
      warnings: input.monitoringEvents.length,
      events: input.monitoringEvents,
    },
  });

  if (!feedback.success || !feedback.feedbackId) {
    // The interview itself is safe; only scoring failed. Mark it so the record
    // is not left stuck in `finalizing` forever.
    await sessionRef.update({ status: "completed", outcome: "scoring_failed" });
    return { success: false, message: feedback.message };
  }

  await sessionRef.update({
    status: "completed",
    outcome: "scored",
    feedbackId: feedback.feedbackId,
  });

  return { success: true, feedbackId: feedback.feedbackId };
}

/** Reads back the timing the transaction just wrote, for the feedback record. */
async function sessionMetaFor(
  ref: DocumentReference
): Promise<InterviewSessionMeta | undefined> {
  const snap = await ref.get();
  const data = snap.data();
  if (!data) return undefined;
  return {
    durationSeconds: Number(data.grantedSeconds ?? 0),
    elapsedSeconds: Number(data.elapsedSeconds ?? 0),
    startedAt: String(data.startedAt ?? ""),
    endedAt: String(data.endedAt ?? ""),
    completedFullDuration: data.completedFullDuration === true,
  };
}
