import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { GEMINI_MODEL, describeModelError, isGeminiConfigured } from "@/lib/ai";
import { errorMessage } from "@/lib/errors";
import {
  MAX_RESUME_BYTES,
  ResumeExtractionError,
  extractResumeText,
  sanitiseFileName,
  validateResumeFile,
} from "@/lib/resume/extract";
import {
  buildResumeExtractionPrompt,
  describeResumeProfile,
  normaliseResumeProfile,
  resumeProfileSchema,
} from "@/lib/resume/profile";

/**
 * Uploads and analyses a resume.
 *
 * The file is parsed in this request and then discarded. Nothing but the
 * extracted structured profile is stored, which is a deliberate privacy choice:
 * a resume is a sensitive personal document carrying an address, a phone number
 * and an employment history, and the interview only ever needs the shape of the
 * candidate's experience. Keeping no file means there is no storage bucket to
 * secure, no signed URL to leak, and nothing to delete later.
 *
 * Parsing is server-side for the same reason the Gemini key is: the browser
 * never holds the credential, and the raw document never travels anywhere other
 * than this request.
 */

/** PDF parsing needs Node APIs, not the edge runtime. */
export const runtime = "nodejs";
/** Large enough for the 10 MB cap plus multipart overhead. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { success: false, error: "You must be signed in to upload a resume." },
      { status: 401 }
    );
  }

  // Reject an oversized multipart body before `formData()` buffers it. The
  // extra megabyte allows for headers and boundaries around the 10 MB file.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_RESUME_BYTES + 1024 * 1024
  ) {
    return Response.json(
      { success: false, error: "That resume is larger than 10 MB. Please upload a smaller file." },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { success: false, error: "That upload could not be read. Please try again." },
      { status: 400 }
    );
  }

  const file = form.get("resume");
  if (!(file instanceof File)) {
    return Response.json(
      { success: false, error: "No resume file was attached." },
      { status: 400 }
    );
  }

  // Validated before a byte is parsed, and validated here rather than only in
  // the browser: the upload control is a convenience, this is the control.
  const validation = validateResumeFile({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!validation.valid || !validation.kind) {
    return Response.json(
      { success: false, error: validation.error ?? "That file cannot be used as a resume." },
      { status: 400 }
    );
  }

  if (file.size > MAX_RESUME_BYTES) {
    return Response.json(
      { success: false, error: "That resume is larger than 10 MB. Please upload a smaller file." },
      { status: 413 }
    );
  }

  if (!isGeminiConfigured()) {
    console.error("[RESUME] GOOGLE_GENERATIVE_AI_API_KEY is not configured.");
    return Response.json(
      { success: false, error: "Resume analysis is unavailable right now." },
      { status: 503 }
    );
  }

  const fileName = sanitiseFileName(file.name);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractResumeText(buffer, validation.kind);

    // Counts only. The contents of a resume are never logged.
    console.debug(
      `[RESUME] parsed ${validation.kind}, ${extracted.wordCount} words, ${file.size} bytes`
    );

    const { object } = await generateObject({
      model: google(GEMINI_MODEL, { structuredOutputs: false }),
      schema: resumeProfileSchema,
      prompt: buildResumeExtractionPrompt(extracted.text),
      system:
        "You extract structured facts from a resume. You never invent an employer, a date, a project or a technology that is not present in the text.",
    });

    const profile = normaliseResumeProfile(object);

    // Stored in its own document rather than inlined into every interview: a
    // candidate practises several times against one resume, and duplicating the
    // profile into each interview would mean several copies to keep in step.
    const ref = await db.collection("resumes").add({
      userId: user.id,
      fileName,
      fileKind: validation.kind,
      wordCount: extracted.wordCount,
      profile,
      createdAt: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      resumeId: ref.id,
      fileName,
      profile,
      summary: describeResumeProfile(profile),
    });
  } catch (error) {
    // A parse failure the candidate can act on: a scanned PDF, an encrypted
    // file, a corrupted document. Its message is written to be shown.
    if (error instanceof ResumeExtractionError) {
      console.warn(`[RESUME] extraction failed: ${error.message}`);
      return Response.json(
        { success: false, error: error.userMessage },
        { status: 422 }
      );
    }

    console.error("[RESUME] analysis failed:", errorMessage(error));

    if (/quota|rate limit|429|resource_exhausted/i.test(errorMessage(error))) {
      return Response.json(
        { success: false, error: describeModelError(error) },
        { status: 503 }
      );
    }

    return Response.json(
      {
        success: false,
        error:
          "We couldn't read this resume. Please upload a text-based PDF or Word document.",
      },
      { status: 500 }
    );
  }
}
