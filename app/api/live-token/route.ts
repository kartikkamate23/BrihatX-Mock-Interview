import { GoogleGenAI, Modality } from "@google/genai";

import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { errorMessage } from "@/lib/errors";
import { getInterviewer } from "@/lib/interview-config";
import { resumeProfileSchema } from "@/lib/resume/profile";
import { resolveInterviewType, type InterviewType } from "@/lib/interview-types";
import { getPlan } from "@/lib/plans";
import { getVisaCategory, getVisaMode, resolveVisaTypeLabel, visaTopicsFor } from "@/lib/visa";
import { LIVE_MODEL } from "@/lib/voice/models";
import { buildInterviewInstruction } from "@/lib/voice/prompt";
import { getLiveTokenWindow } from "@/lib/voice/token-window";

/**
 * Mints a single-use ephemeral token for one interview session.
 *
 * This endpoint exists so the permanent Gemini API key never reaches a browser.
 * A `NEXT_PUBLIC_` key would be extractable from the JavaScript bundle by
 * anyone who opened devtools and would then be usable, without limit, against
 * the project's quota and billing. What the browser gets instead is a token
 * that is bound to one model and configuration, usable once, and dead within
 * minutes.
 *
 * The gate runs before the token is minted, not after: the caller must be
 * signed in, must own the session, and the session must still be active.
 */
/**
 * Turns a stored interview into the instruction its interviewer runs on.
 *
 * Split out of the request handler because it is the one piece of this route
 * with real branching, and because keeping it pure makes it obvious that
 * nothing here reads from the request body.
 */
