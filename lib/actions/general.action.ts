"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db, FirebaseAdminNotConfiguredError } from "@/firebase/admin";
import { errorMessage, errorNumericCode } from "@/lib/errors";
import {
  resumeFeedbackSchema,
  standardFeedbackSchema,
  visaFeedbackSchema,
} from "@/lib/feedback-schemas";
import { resolveInterviewType } from "@/lib/interview-types";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  GEMINI_CONFIG_MESSAGE,
  GEMINI_MODEL,
  isGeminiConfigured,
  isModelAuthIssue,
  describeModelError,
} from "@/lib/ai";

function questionReviewInstructions(
  type: ReturnType<typeof resolveInterviewType>
): string {
  const safety = type === "visa"
    ? "For visa answers, never invent personal facts, dates, finances, documents, or travel history. Use clear [replace with your detail] placeholders when facts are missing."
    : type === "resume"
      ? "Never invent projects, metrics, employers, tools, or responsibilities that are not supported by the transcript or resume context. Use a clearly marked placeholder where evidence is missing."
      : "Do not invent personal experience, achievements, numbers, or technical decisions the candidate did not provide. Use a clearly marked placeholder when needed.";

  return `QUESTION-BY-QUESTION REVIEW (required):
- Produce exactly one questionReviews item for every substantive interviewer question, in transcript order. Ignore greetings, acknowledgements, and closing pleasantries.
- Copy the interviewer question verbatim into question; do not rewrite it.
- Pair each question with everything the candidate said before the next substantive interviewer question.
- Copy that candidate response verbatim into candidateAnswer, joining consecutive candidate transcript lines in order. Do not summarize or correct it. If they did not answer, write exactly "No answer provided."
- score is for that individual answer only, from 0 to 100.
- whatWasGood must cite concrete strengths from that answer; use an empty array if there are none.
- mistakes must identify exact factual errors, missing details, weak structure, filler, irrelevance, or unclear wording. Do not manufacture a mistake.
- howToImprove must give specific, usable steps for that exact answer.
- improvedAnswer must directly answer the same question in a clear, interview-ready structure. It is an example, not a claim about what the candidate really did.
- Keep each improved answer concise enough to speak naturally in an interview.
- ${safety}`;
}

/**
 * The scoring prompt for each interview type.
 *
 * Kept unexported because a "use server" module may only export async
 * functions, and it does not need to be reachable from anywhere else.
 *
 * The visa variant is where the product's safety rule has to be restated. The
 * schema has no field a verdict could go in, but a model asked to assess a visa
 * interview will volunteer one inside `finalAssessment` unless told not to, and
 * a mock tool telling someone their real application will fail is both useless
 * and harmful.
 */
