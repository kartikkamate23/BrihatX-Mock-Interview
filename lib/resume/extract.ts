/**
 * Turning an uploaded resume into plain text a model can read.
 *
 * This module is server-only. It is imported from a route handler running on the
 * Node runtime, never from a component, because the PDF and DOCX parsers need
 * Node primitives (Buffer, zlib) that do not exist on the Edge runtime or in the
 * browser. Keeping it out of the client bundle also keeps a couple of megabytes
 * of parser off the wire.
 *
 * The shape mirrors lib/interview-config.ts: small pure functions, validation
 * that returns a friendly sentence rather than throwing, and one async entry
 * point that is defensive about everything a third-party parser can do to us.
 *
 * PRIVACY: a resume is a sensitive personal document. Nothing in this file logs,
 * echoes, or stores the extracted text, the file name, or any fragment of
 * either. Callers that want telemetry should log counts (bytes in, words out)
 * and the error kind, and nothing else. There are no console calls here on
 * purpose -- please keep it that way.
 */

/** 10 MB. Well above any real resume, low enough that a route handler survives it. */
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

/**
 * The MIME types we advertise and accept.
 *
 * These are the canonical ones. Browsers are not obliged to send any of them
 * (see the lenient list below), so this is what we *hope* for rather than what
 * we insist on.
 */
export const ACCEPTED_RESUME_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const ACCEPTED_RESUME_EXTENSIONS: readonly string[] = [
  ".pdf",
  ".docx",
  ".txt",
];

export type ResumeFileKind = "pdf" | "docx" | "txt";

/** Extension is the primary signal: it is the one thing the user actually chose. */
const KIND_BY_EXTENSION: Record<string, ResumeFileKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
};

const MIME_BY_KIND: Record<ResumeFileKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/**
 * Types we tolerate whatever the extension says.
 *
 * Windows in particular reports DOCX as an empty string or as
 * application/octet-stream, because the type a browser attaches to a File comes
 * from the OS registry rather than from the bytes. Rejecting those would fail a
 * large share of perfectly good uploads, so we let them through *only* because
 * the extension has already been checked against the accepted list -- the
 * extension is the claim we validate, and the real parse below is the thing that
 * actually proves the file is what it says it is. A wrong guess here costs a
 * friendly "we could not read that" a moment later, not a security hole.
 */
const LENIENT_TYPES: readonly string[] = ["", "application/octet-stream"];

/**
 * How much text we keep. A model call downstream is billed and rate limited by
 * token count, and a 400-page PDF pasted into a prompt is how a cheap request
 * turns into a very slow, very expensive one -- or a hard context-length error.
 * 60k characters is roughly 15k tokens, comfortably more than any resume needs.
 */
export const MAX_RESUME_TEXT_CHARS = 60_000;

/**
 * Below this we treat the extraction as having failed rather than succeeded.
 * A one-page resume is 250-500 words; even a sparse one clears 30 easily.
 */
export const MIN_RESUME_WORDS = 30;

export interface ResumeValidationResult {
  valid: boolean;
  kind?: ResumeFileKind;
  /** One sentence, safe to show a user. */
  error?: string;
}

function invalid(error: string): ResumeValidationResult {
  return { valid: false, error };
}

/**
 * Everything we can check before spending CPU on a parse.
 *
 * Runs on the metadata a multipart upload gives us, so it is cheap and can run
 * on the client too as an affordance. The server must still call it: a disabled
 * button is a courtesy, not a check, exactly as in validateSetup().
 *
 * Messages are deliberately plain. "Invalid MIME type" is true and useless; a
 * person needs to be told what to do next, and never sees a library's wording.
 */
export function validateResumeFile(file: {
  name: string;
  size: number;
  type: string;
}): ResumeValidationResult {
  const name = (file.name ?? "").trim();

  const dot = name.lastIndexOf(".");
  const extension = dot === -1 ? "" : name.slice(dot).toLowerCase();
  const kind = KIND_BY_EXTENSION[extension];

  if (!kind) {
    return invalid(
      "Upload your resume as a PDF, a Word document (.docx), or a plain text file."
    );
  }

  // ".pdf" on its own, or "  .pdf". Nothing left once the extension is removed
  // means the upload is almost certainly a stray dotfile or a broken form post.
  const base = name.slice(0, dot).replace(/[.\s]/g, "");
  if (base === "") {
    return invalid("Give that file a proper name before uploading it.");
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return invalid("That file is empty, so there is nothing to read.");
  }

  if (file.size > MAX_RESUME_BYTES) {
    const limit = Math.round(MAX_RESUME_BYTES / (1024 * 1024));
    return invalid(
      `That file is larger than ${limit} MB, so please upload a smaller version.`
    );
  }

  // "text/plain; charset=utf-8" is a perfectly ordinary thing to be sent, and
  // the parameters after the semicolon are none of our business.
  const declared = (file.type ?? "").split(";")[0].trim().toLowerCase();
  const matchesExtension = declared === MIME_BY_KIND[kind];

  if (!matchesExtension && !LENIENT_TYPES.includes(declared)) {
    return invalid(
      "That file's contents do not match its name, so please re-save it and try again."
    );
  }

  return { valid: true, kind };
}

