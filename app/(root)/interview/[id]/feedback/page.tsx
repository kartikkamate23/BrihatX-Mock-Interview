import dayjs from "dayjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import ScoreBar from "@/components/ScoreBar";
import ScoreRing from "@/components/ScoreRing";
import AttentionSummaryPanel from "@/components/AttentionSummaryPanel";
import ResumeFeedbackReport from "@/components/ResumeFeedbackReport";
import VisaFeedbackReport from "@/components/VisaFeedbackReport";
import { scoreBand } from "@/lib/score";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewTypeDefinition,
  resolveInterviewType,
} from "@/lib/interview-types";

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Both reads need only the authenticated user and interview id. Starting
  // them together removes a full Firestore round-trip from the normal path.
  const [interview, feedback] = await Promise.all([
    getInterviewById(id),
    getFeedbackByInterviewId({ interviewId: id, userId: user.id }),
  ]);
  if (!interview) redirect("/");

  // Reachable whenever scoring did not finish: the interview was abandoned, the
  // model call failed, or the user opened the URL directly. Rendering the normal
  // layout here printed an empty score next to "/100" and empty bullet lists,
  // which reads as a broken page rather than an interview that has no feedback.
  if (!feedback) {
    return (
      <section className="section-feedback">
        <div className="flex flex-row justify-center">
          <h1 className="text-4xl font-semibold">
            No feedback yet -{" "}
            <span className="capitalize">{interview.role}</span> Interview
          </h1>
        </div>

        <p className="text-center">
          This interview has not been scored. That happens when the call ended
          before anything was said, or when feedback generation failed. Your
          interview is still saved, so you can retake it to generate feedback.
        </p>

        <div className="buttons">
          <Button className="btn-secondary flex-1">
            <Link href="/" className="flex w-full justify-center">
              <p className="text-sm font-semibold text-primary-200 text-center">
                Back to dashboard
              </p>
            </Link>
          </Button>

          <Button className="btn-primary flex-1">
            <Link href={`/interview/${id}`} className="flex w-full justify-center">
              <p className="text-sm font-semibold text-black text-center">
                Retake Interview
              </p>
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  // The feedback document records its own type; the interview is the fallback
  // for records written before it did.
  const interviewType = resolveInterviewType(
    feedback.interviewType ?? interview.interviewType
  );
  const definition = getInterviewTypeDefinition(interviewType);
  const isVisa = interviewType === "visa";
  const isResume = interviewType === "resume";
  const subject = isVisa
    ? (interview.visaTypeLabel ?? interview.role)
    : interview.role;

  const band = scoreBand(feedback.totalScore);
  const session = feedback.session;
  const minutes = session ? Math.round(session.elapsedSeconds / 60) : null;

  return (
    <section className="section-feedback">
      {/* The score, the verdict and the headline assessment in one place, so
          the first screen answers "how did I do" before anything has to be
          scrolled. This page previously opened with the number set in a
          sentence, which gave no sense of where it sat in the range. */}
      <Panel className="animate-rise" innerClassName="p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          <ScoreRing score={feedback.totalScore} size={148} label="Overall" />

          <div className="flex min-w-0 flex-col gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant="accent">{definition.cardLabel}</Badge>
              <Badge
                variant={
                  band.tone === "strong"
                    ? "success"
                    : band.tone === "solid"
                      ? "accent"
                      : band.tone === "fair"
                        ? "warning"
                        : "danger"
                }
                dot
              >
                {band.label}
              </Badge>
              {session?.completedFullDuration && (
                <Badge variant="neutral">Ran the full length</Badge>
              )}
            </div>

            <h1 className="text-3xl font-semibold capitalize sm:text-4xl">
              {subject}
            </h1>

            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-light-100 sm:justify-start">
              <span>
                {feedback.createdAt
                  ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
                  : "Date unavailable"}
              </span>
              {minutes !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {minutes} min session
                  </span>
                </>
              )}
            </p>

            {feedback.finalAssessment && (
              <p className="text-base leading-7 text-light-100">
                {feedback.finalAssessment}
              </p>
            )}
          </div>
        </div>
      </Panel>

      {/* Every scored category as a proportion, so they can be compared at a
          glance rather than by reading four numbers out of four paragraphs. */}
      {feedback.categoryScores && feedback.categoryScores.length > 0 && (
        <Panel>
          <PanelHeader
            title={
              isVisa || isResume
                ? "Breakdown of your answers"
                : "Interview breakdown"
            }
            hint="Each category is scored out of 100."
          />
          <div className="flex flex-col gap-6">
            {feedback.categoryScores.map((category, index) => (
              <ScoreBar
                key={category.name}
                label={category.name}
                score={category.score}
                comment={category.comment}
                index={index}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* Recorded on every interview and, until now, never shown. */}
      {feedback.attention && (
        <AttentionSummaryPanel
          attention={feedback.attention}
          elapsedSeconds={session?.elapsedSeconds}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {feedback.strengths && feedback.strengths.length > 0 && (
          <Panel>
            <PanelHeader
              title="What worked"
              action={<Badge variant="success" dot>{feedback.strengths.length}</Badge>}
            />
            <ul className="flex list-none flex-col gap-3 p-0">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex gap-3 text-sm leading-6">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-success-100"
                  />
                  <span className="text-light-100">{strength}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {feedback.areasForImprovement &&
          feedback.areasForImprovement.length > 0 && (
            <Panel>
              <PanelHeader
                title="What to work on"
                action={
                  <Badge variant="warning" dot>
                    {feedback.areasForImprovement.length}
                  </Badge>
                }
              />
              <ul className="flex list-none flex-col gap-3 p-0">
                {feedback.areasForImprovement.map((area, index) => (
                  <li key={index} className="flex gap-3 text-sm leading-6">
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-warning-100"
                    />
                    <span className="text-light-100">{area}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
      </div>

      {isVisa && feedback.visa && <VisaFeedbackReport visa={feedback.visa} />}
      {isResume && feedback.resume && (
        <ResumeFeedbackReport resume={feedback.resume} />
      )}

      <div className="buttons">
        <Button className="btn-secondary flex-1">
          <Link href="/" className="flex w-full justify-center">
            <p className="text-sm font-semibold text-primary-200 text-center">
              Back to dashboard
            </p>
          </Link>
        </Button>

        <Button className="btn-primary flex-1">
          <Link
            href={`/interview/${id}`}
            className="flex w-full justify-center"
          >
            <p className="text-sm font-semibold text-black text-center">
              {isVisa ? "Practise again" : "Retake Interview"}
            </p>
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default Feedback;
