import { describe, expect, it } from "vitest";

import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_TYPES,
  MAX_RESUME_BYTES,
  MAX_RESUME_TEXT_CHARS,
  ResumeExtractionError,
  extractResumeText,
  normaliseResumeText,
  sanitiseFileName,
  validateResumeFile,
} from "@/lib/resume/extract";

const PDF_TYPE = "application/pdf";
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Builds a real, structurally valid PDF: catalogue, page tree, one page, a
 * content stream of Tj operators, a Type1 font, and a byte-accurate xref table.
 *
 * Written by hand rather than checked in as a fixture so the test proves the
 * parser works on bytes we can vary -- in particular so the scanned-resume case
 * below is a PDF that genuinely contains no text operators, not a stub.
 */
function buildPdf(lines: string[]): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  let content = "BT\n/F1 12 Tf\n72 720 Td\n14 TL\n";
  for (const line of lines) content += `(${escape(line)}) Tj\nT*\n`;
  content += "ET\n";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

const RESUME_LINES = [
  "Jane Doe - Senior Software Engineer",
  "London, United Kingdom - jane@example.com",
  "Experience: eight years building distributed backend systems for payments",
  "Acme Payments, Staff Engineer, led the migration of the ledger to Postgres",
  "Globex, Senior Engineer, owned the settlement pipeline and its on-call rota",
  "Skills: TypeScript, React, Node.js, PostgreSQL, Kubernetes, Terraform",
  "Education: BSc Computer Science, University of Bristol, first class honours",
];

