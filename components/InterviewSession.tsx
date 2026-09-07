"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import InterviewRoom from "@/components/InterviewRoom";
import type { InterviewAccess } from "@/lib/actions/plan.action";
import { getExperienceLevel, getInterviewer } from "@/lib/interview-config";
import type { InterviewType } from "@/lib/interview-types";
import { SESSION_LENGTHS } from "@/lib/plans";
import { getVisaMode } from "@/lib/visa";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
  userId: string;
  interviewId: string;
  interviewType: InterviewType;
  role: string;
  topics: string[];
  experienceLevel: string;
  interviewerId: string;
  savedDurationSeconds: number;
  resumeFileName?: string;
  visaTypeLabel?: string;
  destination?: string;
  visaMode?: string;
  profileImage?: string;
  access: InterviewAccess | null;
}

const InterviewSession = ({
  userName,
  interviewId,
  interviewType,
  role,
  topics,
  experienceLevel,
  interviewerId,
  savedDurationSeconds,
  resumeFileName,
  visaTypeLabel,
  destination,
  visaMode,
  profileImage,
  access,
}: Props) => {
  const allowed = useMemo(() => access?.allowedMinutes ?? [5], [access]);
  const savedMinutes = Math.round(savedDurationSeconds / 60);

  const [minutes, setMinutes] = useState<number>(() =>
    allowed.includes(savedMinutes) ? savedMinutes : (allowed[0] ?? 5)
  );
  const [termsAccepted, setTermsAccepted] = useState(interviewType === "communication");
  const [locked, setLocked] = useState(false);
  const searchParams = useSearchParams();

  const interviewer = getInterviewer(interviewerId);
  const level = getExperienceLevel(experienceLevel);
  const isVisa = interviewType === "visa";
  const isResume = interviewType === "resume";
  const isCommunication = interviewType === "communication";

  const devOverride =
    process.env.NODE_ENV !== "production"
      ? Number(searchParams.get("devDurationSeconds"))
      : NaN;
  const devDurationActive = Number.isFinite(devOverride) && devOverride > 0;
  const devDurationSeconds = devDurationActive
    ? Math.floor(devOverride)
    : undefined;

  const handleStateChange = useCallback((state: string) => {
    setLocked(state !== "idle" && state !== "failed");
  }, []);

  const outOfInterviews = access !== null && !access.canStart;

  if (outOfInterviews) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-dark-200 p-8 text-center">
        <h3 className="text-primary-100">No interviews left this month</h3>
        <p className="max-w-md text-sm text-light-100">
          {access?.reason ??
            "You have used all the interviews included in your plan."}
        </p>
        <Link href="/pricing" className="btn-primary px-6 py-2">
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!locked && !isCommunication && (
        <div className="interview-briefing flex flex-col gap-6 rounded-3xl p-5 sm:p-7">
          <div className="interview-stepper" aria-label="Interview progress">
            <span className="is-complete"><b>1</b> Configure</span>
            <span className="is-active"><b>2</b> Device check</span>
            <span><b>3</b> Live interview</span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-200">Real interview mode</p>
            <h2 className="mt-2 text-2xl text-white sm:text-3xl">Prepare your interview space</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-light-100">
              Your camera is checked continuously on this device. Keep one face visible,
              stay centered, use clear front lighting, and maintain eye contact with the camera.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isVisa ? (
              <>
                <span className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100">
                  {visaTypeLabel ?? role}
                </span>
                {destination && (
                  <span className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100">
                    Destination - {destination}
                  </span>
                )}
                <span className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100">
                  {getVisaMode(visaMode).label}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100">
                  {level.label}
                </span>
                <span className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100">
                  Interviewer - {interviewer.name}
                </span>
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-dark-200 px-3 py-1 text-xs text-light-100"
                  >
                    {topic}
                  </span>
                ))}
              </>
            )}
          </div>

          {isResume && (
            <div className="rounded-2xl border border-primary-200/40 bg-dark-200/60 p-4">
              <p className="text-xs font-semibold text-primary-200">
                Resume interview - Target: {role}
              </p>
              {resumeFileName && (
                <p className="mt-1 text-xs text-light-100">{resumeFileName}</p>
              )}
              <p className="mt-2 text-xs text-light-100">
                Your interviewer asks questions based on your experience,
                projects, skills and technologies, and on how they transfer to
                this role.
              </p>
            </div>
          )}

          {isVisa && (
            <p className="rounded-2xl border border-primary-200/40 bg-dark-200/60 p-4 text-xs text-light-100">
              This is a practice simulation. It is not connected to any embassy,
              consulate or government, and it cannot tell you whether a real visa
              application would succeed. Never give a real passport number,
              identification number or bank details.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <p className="text-sm text-light-100">Interview length</p>
            <div
              className="flex flex-wrap gap-3"
              role="group"
              aria-label="Interview length"
            >
              {SESSION_LENGTHS.map((option) => {
                const selected = option === minutes;
                const permitted = allowed.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={!permitted}
                    aria-pressed={selected}
                    title={
                      permitted
                        ? undefined
                        : `${option} minute sessions need a higher plan`
                    }
                    onClick={() => permitted && setMinutes(option)}
                    className={cn(
                      "rounded-full px-5 py-2 text-sm transition-colors",
                      selected && permitted
                        ? "bg-primary-200 font-semibold text-dark-100"
                        : "bg-dark-200 text-light-100",
                      !permitted && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {option} min{!permitted && " locked"}
                  </button>
                );
              })}
            </div>
            <p className="max-w-xl text-xs text-light-100">
              The session runs for the full time you pick.{" "}
              {isVisa ? "The officer" : interviewer.name} decides how many
              questions fit and asks follow-ups as the conversation goes; it does
              not stop after a set number of questions.
            </p>
            {devDurationActive && (
              <p className="text-xs text-destructive-100">
                Development override active: this session will run for{" "}
                {devDurationSeconds} seconds.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Strict camera requirements">
            {[
              ["One person only", "A second face triggers an immediate high warning."],
              ["Face always visible", "Leaving the frame or covering your face is flagged."],
              ["Look at the camera", "Repeated head turns and off-camera gaze are recorded."],
              ["Clear lighting", "Dark or unclear video triggers a visibility warning."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <span className="mb-3 flex size-7 items-center justify-center rounded-full bg-primary-200/15 text-xs font-black text-primary-200">✓</span>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-light-100/75">{description}</p>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 text-sm text-light-100">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-1 size-4 accent-primary-200"
            />
            <span>
              I understand this is a timed mock interview. My camera must remain
              on, my answers will be transcribed and scored, and strict face,
              visibility, and gaze checks run locally in my browser. No camera
              video is recorded or uploaded.
            </span>
          </label>

          {access && (
            <p className="text-xs text-light-100">
              {access.planName} plan
              {access.limit === null
                ? " - unlimited interviews"
                : ` - ${access.remaining} of ${access.limit} interviews left this month`}
            </p>
          )}
        </div>
      )}

      <InterviewRoom
        userName={userName}
        interviewId={interviewId}
        role={role}
        interviewerName={isVisa ? "Visa Officer" : interviewer.name}
        profileImage={profileImage}
        requestedDurationSeconds={minutes * 60}
        devDurationSeconds={devDurationSeconds}
        startDisabled={!termsAccepted}
        startDisabledReason="Accept the interview terms above to start."
        onStateChange={handleStateChange}
      />
    </div>
  );
};

export default InterviewSession;