/**
 * Reduces a browser-supplied file name to something safe to put in a log line,
 * a storage key, or a Content-Disposition header.
 *
 * The threat is path traversal: a name is attacker-controlled text that arrives
 * inside a multipart body, and "../../etc/passwd" or "C:\\windows\\x.pdf" is a
 * single unguarded path join away from writing somewhere it should not. We keep
 * only the final segment and only characters that cannot mean anything to a
 * filesystem. Never returns an empty string, because "" is exactly the value
 * that makes a path join resolve to a directory.
 */
export function sanitiseFileName(name: string): string {
  const cleaned = (name ?? "")
    // Keep only the last path segment, whichever separator was used.
    .split(/[/\\]/)
    .pop()!
    // Control characters, including the NUL byte that truncates a C-style path.
    .replace(/[\u0000-\u001F\u007F]/g, "")
    // Any surviving traversal marker, plus characters Windows forbids outright.
    .replace(/\.{2,}/g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    // Leading dots hide the file on POSIX and can confuse extension checks.
    .replace(/^[.\s]+/, "")
    .trim();

  // 120 is arbitrary but comfortably under the ~255-byte limit every common
  // filesystem enforces, with room for a prefix a caller may add.
  const capped = cleaned.slice(0, 120).trim();

  return capped === "" ? "resume" : capped;
}

export interface ExtractionResult {
  text: string;
  /** Rough count, for the "too short to be a resume" check. */
  wordCount: number;
  kind: ResumeFileKind;
}

/**
 * The only error this module throws.
 *
 * `message` and `userMessage` are the same string by design: whichever one a
 * careless caller reaches for, the user sees something sane. The original
 * failure is kept on `cause` for the server log and is never surfaced -- a
 * parser's own wording tends to be "Can't find end of central directory : is
 * this a zip file ?" followed by a documentation URL, which helps nobody.
 */
export class ResumeExtractionError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "ResumeExtractionError";
    this.userMessage = userMessage;
    if (cause !== undefined) this.cause = cause;
    // Restores instanceof when this file is ever downlevelled past ES2015.
    Object.setPrototypeOf(this, ResumeExtractionError.prototype);
  }
}

/**
 * Makes extracted text usable.
 *
 * A resume is a layout document pretending to be prose. What comes out of a PDF
 * is column fragments, bullet glyphs, non-breaking spaces holding a header
 * apart, ligatures from the font, and smart quotes from Word. None of that
 * carries meaning, all of it costs tokens, and some of it actively confuses a
 * model -- "ﬁnance" is not the word "finance" unless we make it one. So we
 * flatten every layout artefact to its plain equivalent and collapse the
 * whitespace that held the layout together.
 */
export function normaliseResumeText(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // NFKC is what turns ﬁ/ﬂ ligatures, full-width characters and other
  // compatibility forms into their ordinary counterparts in one pass.
  try {
    text = text.normalize("NFKC");
  } catch {
    // A malformed lone surrogate can upset normalize on some runtimes; the
    // un-normalised text is still perfectly usable, so carry on.
  }

  text = text
    // Line endings first, so every later rule only has to think about "\n".
    .replace(/\r\n?/g, "\n")
    // Bullet glyphs. A hyphen means the same thing and tokenises better.
    .replace(/[\u2022\u00B7\u25AA\u25E6\u2023\u2219\u25CF\u25CB\u25AB]/g, "-")
    // En dash, em dash, figure dash, horizontal bar.
    .replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-")
    // Smart single quotes and the prime that fonts use for feet/minutes.
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    // Smart double quotes and double prime.
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    // Zero-width characters: invisible, but they split words for a tokeniser.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Every exotic space (non-breaking, en, em, thin, ideographic) is a space.
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Remaining control characters, keeping \n and \t.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Collapse runs of horizontal whitespace, but never across a line break.
    .replace(/[^\S\n]+/g, " ")
    // Trim each line, which also removes the indentation a PDF column leaves.
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    // At most one blank line: paragraph structure survives, page gaps do not.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return capLength(text);
}

/**
 * Truncates at a line boundary when there is one nearby, so the tail of the text
 * is a whole line rather than half a word.
 */