function scoringPrompt(
  type: ReturnType<typeof resolveInterviewType>,
  transcript: string,
  context: NonNullable<CreateFeedbackParams["context"]>
): string {
  if (type === "visa") {
    return `You are reviewing a PRACTICE visa interview so the candidate can improve before the real one.

Visa category: ${context.visaTypeLabel ?? "Not specified"}
Destination: ${context.destination ?? "Not specified"}
Practice mode: ${context.visaModeLabel ?? "Standard"}

Transcript of the practice session:
${transcript}

Score the candidate 0 to 100 in each of the listed categories, and do not add categories of your own:
- Confidence: did they sound composed and sure of their own situation?
- Clarity: were the answers easy to follow first time?
- Conciseness: did they answer the question asked, without over-explaining?
- Relevance: did the answer actually address the officer's question?
- Consistency: did their answers hold together across the interview?
- Communication: pace, audibility, and handling of pressure.
- Answer Quality: specificity and credibility of the detail given.
- Visa Interview Readiness: how prepared they sound for this kind of interview, as practice feedback.

Then fill in the detail sections. Quote or closely paraphrase what was actually said -- generic advice is worthless here. If a section genuinely has no entries, return an empty array rather than inventing one.

CRITICAL WORDING RULES:
- This is practice. You must NEVER state or imply that a real visa would be approved, refused, granted or denied, and you must not estimate any probability of either.
- Phrase every criticism as something to improve: "this answer would be stronger if it named the city and the dates", never "this answer would get you refused".
- Do not speculate about what a real officer would conclude.

${questionReviewInstructions(type)}`;
  }

  if (type === "resume") {
    return `You are reviewing a mock interview that was conducted from the candidate's own resume.

Target role: ${context.role ?? "Not specified"}
${context.resumeSummary ? `Resume summary: ${context.resumeSummary}` : ""}

Transcript:
${transcript}

Score the candidate 0 to 100 in each listed category, and do not add categories of your own:
- Technical Knowledge: depth on the technologies and work their resume claims.
- Communication: clarity, structure, and whether the point landed.
- Confidence: composure discussing their own experience.
- Answer Relevance: did the answer address the question asked.
- Resume Substantiation: how convincingly they explained, with specifics, the things their resume claims. This measures the ANSWERS, not the resume's honesty.
- Depth of Experience: whether the detail suggests hands-on ownership rather than familiarity.

Then fill in the detail sections, quoting or closely paraphrasing what was actually said. Empty arrays where a section genuinely has nothing.

CRITICAL WORDING RULES:
- Never accuse the candidate of lying, exaggerating or misrepresenting their resume. If a claim was thinly substantiated, say the ANSWER lacked specifics and show what a stronger one would contain.
- \`resumeRecommendations\` is about improving the document: which claims need concrete evidence attached, and which real strengths are undersold.
- \`targetRoleGap\` compares their demonstrated background with the target role fairly, and says what to build or study. It is career advice, not a verdict.

${questionReviewInstructions(type)}`;
  }

  if (type === "communication") {
    return `You are reviewing a communication practice session. Judge HOW the candidate communicated, not what they knew technically.

${context.role ? `Field they are preparing for: ${context.role}` : ""}

Transcript:
${transcript}

Score the candidate from 0 to 100 in the following areas, and do not add categories other than the ones provided:
- **Communication Skills**: Clarity, articulation, structured responses.
- **Technical Knowledge**: Only as far as they explained ideas understandably; do not penalise depth of knowledge in this session.
- **Problem-Solving**: How they structured a response to an unexpected question.
- **Cultural & Role Fit**: Professionalism, tone, and how they came across.
- **Confidence & Clarity**: Confidence, engagement, and whether the point landed.

Be specific and cite what was actually said. Where an answer rambled or buried its point, say so and show a tighter version.

${questionReviewInstructions(type)}`;
  }

  return `You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Do not be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

${context.role ? `Role interviewed for: ${context.role}` : ""}
${context.topics && context.topics.length > 0 ? `Topics covered: ${context.topics.join(", ")}` : ""}

Transcript:
${transcript}

Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
- **Communication Skills**: Clarity, articulation, structured responses.
- **Technical Knowledge**: Understanding of key concepts for the role.
- **Problem-Solving**: Ability to analyze problems and propose solutions.
- **Cultural & Role Fit**: Alignment with company values and job role.
- **Confidence & Clarity**: Confidence in responses, engagement, and clarity.

${questionReviewInstructions(type)}`;
}

