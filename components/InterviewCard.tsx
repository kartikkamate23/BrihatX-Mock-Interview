import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { memo } from "react";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";
import InterviewIcon from "./InterviewIcon";
import { Badge } from "./ui/badge";

import { cn } from "@/lib/utils";
import { clampScore, scoreBand } from "@/lib/score";
import { getInterviewTypeDefinition, resolveInterviewType } from "@/lib/interview-types";

/**
 * One interview in the dashboard list.
 *
 * The icon is derived from the interview's own type and role category rather
 * than picked at render time. The previous version called
 * `getRandomInterviewCover()` -- `Math.random()` -- here, so every render and
 * every refresh showed a different company logo for the same interview, and a
 * visa interview could be illustrated with a Spotify badge. See lib/icons.ts.
 *
 * This is a server component and receives its feedback already resolved: doing
 * the lookup per card meant one Firestore round-trip per card, and the list
 * page can fetch them together.
 */
const InterviewCard = ({
  interviewId,
  role,
  type,
  techstack,
  createdAt,
  interviewType,
  roleCategory,
  iconKey,
  visaTypeLabel,
  resumeFileName,
  score,
  finalAssessment,
  feedbackCreatedAt,
  hasFeedback,
  durationSeconds,
  elapsedSeconds,
  status,
  questionsAnswered,
}: InterviewCardProps) => {
  const resolvedType = resolveInterviewType(interviewType);
  const definition = getInterviewTypeDefinition(resolvedType);
  const isVisa = resolvedType === "visa";
  const isResume = resolvedType === "resume";

  // Visa interviews are labelled by category, not by a "type" that would read as
  // a technical discipline.
  const badgeLabel = isVisa
    ? "Visa"
    : isResume
      ? "Resume"
      : resolvedType === "communication"
        ? "Communication"
        : /mix/gi.test(type)
          ? "Mixed"
          : type;

  const badgeColor = isVisa || isResume
    ? "bg-light-400"
    : ({
        Behavioral: "bg-light-400",
        Mixed: "bg-light-600",
        Technical: "bg-light-800",
        Communication: "bg-light-400",
      }[badgeLabel] ?? "bg-light-600");

  // The model returns a raw number, and it is not always a whole one -- a card
  // was rendering "32.4/100". Scores are banded and rounded in exactly one
  // place so the card, the report ring and the dashboard average never
  // disagree about the same interview.
  const shownScore = typeof score === "number" ? clampScore(score) : null;
  const band = shownScore !== null ? scoreBand(shownScore) : null;

  const statusLabel = status === "processing"
      ? "Processing feedback"
      : status === "in_progress" || status === "active"
        ? "In progress"
        : status === "incomplete"
          ? "Incomplete"
          : hasFeedback || status === "completed"
            ? "Completed"
            : "Ready";
  const hasCurrentAttempt =
    status === "in_progress" ||
    status === "active" ||
    status === "processing" ||
    status === "incomplete";
  const dateValue = hasCurrentAttempt ? createdAt : (feedbackCreatedAt || createdAt);
  const formattedDate = dateValue ? dayjs(dateValue).format("MMM D, YYYY") : "Date unavailable";

  const heading = isVisa
    ? (visaTypeLabel ?? role)
    : `${role} Interview`;
  const shownDuration = elapsedSeconds && elapsedSeconds > 0 ? elapsedSeconds : durationSeconds;
  const durationLabel = shownDuration
    ? `${Math.max(1, Math.round(shownDuration / 60))} min${statusLabel === "Ready" ? " planned" : ""}`
    : "Duration unavailable";

  return (
    <article className="card-border lift-on-hover min-h-96 !w-full">
      <div className="card-interview">
        <div>
          <div
            className={cn(
              "absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg",
              badgeColor
            )}
          >
            <p className="badge-text">{badgeLabel}</p>
          </div>

          <InterviewIcon
            interview={{
              interviewType: resolvedType,
              role,
              roleCategory,
              iconKey,
            }}
            size={30}
          />

          {/* Visa interviews say what they are, because "F1 Student Visa
              Interview" alone does not read as a category the way a job title
              does. */}
          {(isVisa || isResume) && (
            <p className="mt-4 text-xs uppercase tracking-wide text-primary-200">
              {definition.cardLabel}
            </p>
          )}

          <h3 className={cn("capitalize", isVisa || isResume ? "mt-1" : "mt-5")}>
            {isResume ? `Target: ${role}` : heading}
          </h3>

          <div className="flex flex-row gap-5 mt-3">
            <div className="flex flex-row gap-2">
              <Image src="/calendar.svg" width={22} height={22} alt="" aria-hidden />
              <p>{formattedDate}</p>
            </div>

            <div className="flex flex-row gap-2 items-center">
              <Image src="/star.svg" width={22} height={22} alt="" aria-hidden />
              <p className={cn(band?.text)}>
                {shownScore ?? "---"}/100
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-light-100">
            <span className="rounded-full bg-white/5 px-2.5 py-1">{durationLabel}</span>
            <Badge
              variant={statusLabel === "Completed" ? "success" : statusLabel === "In progress" || statusLabel === "Processing feedback" ? "accent" : statusLabel === "Incomplete" ? "warning" : "neutral"}
              size="sm"
              dot
            >
              {statusLabel}
            </Badge>
            {typeof questionsAnswered === "number" && questionsAnswered > 0 && (
              <span className="rounded-full bg-white/5 px-2.5 py-1">
                {questionsAnswered} answered
              </span>
            )}
          </div>

          <p className="line-clamp-2 mt-5">
            {finalAssessment
              ? `${hasCurrentAttempt ? "Previous feedback: " : ""}${finalAssessment}`
              : "You haven't taken this interview yet. Take it now to improve your skills."}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* A visa interview has no tech stack, and rendering an empty row
              leaves the button floating on its own. */}
          {isVisa ? (
            <span className="text-xs text-light-100">Practice simulation</span>
          ) : isResume ? (
            <span className="truncate text-xs text-light-100" title={resumeFileName}>
              {resumeFileName ?? "From your resume"}
            </span>
          ) : (
            <DisplayTechIcons techStack={techstack} />
          )}

          <div className="flex flex-wrap gap-2">
            {hasFeedback && statusLabel !== "Completed" && (
              <Button asChild className="btn-secondary"><Link href={`/interview/${interviewId}/feedback`}>View previous feedback</Link></Button>
            )}
            {hasFeedback && statusLabel === "Completed" && (
              <Button asChild className="btn-secondary"><Link href={`/interview/${interviewId}`}>Retry</Link></Button>
            )}
            {statusLabel === "Processing feedback" ? (
              <span className="rounded-full bg-dark-200 px-4 py-2 text-xs text-light-100" role="status">
                Feedback is being prepared
              </span>
            ) : (
              <Button asChild className="btn-primary"><Link href={hasFeedback && statusLabel === "Completed" ? `/interview/${interviewId}/feedback` : `/interview/${interviewId}`}>{hasFeedback && statusLabel === "Completed" ? "View Feedback" : statusLabel === "In progress" ? "Continue" : statusLabel === "Incomplete" ? "Retry" : "Start"}</Link></Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default memo(InterviewCard);