function capLength(text: string): string {
  if (text.length <= MAX_RESUME_TEXT_CHARS) return text;

  const clipped = text.slice(0, MAX_RESUME_TEXT_CHARS);
  const lastBreak = clipped.lastIndexOf("\n");
  const cut =
    lastBreak > MAX_RESUME_TEXT_CHARS - 1000 ? clipped.slice(0, lastBreak) : clipped;

  return cut.trimEnd();
}

/** Whitespace-separated tokens. Rough on purpose -- it only feeds a threshold. */
function countWords(text: string): number {
  if (text.trim() === "") return 0;
  return text.trim().split(/\s+/).length;
}

/** Copies into a plain Uint8Array so a parser cannot detach the caller's buffer. */
function toBytes(buffer: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(buffer);
}

async function readPdf(bytes: Uint8Array): Promise<string> {
  // Imported lazily: unpdf pulls in the whole of PDF.js, and a DOCX or TXT
  // upload should not pay for that. It also keeps the dependency out of the
  // module graph of anything that merely imports validateResumeFile.
  const { extractText } = await import("unpdf");

  try {
    const { text } = await extractText(bytes, { mergePages: false });
    // Page boundaries are real structure worth keeping; normaliseResumeText
    // collapses them to a single blank line afterwards.
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (error) {
    // PDF.js throws PasswordException for an encrypted document. That is worth
    // its own message because it is the one failure the user can actually fix.
    const name =
      typeof error === "object" && error !== null
        ? String((error as { name?: unknown }).name ?? "")
        : "";

    if (name === "PasswordException") {
      throw new ResumeExtractionError(
        "That PDF is password protected. Remove the password and upload it again.",
        error
      );
    }

    throw new ResumeExtractionError(
      "We could not read that PDF. It may be damaged, so try re-saving it or upload a Word or text version instead.",
      error
    );
  }
}

async function readDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;

  try {
    // extractRawText rather than convertToHtml: we want the words, and markup
    // would only be stripped again before the text reaches a model.
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  } catch (error) {
    // A .docx is a zip. Anything from a truncated upload to a renamed .doc
    // surfaces here as a JSZip error, complete with a documentation link.
    throw new ResumeExtractionError(
      "We could not read that Word document. Try re-saving it as a .docx, or upload a PDF instead.",
      error
    );
  }
}

function readTxt(bytes: Uint8Array): string {
  // ignoreBOM is false by default, which -- confusingly -- is the setting that
  // makes the decoder strip a leading byte-order mark. Notepad writes one on
  // every UTF-8 save, so this matters more often than it sounds. The explicit
  // strip afterwards covers a decoder that disagrees, and a BOM that a previous
  // concatenation left in the middle of nowhere.
  const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: false });
  return decoder.decode(bytes).replace(/^\uFEFF/, "");
}

/**
 * Extracts, normalises and sanity-checks the text of an uploaded resume.
 *
 * Throws ResumeExtractionError and nothing else: every parser failure is caught
 * and replaced with a sentence a user can act on. Validate the file with
 * validateResumeFile() first -- this function trusts the `kind` it is given.
 */
export async function extractResumeText(
  buffer: Buffer | Uint8Array,
  kind: ResumeFileKind
): Promise<ExtractionResult> {
  const bytes = toBytes(buffer);

  if (bytes.byteLength === 0) {
    throw new ResumeExtractionError(
      "That file is empty, so there is nothing to read."
    );
  }

  let raw: string;
  if (kind === "pdf") {
    raw = await readPdf(bytes);
  } else if (kind === "docx") {
    raw = await readDocx(bytes);
  } else {
    raw = readTxt(bytes);
  }

  const text = normaliseResumeText(raw);
  const wordCount = countWords(text);

  /**
   * The scanned resume, and why it gets a branch of its own.
   *
   * A PDF produced by a phone scanner or an office copier is a valid PDF
   * containing one large image per page. PDF.js parses it perfectly happily and
   * returns an empty string: there is no error to catch, no exception, no
   * warning. Without this check the pipeline succeeds with almost no text, the
   * model is asked to interview someone about a blank resume, and the user is
   * left wondering why the questions are generic. That is a far worse outcome
   * than a clear refusal, and it is the single most common way this feature
   * fails in the wild, so we detect it explicitly and say so.
   *
   * The threshold, rather than a strict emptiness test, catches the near miss:
   * a scan with a small searchable header, or a page of OCR that produced three
   * words of noise.
   */
  if (kind === "pdf" && wordCount < MIN_RESUME_WORDS) {
    throw new ResumeExtractionError(
      "That resume appears to be a scanned image, so we could not read any text from it. Please upload a text-based PDF or a Word document."
    );
  }

  if (wordCount === 0) {
    throw new ResumeExtractionError(
      "We could not find any text in that file. Please upload a resume that contains selectable text."
    );
  }

  return { text, wordCount, kind };
}