async function instructionFor(params: {
  interviewType: InterviewType;
  candidateName: string;
  interview: FirebaseFirestore.DocumentData;
  sessionRole?: string;
  sessionLevel?: string;
  interviewerId: string;
  topics: string[];
  grantedSeconds: number;
}): Promise<string> {
  const { interview, topics, grantedSeconds, candidateName } = params;

  if (params.interviewType === "resume") {
    // The profile is read here rather than copied onto the interview: it is the
    // single source of truth for what the resume said, and an interview retaken
    // after a resume is re-uploaded should use the newer reading.
    const resumeId = String(interview.resumeId ?? "");
    const snapshot = resumeId
      ? await db.collection("resumes").doc(resumeId).get()
      : null;
    const stored = snapshot?.data();

    // A missing or unreadable profile must not take the interview down: it
    // degrades to a role-based interview, which is still a useful session.
    const parsed = resumeProfileSchema.safeParse(stored?.profile ?? {});
    if (parsed.success) {
      const interviewer = getInterviewer(params.interviewerId);
      return buildInterviewInstruction({
        type: "resume",
        candidateName,
        profile: parsed.data,
        targetRole: String(interview.role ?? "the role"),
        experienceLevel: String(interview.level ?? ""),
        interviewerName: interviewer.name,
        interviewerStyle: interviewer.style,
        interviewerTitle: interviewer.title,
        topics,
        durationSeconds: grantedSeconds,
      });
    }
    console.warn("[LIVE-TOKEN] resume profile unreadable; falling back to a role interview");
  }

  if (params.interviewType === "visa") {
    const category = getVisaCategory(String(interview.visaType ?? ""));
    const mode = getVisaMode(String(interview.visaMode ?? ""));
    const storedLabel =
      typeof interview.visaTypeLabel === "string" && interview.visaTypeLabel.trim() !== ""
        ? interview.visaTypeLabel.trim()
        : null;

    return buildInterviewInstruction({
      type: "visa",
      candidateName,
      visaTypeLabel:
        storedLabel ??
        resolveVisaTypeLabel({
          visaTypeId: String(interview.visaType ?? ""),
          customVisaType: undefined,
        }),
      visaFocus: category.focus,
      modeBehaviour: mode.behaviour,
      allowsCoaching: mode.allowsCoaching,
      destination: String(interview.destination ?? "the destination country"),
      details:
        typeof interview.visaDetails === "object" && interview.visaDetails !== null
          ? (interview.visaDetails as Record<string, string>)
          : {},
      topics:
        topics.length > 0
          ? topics
          : visaTopicsFor({ visaTypeId: String(interview.visaType ?? "") }),
      durationSeconds: grantedSeconds,
    });
  }

  if (params.interviewType === "communication") {
    return buildInterviewInstruction({
      type: "communication",
      candidateName,
      role: typeof interview.role === "string" ? interview.role : undefined,
      topics,
      experienceLevel: String(interview.level ?? params.sessionLevel ?? ""),
      interviewerId: params.interviewerId,
      durationSeconds: grantedSeconds,
    });
  }

  return buildInterviewInstruction({
    type: "technical",
    candidateName,
    role: String(interview.role ?? params.sessionRole ?? "Software Engineer"),
    topics,
    experienceLevel: String(interview.level ?? params.sessionLevel ?? ""),
    interviewerId: params.interviewerId,
    durationSeconds: grantedSeconds,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { success: false, error: "You must be signed in to start an interview." },
      { status: 401 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return Response.json(
      { success: false, error: "Request body is too large." },
      { status: 413 }
    );
  }

  let body: { sessionId?: string };
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TypeError("Expected a JSON object");
    }
    body = parsed as typeof body;
  } catch {
    return Response.json(
      { success: false, error: "Request body is not valid JSON." },
      { status: 400 }
    );
  }

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || sessionId.length > 150 || sessionId.includes("/")) {
    return Response.json(
      { success: false, error: "sessionId is required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    // Logged, never returned: the message a user sees must not describe the
    // server's credential layout.
    console.error(
      "[LIVE-TOKEN] GOOGLE_GENERATIVE_AI_API_KEY is not configured; voice interviews cannot start."
    );
    return Response.json(
      { success: false, error: "Voice interview configuration is unavailable." },
      { status: 503 }
    );
  }

  try {
    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    if (!sessionSnap.exists) {
      return Response.json(
        { success: false, error: "That interview session does not exist." },
        { status: 404 }
      );
    }

    const session = sessionSnap.data() ?? {};
    if (session.userId !== user.id) {
      // Deliberately the same shape as "not found": telling a caller that a
      // session exists but belongs to someone else is itself a disclosure.
      return Response.json(
        { success: false, error: "That interview session does not exist." },
        { status: 404 }
      );
    }
    if (session.status !== "active") {
      return Response.json(
        { success: false, error: "That interview session has already finished." },
        { status: 409 }
      );
    }

    const interviewSnap = await db
      .collection("interviews")
      .doc(String(session.interviewId))
      .get();
    if (!interviewSnap.exists) {
      return Response.json(
        { success: false, error: "That interview no longer exists." },
        { status: 404 }
      );
    }
    const interview = interviewSnap.data() ?? {};

    const storedGrant = Number(session.grantedSeconds ?? 0);
    const planCeiling = getPlan(user.plan).maxSessionMinutes * 60;
    const grantedSeconds = Math.min(storedGrant, planCeiling);
    const startedAt = Date.parse(String(session.startedAt ?? ""));
    const tokenWindow = getLiveTokenWindow({
      startedAtMs: startedAt,
      grantedSeconds,
    });
    if (!tokenWindow.valid) {
      await sessionSnap.ref.update({ status: "expired" });
      return Response.json(
        { success: false, error: "That interview session has expired." },
        { status: 409 }
      );
    }
    const interviewer = getInterviewer(String(session.interviewerId ?? interview.interviewerId));
    const interviewType = resolveInterviewType(interview.interviewType);
    const topics = Array.isArray(interview.topics) ? interview.topics.map(String) : [];

    // The instruction is assembled on the server, from the stored interview, and
    // is then locked into the token's connect constraints. The browser never
    // gets to choose what the interviewer is told -- a client-supplied prompt
    // would turn a plan-limited interview session into a general-purpose model.
    const systemInstruction = await instructionFor({
      interviewType,
      candidateName: user.name,
      interview,
      sessionRole: typeof session.role === "string" ? session.role : undefined,
      sessionLevel:
        typeof session.experienceLevel === "string" ? session.experienceLevel : undefined,
      interviewerId: interviewer.id,
      topics,
      grantedSeconds,
    });

    // Resume lookup and prompt assembly are normally quick, but can cross the
    // deadline when a request arrives in the final moments. Re-check before the
    // external token call rather than sending Gemini an already-expired window.
    const mintWindow = getLiveTokenWindow({
      startedAtMs: startedAt,
      grantedSeconds,
    });
    if (!mintWindow.valid) {
      await sessionSnap.ref.update({ status: "expired" });
      return Response.json(
        { success: false, error: "That interview session has expired." },
        { status: 409 }
      );
    }

    // A client that navigated away while the prompt was being assembled no
    // longer needs a credential. Avoid minting a single-use token that can
    // never be consumed; the next attempt can reuse the active session.
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    // Ephemeral tokens are a v1alpha feature; the browser must connect on the
    // same version, which lib/voice/gemini-live.ts does.
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    // The token dies shortly after the interview is due to end. This is the
    // server-side backstop behind the client countdown: even a tampered client
    // that never stops its own timer cannot hold a session open past the
    // duration the plan granted.
    const expiresAtMs = mintWindow.tokenExpiresAtMs;

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(expiresAtMs).toISOString(),
        // The window in which the browser may open the session at all. Short,
        // because a token that can start a session an hour later is a token
        // worth stealing.
        newSessionExpireTime: new Date(
          mintWindow.newSessionExpiresAtMs
        ).toISOString(),
        // Locks the token to this interview's configuration. Even if the token
        // leaked, it could not be used to run arbitrary prompts against the
        // project's quota.
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: interviewer.voiceName },
              },
            },
          },
        },
        lockAdditionalFields: [],
      },
    });

    if (!token.name) {
      throw new Error("The token service returned no token.");
    }

    return Response.json({
      success: true,
      token: token.name,
      model: LIVE_MODEL,
      interviewType,
      voiceName: interviewer.voiceName,
      systemInstruction,
      durationSeconds: grantedSeconds,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
  } catch (error) {
    // Full detail server-side only. The caller gets one sentence and no
    // indication of which credential or quota was involved.
    console.error("[LIVE-TOKEN] could not mint a session token:", errorMessage(error));

    const detail = errorMessage(error).toLowerCase();
    if (/quota|rate limit|429|resource_exhausted/.test(detail)) {
      return Response.json(
        {
          success: false,
          error:
            "The AI service is temporarily unavailable. Please try again in a few minutes.",
        },
        { status: 503 }
      );
    }

    return Response.json(
      { success: false, error: "Voice interview configuration is unavailable." },
      { status: 500 }
    );
  }
}