export async function createFeedback(params: CreateFeedbackParams) {
  const {
    sessionId,
    interviewId,
    userId,
    transcript,
    feedbackId,
    session,
    attention,
  } = params;
  // Absent on records written before interview types existed, and every one of
  // those was a role-based interview -- so this resolves to "technical".
  const interviewType = resolveInterviewType(params.interviewType);
  const context = params.context ?? {};

  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) {
    return { success: false, message: "You must be signed in to save feedback." };
  }

  const transcriptCharacters = Array.isArray(transcript)
    ? transcript.reduce(
        (total, line) =>
          total + (typeof line?.content === "string" ? line.content.length : 0),
        0
      )
    : 0;
  if (
    typeof sessionId !== "string" ||
    !sessionId.trim() ||
    sessionId.includes("/") ||
    typeof interviewId !== "string" ||
    !interviewId.trim() ||
    !Array.isArray(transcript) ||
    transcript.length === 0 ||
    transcript.length > 2000 ||
    transcriptCharacters > 100_000 ||
    !transcript.every(
      (line) =>
        line &&
        (line.role === "assistant" || line.role === "user") &&
        typeof line.content === "string" &&
        line.content.length <= 8_000
    )
  ) {
    return { success: false, message: "The interview transcript is not valid." };
  }

  // This server action is callable over the network. Only the finalization flow
  // may spend a scoring model call; being signed in alone must not become an
  // unlimited Gemini proxy. Claim the exact session atomically so concurrent
  // calls cannot all observe `finalizing` and each spend a model request.
  try {
    const sessionRef = db.collection("sessions").doc(sessionId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(sessionRef);
      const stored = snapshot.data();
      if (
        !snapshot.exists ||
        stored?.userId !== userId ||
        stored?.interviewId !== interviewId ||
        stored?.status !== "finalizing"
      ) {
        throw new Error("SESSION_NOT_READY_FOR_SCORING");
      }
      tx.update(sessionRef, { status: "scoring" });
    });
  } catch (error) {
    if (errorMessage(error) === "SESSION_NOT_READY_FOR_SCORING") {
      return { success: false, message: "That interview is not ready to be scored." };
    }
    console.error("[FEEDBACK] could not verify finalizing session:", errorMessage(error));
    return {
      success: false,
      message: "Could not verify this interview before scoring. Please try again.",
    };
  }

  // Checked before the request so a missing key is not reported as a model failure.
  if (!isGeminiConfigured()) {
    const message = "Feedback generation is unavailable: " + GEMINI_CONFIG_MESSAGE;
    console.error(message);
    return { success: false, message };
  }

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    // Every feedback schema uses a tuple of fixed category names, which Gemini's
    // native structured-output mode cannot express; tool-call mode handles it.
    const model = google(GEMINI_MODEL, { structuredOutputs: false });
    const prompt = scoringPrompt(interviewType, formattedTranscript, context);

    // Branched rather than passed a union schema: `generateObject` infers its
    // return type from the schema, and a union of two schemas infers as neither.
    const object =
      interviewType === "visa"
        ? (
            await generateObject({
              model,
              schema: visaFeedbackSchema,
              prompt,
              system:
                "You review a practice visa interview and produce structured, actionable feedback. You never state or imply what a real consular officer would decide.",
            })
          ).object
        : interviewType === "resume"
          ? (
              await generateObject({
                model,
                schema: resumeFeedbackSchema,
                prompt,
                system:
                  "You review a resume-based mock interview and produce structured, actionable feedback. You judge how well the candidate substantiated what their resume claims; you never accuse them of misrepresenting it.",
              })
            ).object
          : (
            await generateObject({
              model,
              schema: standardFeedbackSchema,
              prompt,
              system:
                "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories.",
            })
          ).object;

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      // Stored so the feedback page can render the right sections without
      // needing to load the interview document first.
      interviewType,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      questionReviews: object.questionReviews,
      createdAt: new Date().toISOString(),
      // Omitted entirely rather than written as undefined, which Firestore rejects.
      ...("visa" in object && object.visa ? { visa: object.visa } : {}),
      ...("resume" in object && object.resume ? { resume: object.resume } : {}),
      ...(session ? { session } : {}),
      ...(attention ? { attention } : {}),
    };

    // One feedback document per (interview, user). The interview page passes
    // the existing id when it has one, but a retake that raced ahead of that
    // read would otherwise add a second document for the same interview, and
    // the dashboard would then show whichever one the query happened to hit.
    let targetId = feedbackId;
    if (!targetId) {
      const existing = await db
        .collection("feedback")
        .where("interviewId", "==", interviewId)
        .where("userId", "==", userId)
        .limit(1)
        .get();
      if (!existing.empty) targetId = existing.docs[0].id;
    }

    const feedbackRef = targetId
      ? db.collection("feedback").doc(targetId)
      : db.collection("feedback").doc();

    if (targetId) {
      const target = await feedbackRef.get();
      const stored = target.data();
      if (
        target.exists &&
        (stored?.userId !== userId || stored?.interviewId !== interviewId)
      ) {
        return { success: false, message: "That feedback record cannot be updated." };
      }
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);

    if (error instanceof FirebaseAdminNotConfiguredError) {
      return {
        success: false,
        message:
          "Feedback could not be saved: the server is missing Firebase Admin credentials.",
      };
    }

    if (isModelAuthIssue(error)) {
      // The raw text is hundreds of characters of quota JSON; the user needs
      // one actionable sentence, and the full error is already in the log.
      return { success: false, message: describeModelError(error) };
    }

    return {
      success: false,
      message: "Could not generate feedback. See the server log for details.",
    };
  }
}

