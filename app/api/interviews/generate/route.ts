import { db } from "@/firebase/admin";
import { errorMessage } from "@/lib/errors";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { iconKeyForNewInterview } from "@/lib/icons";
import { resolveInterviewType } from "@/lib/interview-types";
import {
  GEMINI_CONFIG_MESSAGE,
  generateInterviewQuestions,
  isGeminiConfigured,
  isModelAuthIssue,
} from "@/lib/ai";

/**
 * Interview generation over HTTP.
 *
 * The in-app setup wizard calls createInterviewFromSetup in
 * lib/actions/session.action.ts instead. This route is the integration point for
 * external callers that want to create an interview programmatically, and it
 * produces the same shape of document.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { success: false, error: "You must be signed in to create an interview." },
      { status: 401 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_000) {
    return Response.json(
      { success: false, error: "Request body is too large." },
      { status: 413 }
    );
  }

  let body: {
    type?: string;
    role?: string;
    level?: string;
    techstack?: string;
    amount?: number;
    userid?: string;
  };

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

  const { type, role, level, techstack, amount } = body;

  // Validate before spending a model call.
  const missing = (
    [
      ["type", type],
      ["role", role],
      ["level", level],
      ["techstack", techstack],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    return Response.json(
      { success: false, error: `Missing required field(s): ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const textFields = { type, role, level, techstack };
  const tooLong = Object.entries(textFields).find(
    ([, value]) => typeof value !== "string" || value.trim().length > 500
  );
  if (tooLong) {
    return Response.json(
      { success: false, error: `\`${tooLong[0]}\` must be text no longer than 500 characters.` },
      { status: 400 }
    );
  }

  const count = Number(amount);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return Response.json(
      { success: false, error: "`amount` must be a whole number between 1 and 20." },
      { status: 400 }
    );
  }

  if (!isGeminiConfigured()) {
    console.error(GEMINI_CONFIG_MESSAGE);
    return Response.json(
      { success: false, error: GEMINI_CONFIG_MESSAGE },
      { status: 503 }
    );
  }

  try {
    let questions: string[];
    try {
      questions = await generateInterviewQuestions({
        role: role!,
        level: level!,
        techstack: techstack!,
        type: type!,
        amount: count,
      });
    } catch (parseError) {
      // Distinguish "the model answered but unusably" from "the call failed".
      if (/did not return a JSON array/.test(errorMessage(parseError))) {
        console.error("Failed to parse model output:", errorMessage(parseError));
        return Response.json(
          {
            success: false,
            error: "The AI returned an unreadable response. Please try again.",
          },
          { status: 502 }
        );
      }
      throw parseError;
    }

    const interview = {
      role,
      type,
      interviewType: resolveInterviewType(type),
      level,
      techstack: String(techstack)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      questions,
      // Ownership always comes from the verified session cookie. `userid` is
      // deliberately ignored for compatibility with older callers.
      userId: user.id,
      finalized: true,
      iconKey: iconKeyForNewInterview({
        interviewType: resolveInterviewType(type),
        role,
      }),
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("interviews").add(interview);

    return Response.json(
      { success: true, interviewId: ref.id, questionCount: questions.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating interview:", error);

    const isAuthIssue = isModelAuthIssue(error);

    return Response.json(
      {
        success: false,
        // Do not leak stack traces or credentials to the caller.
        error: isAuthIssue
          ? "The AI service rejected the request. Check the server API key, model id, and quota."
          : "Failed to generate the interview. Please try again.",
      },
      { status: isAuthIssue ? 502 : 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