describe("constants", () => {
  it("advertises the three real MIME types and their extensions", () => {
    expect(ACCEPTED_RESUME_EXTENSIONS).toEqual([".pdf", ".docx", ".txt"]);
    expect(ACCEPTED_RESUME_TYPES).toContain(PDF_TYPE);
    expect(ACCEPTED_RESUME_TYPES).toContain(DOCX_TYPE);
    expect(ACCEPTED_RESUME_TYPES).toContain("text/plain");
    expect(MAX_RESUME_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("validateResumeFile", () => {
  it("accepts an ordinary PDF", () => {
    const result = validateResumeFile({
      name: "jane-doe-resume.pdf",
      size: 120_000,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("pdf");
    expect(result.error).toBeUndefined();
  });

  it("accepts a DOCX sent with its very long official type", () => {
    const result = validateResumeFile({
      name: "resume.docx",
      size: 40_000,
      type: DOCX_TYPE,
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("docx");
  });

  it("accepts text/plain with a charset parameter", () => {
    const result = validateResumeFile({
      name: "resume.txt",
      size: 4_000,
      type: "text/plain; charset=utf-8",
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("txt");
  });

  it("accepts a DOCX that the browser reported as application/octet-stream", () => {
    // Windows reports DOCX from the registry, not from the bytes; rejecting this
    // would fail a large share of genuine uploads.
    const result = validateResumeFile({
      name: "resume.docx",
      size: 40_000,
      type: "application/octet-stream",
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("docx");
  });

  it("accepts a DOCX with an empty type", () => {
    const result = validateResumeFile({
      name: "resume.docx",
      size: 40_000,
      type: "",
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("docx");
  });

  it("uppercases in the extension do not matter", () => {
    const result = validateResumeFile({
      name: "RESUME.PDF",
      size: 1_000,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(true);
    expect(result.kind).toBe("pdf");
  });

  it("rejects an unsupported extension", () => {
    const result = validateResumeFile({
      name: "resume.pages",
      size: 40_000,
      type: "application/octet-stream",
    });
    expect(result.valid).toBe(false);
    expect(result.kind).toBeUndefined();
    expect(result.error).toMatch(/PDF/);
  });

  it("rejects a legacy .doc even though it is a Word file", () => {
    const result = validateResumeFile({
      name: "resume.doc",
      size: 40_000,
      type: "application/msword",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a file with no extension at all", () => {
    const result = validateResumeFile({
      name: "resume",
      size: 40_000,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a name that is only an extension", () => {
    const result = validateResumeFile({
      name: ".pdf",
      size: 40_000,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it("rejects an empty file", () => {
    const result = validateResumeFile({
      name: "resume.pdf",
      size: 0,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects a file over the size limit", () => {
    const result = validateResumeFile({
      name: "resume.pdf",
      size: MAX_RESUME_BYTES + 1,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/10 MB/);
  });

  it("accepts a file exactly on the size limit", () => {
    const result = validateResumeFile({
      name: "resume.pdf",
      size: MAX_RESUME_BYTES,
      type: PDF_TYPE,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a spoofed type that contradicts the extension", () => {
    const result = validateResumeFile({
      name: "resume.pdf",
      size: 40_000,
      type: "image/png",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/do not match/i);
  });

  it("rejects a PDF whose type says it is a DOCX", () => {
    const result = validateResumeFile({
      name: "resume.pdf",
      size: 40_000,
      type: DOCX_TYPE,
    });
    expect(result.valid).toBe(false);
  });

  it("never returns a technical or empty rejection message", () => {
    const rejections = [
      { name: "resume.pages", size: 100, type: "" },
      { name: "resume", size: 100, type: PDF_TYPE },
      { name: ".pdf", size: 100, type: PDF_TYPE },
      { name: "resume.pdf", size: 0, type: PDF_TYPE },
      { name: "resume.pdf", size: MAX_RESUME_BYTES + 1, type: PDF_TYPE },
      { name: "resume.pdf", size: 100, type: "image/png" },
    ];

    for (const file of rejections) {
      const result = validateResumeFile(file);
      expect(result.valid).toBe(false);
      const error = result.error ?? "";
      expect(error.length).toBeGreaterThan(10);
      expect(error).toMatch(/[.!]$/);
      expect(error).not.toMatch(/mime|content-type|exception|at \w+ \(/i);
    }
  });
});

describe("sanitiseFileName", () => {
  it("defeats POSIX path traversal", () => {
    expect(sanitiseFileName("../../etc/passwd")).toBe("passwd");
  });

  it("defeats Windows path traversal", () => {
    expect(sanitiseFileName("C:\\evil\\x.pdf")).toBe("x.pdf");
    expect(sanitiseFileName("..\\..\\windows\\system32\\config")).toBe("config");
  });

  it("strips control characters, including a NUL truncation attempt", () => {
    const sanitised = sanitiseFileName("re\u0000su\u001Fme\u007F.pdf");
    expect(sanitised).toBe("resume.pdf");
    expect(sanitised).not.toMatch(/[\u0000-\u001F\u007F]/);
  });

  it("strips leading dots so the result is never a hidden file", () => {
    expect(sanitiseFileName("...hidden.txt")).toBe("hidden.txt");
  });

  it("falls back to 'resume' when nothing survives", () => {
    expect(sanitiseFileName("../")).toBe("resume");
    expect(sanitiseFileName("...")).toBe("resume");
    expect(sanitiseFileName("\u0000\u0001")).toBe("resume");
    expect(sanitiseFileName("   ")).toBe("resume");
    expect(sanitiseFileName("")).toBe("resume");
  });

  it("caps a very long name", () => {
    const long = `${"a".repeat(500)}.pdf`;
    const sanitised = sanitiseFileName(long);
    expect(sanitised.length).toBeLessThanOrEqual(120);
    expect(sanitised.length).toBeGreaterThan(0);
  });

  it("leaves an ordinary name alone", () => {
    expect(sanitiseFileName("Jane Doe Resume 2026.pdf")).toBe(
      "Jane Doe Resume 2026.pdf"
    );
  });
});

describe("normaliseResumeText", () => {
  it("collapses runs of whitespace and blank lines", () => {
    const input = "Hello   \t  world\n\n\n\n   Next   section  \n\n";
    expect(normaliseResumeText(input)).toBe("Hello world\n\nNext section");
  });

  it("normalises line endings and trims each line", () => {
    expect(normaliseResumeText("  one  \r\n   two\r three  ")).toBe(
      "one\ntwo\nthree"
    );
  });

  it("normalises bullets and dashes to plain hyphens", () => {
    const input = "\u2022 Item one\n\u25AA Item two\n\u00B7 Item three\nA \u2013 B \u2014 C";
    expect(normaliseResumeText(input)).toBe(
      "- Item one\n- Item two\n- Item three\nA - B - C"
    );
  });

  it("normalises smart quotes and ligatures", () => {
    const input = "\u201CSmart\u201D and \u2018quotes\u2019 in \uFB01nance\u2026";
    expect(normaliseResumeText(input)).toBe('"Smart" and \'quotes\' in finance...');
  });

  it("strips control characters, zero-width joiners and non-breaking spaces", () => {
    const input = "Jane\u200BDoe\u00A0Engineer\u0007";
    expect(normaliseResumeText(input)).toBe("JaneDoe Engineer");
  });

  it("caps the text length", () => {
    const oversized = "lorem ipsum ".repeat(20_000);
    expect(oversized.length).toBeGreaterThan(MAX_RESUME_TEXT_CHARS);

    const capped = normaliseResumeText(oversized);
    expect(capped.length).toBeLessThanOrEqual(MAX_RESUME_TEXT_CHARS);
    expect(capped.length).toBeGreaterThan(MAX_RESUME_TEXT_CHARS - 1_000);
  });

  it("returns an empty string for empty input", () => {
    expect(normaliseResumeText("")).toBe("");
    expect(normaliseResumeText("   \n\n  ")).toBe("");
  });
});

describe("extractResumeText: txt", () => {
  it("decodes UTF-8 and reports a word count", async () => {
    const buffer = Buffer.from(RESUME_LINES.join("\n"), "utf8");
    const result = await extractResumeText(buffer, "txt");

    expect(result.kind).toBe("txt");
    expect(result.text).toContain("Jane Doe");
    expect(result.text).toContain("Kubernetes");
    expect(result.wordCount).toBeGreaterThan(30);
  });

  it("tolerates a byte-order mark", async () => {
    const buffer = Buffer.from(`\uFEFF${RESUME_LINES.join("\n")}`, "utf8");
    const result = await extractResumeText(buffer, "txt");

    expect(result.text.startsWith("Jane Doe")).toBe(true);
    expect(result.text).not.toContain("\uFEFF");
  });

  it("throws for a file with no readable text", async () => {
    const buffer = Buffer.from("   \n\n  \t ", "utf8");
    await expect(extractResumeText(buffer, "txt")).rejects.toBeInstanceOf(
      ResumeExtractionError
    );
  });

  it("throws for an empty buffer", async () => {
    await expect(
      extractResumeText(Buffer.alloc(0), "txt")
    ).rejects.toBeInstanceOf(ResumeExtractionError);
  });
});

describe("extractResumeText: pdf", () => {
  it("extracts the text of a real generated PDF", async () => {
    const pdf = buildPdf(RESUME_LINES);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const result = await extractResumeText(pdf, "pdf");

    expect(result.kind).toBe("pdf");
    expect(result.text).toContain("Jane Doe - Senior Software Engineer");
    expect(result.text).toContain("PostgreSQL");
    expect(result.wordCount).toBeGreaterThan(30);
  });

  it("accepts a Uint8Array as well as a Buffer, without detaching it", async () => {
    const bytes = new Uint8Array(buildPdf(RESUME_LINES));
    const before = bytes.byteLength;

    const result = await extractResumeText(bytes, "pdf");

    expect(result.wordCount).toBeGreaterThan(30);
    expect(bytes.byteLength).toBe(before);
  });

  it("reports a scanned, image-only PDF rather than pretending it parsed", async () => {
    // A structurally valid PDF whose content stream contains no text operators:
    // exactly what a scanner or copier produces, and exactly the case PDF.js
    // parses without complaint while returning nothing.
    const scanned = buildPdf([]);
    const result = await extractResumeText(scanned, "pdf").catch((e) => e);

    expect(result).toBeInstanceOf(ResumeExtractionError);
    expect((result as ResumeExtractionError).userMessage).toMatch(/scanned/i);
    expect((result as ResumeExtractionError).userMessage).toMatch(
      /text-based PDF|Word/i
    );
  });

  it("treats a PDF with only a few words as scanned too", async () => {
    // The near miss: a scan with a searchable header, or three words of OCR.
    const nearlyEmpty = buildPdf(["Jane Doe"]);
    const result = await extractResumeText(nearlyEmpty, "pdf").catch((e) => e);

    expect(result).toBeInstanceOf(ResumeExtractionError);
    expect((result as ResumeExtractionError).userMessage).toMatch(/scanned/i);
  });

  it("throws a friendly error for a corrupted PDF", async () => {
    const corrupt = Buffer.from(
      "%PDF-1.4\nthis is not remotely a valid pdf body\n%%EOF"
    );
    const result = await extractResumeText(corrupt, "pdf").catch((e) => e);

    expect(result).toBeInstanceOf(ResumeExtractionError);
    const userMessage = (result as ResumeExtractionError).userMessage;
    expect(userMessage.length).toBeGreaterThan(10);
    // Nothing from the library escapes: no exception name, no stack, no URL.
    expect(userMessage).not.toMatch(/exception|invalid pdf structure|https?:/i);
  });

  it("truncates a PDF that would blow up a later model call", async () => {
    const many = Array.from(
      { length: 4_000 },
      (_, i) => `Line ${i} of a pathologically long resume document body text`
    );
    const result = await extractResumeText(buildPdf(many), "pdf");

    expect(result.text.length).toBeLessThanOrEqual(MAX_RESUME_TEXT_CHARS);
  });
});

describe("extractResumeText: docx", () => {
  it("throws a friendly error for something that is not a .docx", async () => {
    // Mammoth's own wording here is "Can't find end of central directory : is
    // this a zip file ?" followed by a JSZip documentation URL. None of that
    // should ever reach a user.
    const notADocx = Buffer.from("this is definitely not a Word document");
    const result = await extractResumeText(notADocx, "docx").catch((e) => e);

    expect(result).toBeInstanceOf(ResumeExtractionError);
    const userMessage = (result as ResumeExtractionError).userMessage;
    expect(userMessage).toMatch(/Word document/i);
    expect(userMessage).not.toMatch(/zip|central directory|https?:/i);
  });
});

describe("ResumeExtractionError", () => {
  it("keeps the cause for the log and the user message for the screen", () => {
    const cause = new Error("EBADF: bad file descriptor, read");
    const error = new ResumeExtractionError("We could not read that file.", cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ResumeExtractionError);
    expect(error.name).toBe("ResumeExtractionError");
    expect(error.userMessage).toBe("We could not read that file.");
    expect(error.message).toBe("We could not read that file.");
    expect(error.cause).toBe(cause);
  });
});