/**
 * Feedback for many interviews in one go.
 *
 * The dashboard previously did this per card, which meant one Firestore
 * round-trip per interview rendered and made the list slower the more the
 * account had. Firestore's `in` filter is capped at thirty values, so the ids
 * are chunked rather than sent as one query.
 */
export async function getFeedbackForInterviews(params: {
  userId: string;
  interviewIds: string[];
}): Promise<Record<string, Feedback>> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return {};
  const userId = currentUser.id;
  const interviewIds = Array.isArray(params.interviewIds)
    ? params.interviewIds.filter((id) => typeof id === "string" && id.trim()).slice(0, 300)
    : [];
  if (interviewIds.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < interviewIds.length; i += 30) {
    chunks.push(interviewIds.slice(i, i + 30));
  }

  const found: Record<string, Feedback> = {};

  try {
    // Chunks do not depend on one another. Running them serially made a long
    // history pay one full Firestore round-trip per 30 interviews before the
    // dashboard could render.
    const snapshots = await Promise.allSettled(
      chunks.map((chunk) =>
        db.collection("feedback").where("interviewId", "in", chunk).get()
      )
    );

    for (const result of snapshots) {
      // One failed batch should not discard scores already returned by the
      // other batches. The dashboard remains useful and the failure stays in
      // the development log.
      if (result.status === "rejected") {
        console.error("getFeedbackForInterviews: Firestore batch failed:", result.reason);
        continue;
      }
      const snapshot = result.value;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        // The `in` filter cannot also carry the ownership check without a
        // composite index, so it is applied here. Feedback is written only by
        // the server, but a shared interview id must still not leak someone
        // else's score.
        if (data.userId !== userId) continue;
        const feedback = { ...data, id: doc.id } as Feedback;
        const existing = found[feedback.interviewId];
        // A retake overwrites in place, but if two documents ever exist the
        // newest is the one that reflects the latest attempt.
        if (!existing || String(feedback.createdAt) > String(existing.createdAt)) {
          found[feedback.interviewId] = feedback;
        }
      }
    }
  } catch (error) {
    // A dashboard without scores is still a usable dashboard; failing the whole
    // page because the score lookup broke is not.
    console.error("getFeedbackForInterviews: Firestore query failed:", error);
    return found;
  }

  return found;
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser || typeof id !== "string" || !id.trim()) return null;
  try {
    const interview = await db.collection("interviews").doc(id).get();
    if (!interview.exists) return null;
    const data = interview.data() ?? {};
    const type = resolveInterviewType(data.interviewType);
    if (
      data.userId !== currentUser.id &&
      (data.finalized !== true || type === "resume" || type === "visa")
    ) {
      return null;
    }
    return { ...data, id: interview.id } as Interview;
  } catch (error) {
    return handleQueryError("getInterviewById", error);
  }
}

/**
 * True when Firestore refused a query because the composite index backing it
 * does not exist yet. gRPC code 9 is FAILED_PRECONDITION, which Firestore also
 * uses for other preconditions, hence the message check.
 */
function isMissingIndexError(error: unknown): boolean {
  return errorNumericCode(error) === 9 && /index/i.test(errorMessage(error));
}

