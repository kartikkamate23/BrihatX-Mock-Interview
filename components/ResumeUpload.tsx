"use client";

import { useEffect, useRef, useState } from "react";

import {
  ACCEPTED_RESUME_EXTENSIONS,
  MAX_RESUME_BYTES,
  validateResumeFile,
} from "@/lib/resume/extract";
import type { ResumeProfile } from "@/lib/resume/profile";
import { cn } from "@/lib/utils";

export interface AnalysedResume {
  resumeId: string;
  fileName: string;
  profile: ResumeProfile;
  summary: string;
  /** Optional so persisted setup state created before this field remains valid. */
  fileSize?: number;
}

interface Props {
  value: AnalysedResume | null;
  onAnalysed: (resume: AnalysedResume) => void;
  onCleared: () => void;
}

type Status = "idle" | "uploading" | "error";

/**
 * Uploads a resume and shows what was read out of it.
 *
 * The file is validated here before it is sent, purely to save the candidate a
 * round-trip on an obvious mistake -- the server validates again, and that is
 * the check that counts.
 *
 * Nothing about the document is kept in the browser beyond the current render:
 * what comes back is the structured profile, and the file itself is discarded by
 * the server once parsed.
 */
const ResumeUpload = ({ value, onAnalysed, onCleared }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const formatFileSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const upload = async (file: File) => {
    // A drop can still happen while the picker button is disabled. Cancel the
    // older parse so a slow response cannot replace the newer resume.
    requestRef.current?.controller.abort();
    const request = {
      id: (requestRef.current?.id ?? 0) + 1,
      controller: new AbortController(),
    };
    requestRef.current = request;
    lastFileRef.current = file;
    setError(null);
    setFileName(file.name);
    setFileSize(file.size);

    const validation = validateResumeFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (!validation.valid) {
      setStatus("error");
      setError(validation.error ?? "That file cannot be used as a resume.");
      return;
    }

    setStatus("uploading");
    try {
      const body = new FormData();
      body.append("resume", file);

      const response = await fetch("/api/resume", {
        method: "POST",
        body,
        signal: request.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));

      if (requestRef.current?.id !== request.id) return;

      if (!response.ok || !payload?.success) {
        setStatus("error");
        setError(
          payload?.error ??
            "Unable to process your resume. Please try again."
        );
        return;
      }

      setStatus("idle");
      onAnalysed({
        resumeId: payload.resumeId,
        fileName: payload.fileName,
        profile: payload.profile,
        summary: payload.summary,
        fileSize: file.size,
      });
    } catch {
      if (request.controller.signal.aborted || requestRef.current?.id !== request.id) {
        return;
      }
      setStatus("error");
      setError("Unable to process your resume. Please try again.");
    }
  };

  useEffect(
    () => () => {
      requestRef.current?.controller.abort();
    },
    []
  );

  const clear = () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    lastFileRef.current = null;
    setStatus("idle");
    setError(null);
    setFileName(null);
    setFileSize(null);
    if (inputRef.current) inputRef.current.value = "";
    onCleared();
  };

  if (value) {
    const profile = value.profile;
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-dark-200/60 p-5">
        <input
          ref={inputRef}
          id="resume-file-replace"
          type="file"
          accept={ACCEPTED_RESUME_EXTENSIONS.join(",")}
          disabled={status === "uploading"}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) void upload(chosen);
            event.currentTarget.value = "";
          }}
          className="sr-only"
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary-200">Resume analysed</p>
            <p className="break-all text-xs text-light-100">
              {value.fileName}
              {value.fileSize ? ` · ${formatFileSize(value.fileSize)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={status === "uploading"}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 rounded-full bg-dark-200 px-4 py-1.5 text-xs text-light-100 hover:bg-dark-300 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={status === "uploading"}
              onClick={clear}
              className="min-h-11 rounded-full px-4 py-1.5 text-xs text-light-100 hover:bg-dark-300 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>

        {status === "uploading" && (
          <p className="text-sm text-light-100" role="status" aria-live="polite">
            Analysing {fileName ?? "replacement resume"}
            {fileSize ? ` (${formatFileSize(fileSize)})` : ""}…
          </p>
        )}

        {error && (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-destructive-100">{error}</p>
            {lastFileRef.current && (
              <button
                type="button"
                onClick={() => {
                  const file = lastFileRef.current;
                  if (file) void upload(file);
                }}
                className="min-h-11 rounded-full bg-dark-200 px-4 py-1.5 text-xs text-primary-200"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-light-100">{value.summary}</p>

        {/* Everything below is what the interviewer will actually work from, so
            the candidate can see it before committing rather than being
            surprised by a question about a misread employer. */}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {profile.name && (
            <div>
              <dt className="text-xs text-light-100/70">Name</dt>
              <dd className="text-white">{profile.name}</dd>
            </div>
          )}
          {profile.currentRole && (
            <div>
              <dt className="text-xs text-light-100/70">Detected role</dt>
              <dd className="text-white">{profile.currentRole}</dd>
            </div>
          )}
          {profile.yearsOfExperience !== null && (
            <div>
              <dt className="text-xs text-light-100/70">Experience</dt>
              <dd className="text-white">{profile.yearsOfExperience} years</dd>
            </div>
          )}
          {profile.skills.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-light-100/70">Skills</dt>
              <dd className="flex flex-wrap gap-1.5 pt-1">
                {profile.skills.slice(0, 14).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100"
                  >
                    {skill}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {profile.technologies.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-light-100/70">Technologies</dt>
              <dd className="flex flex-wrap gap-1.5 pt-1">
                {profile.technologies.slice(0, 14).map((technology) => (
                  <span
                    key={technology}
                    className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100"
                  >
                    {technology}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {profile.projects.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-light-100/70">Projects</dt>
              <dd className="text-white">
                {profile.projects.map((p) => p.name).filter(Boolean).join(", ")}
              </dd>
            </div>
          )}
          {profile.roles.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-light-100/70">Experience history</dt>
              <dd className="text-white">
                {profile.roles
                  .map((r) => [r.title, r.company].filter(Boolean).join(" · "))
                  .filter(Boolean)
                  .join(" | ")}
              </dd>
            </div>
          )}
          {profile.education.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-light-100/70">Education</dt>
              <dd className="text-white">
                {profile.education
                  .map((entry) =>
                    [entry.degree, entry.institution, entry.year].filter(Boolean).join(" · ")
                  )
                  .filter(Boolean)
                  .join(" | ")}
              </dd>
            </div>
          )}
        </dl>

        <p className="text-xs text-light-100/70">
          Your interviewer will ask about these. Only this summary is stored — the
          file itself is not kept.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          status === "error" ? "border-destructive-100/60" : "border-primary-200/40"
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) void upload(dropped);
        }}
      >
        <p className="text-sm text-light-100">
          Upload your resume and let your interviewer ask about your actual
          experience, projects and skills.
        </p>

        <label htmlFor="resume-file" className="sr-only">
          Choose a resume file
        </label>
        <input
          ref={inputRef}
          id="resume-file"
          type="file"
          accept={ACCEPTED_RESUME_EXTENSIONS.join(",")}
          disabled={status === "uploading"}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) void upload(chosen);
          }}
          className="sr-only"
        />

        <button
          type="button"
          disabled={status === "uploading"}
          onClick={() => inputRef.current?.click()}
          className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
        >
          {status === "uploading" ? "Analysing…" : "Upload resume"}
        </button>

        <p className="text-xs text-light-100/70">
          PDF, Word (.docx), or plain text (.txt). Maximum{" "}
          {Math.round(MAX_RESUME_BYTES / (1024 * 1024))} MB.
        </p>

        {status === "uploading" && fileName && (
          <p className="text-xs text-light-100" aria-live="polite">
            Reading {fileName}
            {fileSize ? ` (${formatFileSize(fileSize)})` : ""}… this takes a few seconds.
          </p>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-destructive-100">{error}</p>
          {lastFileRef.current && (
            <button
              type="button"
              onClick={() => {
                const file = lastFileRef.current;
                if (file) void upload(file);
              }}
              className="rounded-full bg-dark-200 px-4 py-1.5 text-xs text-primary-200"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;