/**
 * Runs the indexed query, and if its composite index has not been deployed,
 * falls back to one that needs only the single-field indexes Firestore creates
 * automatically, finishing the sort/filter in memory.
 *
 * Creating the composite indexes requires either an interactive `firebase
 * login` or the roles/datastore.indexAdmin permission, neither of which the
 * checked-in service account has. Rather than leaving the dashboard
 * permanently empty, the app degrades to the in-memory path -- and starts using
 * the efficient query by itself the moment the indexes are deployed.
 */
/**
 * When a composite index is known to be missing, remember it for a few minutes
 * instead of re-issuing a query that is certain to fail on every page load.
 *
 * Firestore's client retries FAILED_PRECONDITION internally before surfacing
 * it, so the doomed attempt is not free -- it doubled dashboard latency, and on
 * a flaky link it dominated it. The TTL means deploying the indexes starts
 * being used within minutes without needing a restart.
 */
const missingIndexSince = new Map<string, number>();
const MISSING_INDEX_TTL_MS = 5 * 60 * 1000;

function indexKnownMissing(label: string): boolean {
  const seen = missingIndexSince.get(label);
  if (seen === undefined) return false;
  if (Date.now() - seen < MISSING_INDEX_TTL_MS) return true;
  missingIndexSince.delete(label); // re-probe: the index may exist by now
  return false;
}

async function withIndexFallback<T>(
  label: string,
  indexed: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T | null> {
  if (indexKnownMissing(label)) {
    try {
      return await fallback();
    } catch (fallbackError) {
      return handleQueryError(`${label} (fallback)`, fallbackError);
    }
  }

  try {
    return await indexed();
  } catch (error) {
    if (!isMissingIndexError(error)) return handleQueryError(label, error);

    missingIndexSince.set(label, Date.now());

    const url = errorMessage(error)
      .split(/\s+/)
      .find((word) => word.startsWith("https://"));
    console.warn(
      `${label}: composite index missing, serving from an unindexed query instead.` +
        `\n  Deploy the checked-in definitions for the fast path: firebase deploy --only firestore:indexes` +
        (url ? `\n  Or create this one directly: ${url}` : "")
    );

    try {
      return await fallback();
    } catch (fallbackError) {
      return handleQueryError(`${label} (fallback)`, fallbackError);
    }
  }
}

function handleQueryError(label: string, error: unknown): null {
  console.error(`${label}: Firestore query failed:`, error);
  return null;
}

const byNewestFirst = (a: Interview, b: Interview) =>
  String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const interviewId = params.interviewId;
  const userId = currentUser.id;

  return withIndexFallback(
    "getFeedbackByInterviewId",
    async () => {
      const snapshot = await db
        .collection("feedback")
        .where("interviewId", "==", interviewId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { ...doc.data(), id: doc.id } as Feedback;
    },
    async () => {
      // A single equality filter needs only the automatic index. An interview
      // has at most a handful of feedback docs, so match the user here.
      const snapshot = await db
        .collection("feedback")
        .where("interviewId", "==", interviewId)
        .limit(25)
        .get();

      const match = snapshot.docs.find((d) => d.data().userId === userId);
      return match ? ({ ...match.data(), id: match.id } as Feedback) : null;
    }
  );
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const userId = currentUser.id;
  const limit = Math.max(1, Math.min(50, Math.floor(Number(params.limit ?? 20)) || 20));

  return withIndexFallback(
    "getLatestInterviews",
    async () => {
      const interviews = await db
        .collection("interviews")
        .orderBy("createdAt", "desc")
        .where("finalized", "==", true)
        .where("userId", "!=", userId)
        .limit(limit)
        .get();

      return interviews.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as Interview)
        .filter((interview) => {
          const type = resolveInterviewType(interview.interviewType);
          return type !== "resume" && type !== "visa";
        });
    },
    async () => {
      // orderBy on one field uses the automatic index. Over-fetch so that
      // discarding this user's own interviews still leaves a full page.
      const interviews = await db
        .collection("interviews")
        .orderBy("createdAt", "desc")
        .limit(Math.max(limit * 4, 60))
        .get();

      return interviews.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as Interview)
        .filter((i) => {
          const type = resolveInterviewType(i.interviewType);
          return (
            i.finalized === true &&
            i.userId !== userId &&
            type !== "resume" &&
            type !== "visa"
          );
        })
        .slice(0, limit);
    }
  );
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  userId = currentUser.id;
  return withIndexFallback(
    "getInterviewsByUserId",
    async () => {
      const interviews = await db
        .collection("interviews")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

      return interviews.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Interview[];
    },
    async () => {
      const interviews = await db
        .collection("interviews")
        .where("userId", "==", userId)
        .get();

      return interviews.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }) as Interview)
        .sort(byNewestFirst);
    }
  );
}

/** Joins reusable interview setups to this user's actual session attempts. */
export async function getDashboardSessionData() {
  const currentUser = await getCurrentUser();
  const empty = {
    interviews: [] as Interview[],
    byInterview: {} as Record<string, { status: string; elapsedSeconds: number; startedAt?: string; questionsAnswered: number }>,
    stats: { totalInterviews: 0, completedInterviews: 0, practiceSeconds: 0, questionsAnswered: 0 },
  };
  if (!currentUser) return empty;

  try {
    const snapshot = await db.collection("sessions").where("userId", "==", currentUser.id).get();
    const sessions = snapshot.docs.map((doc) => doc.data());
    const byInterview = { ...empty.byInterview };
    let completedInterviews = 0;
    let practiceSeconds = 0;
    let questionsAnswered = 0;

    for (const session of sessions) {
      const interviewId = String(session.interviewId ?? "");
      if (!interviewId) continue;
      const rawStatus = String(session.status ?? "active");
      const startedAt = String(session.startedAt ?? "");
      const startedAtMs = Date.parse(startedAt);
      const grantedSeconds = Math.max(0, Number(session.grantedSeconds ?? 0));
      const activeIsFresh = rawStatus === "active" && Number.isFinite(startedAtMs) && Date.now() < startedAtMs + grantedSeconds * 1000 + 120_000;
      const status = rawStatus === "active"
        ? activeIsFresh ? "in_progress" : "incomplete"
        : rawStatus === "finalizing" || rawStatus === "scoring"
          ? "processing"
          : rawStatus === "completed" && session.outcome === "scored"
            ? "completed"
            : rawStatus === "completed" ? "incomplete" : rawStatus;
      const elapsedSeconds = Math.max(0, Number(session.elapsedSeconds ?? 0));
      const transcript = Array.isArray(session.transcript) ? session.transcript : [];
      const answers = transcript.filter((line) => line && typeof line === "object" && (line as { speaker?: unknown }).speaker === "user" && typeof (line as { text?: unknown }).text === "string" && (line as { text: string }).text.trim().length > 0).length;

      practiceSeconds += elapsedSeconds;
      questionsAnswered += answers;
      if (rawStatus === "completed") completedInterviews += 1;

      const previous = byInterview[interviewId];
      const previousStartedAt = Date.parse(previous?.startedAt ?? "");
      if (!previous || !Number.isFinite(previousStartedAt) || startedAtMs > previousStartedAt) {
        byInterview[interviewId] = { status, elapsedSeconds, startedAt, questionsAnswered: answers };
      }
    }

    const ids = Object.keys(byInterview);
    const interviews: Interview[] = [];
    for (let index = 0; index < ids.length; index += 100) {
      const refs = ids.slice(index, index + 100).map((id) => db.collection("interviews").doc(id));
      if (!refs.length) continue;
      const docs = await db.getAll(...refs);
      interviews.push(...docs.filter((doc) => doc.exists).map((doc) => ({ ...doc.data(), id: doc.id }) as Interview));
    }

    return { interviews, byInterview, stats: { totalInterviews: sessions.length, completedInterviews, practiceSeconds, questionsAnswered } };
  } catch (error) {
    console.error("[DASHBOARD] could not read session history:", errorMessage(error));
    return empty;
  }
}
