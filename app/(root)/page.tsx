import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, FileText, MessageCircle, Plane } from "lucide-react";

import InterviewList from "@/components/InterviewList";
import PracticeStats from "@/components/PracticeStats";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getDashboardSessionData,
  getFeedbackForInterviews,
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";
import { getInterviewAccess } from "@/lib/actions/plan.action";

/** Join each record to its feedback once, avoiding per-card Firestore reads. */
function toSummaries(
  interviews: Interview[],
  feedback: Record<string, Feedback>,
  sessions: Awaited<ReturnType<typeof getDashboardSessionData>>["byInterview"] = {}
): InterviewSummary[] {
  return interviews.map((interview) => {
    const result = feedback[interview.id];
    const session = sessions[interview.id];
    return {
      id: interview.id,
      role: interview.role,
      type: interview.type,
      techstack: interview.techstack ?? [],
      createdAt: session?.startedAt || interview.createdAt,
      interviewType: interview.interviewType,
      roleCategory: interview.roleCategory,
      iconKey: interview.iconKey,
      visaTypeLabel: interview.visaTypeLabel,
      resumeFileName: interview.resumeFileName,
      score: result?.totalScore,
      finalAssessment: result?.finalAssessment,
      feedbackCreatedAt: result?.createdAt,
      hasFeedback: Boolean(result),
      durationSeconds: interview.durationSeconds,
      elapsedSeconds: session?.elapsedSeconds ?? result?.session?.elapsedSeconds,
      // The latest session wins over older feedback. A candidate who begins a
      // retake should see "Continue", while the previous report stays linked.
      status: session?.status ?? (result ? "completed" : interview.status),
      questionsAnswered: session?.questionsAnswered,
      categoryScores: result?.categoryScores,
    };
  });
}

async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [userInterviews, allInterviews, access, sessionData] = await Promise.all([
    getInterviewsByUserId(user.id),
    getLatestInterviews({ userId: user.id }),
    getInterviewAccess(),
    getDashboardSessionData(),
  ]);
  const mine = userInterviews ?? [];
  const others = allInterviews ?? [];
  const mineById = new Map(mine.map((interview) => [interview.id, interview]));
  for (const interview of sessionData.interviews) mineById.set(interview.id, interview);
  const history = [...mineById.values()].sort((a, b) =>
    String(sessionData.byInterview[b.id]?.startedAt ?? b.createdAt ?? "").localeCompare(
      String(sessionData.byInterview[a.id]?.startedAt ?? a.createdAt ?? "")
    )
  );
  const feedback = await getFeedbackForInterviews({
    userId: user.id,
    interviewIds: history.map((interview) => interview.id),
  });
  const mySummaries = toSummaries(history, feedback, sessionData.byInterview);
  const historyIds = new Set(history.map((interview) => interview.id));
  const firstName = user.name?.trim().split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <section className="dashboard-hero animate-rise" aria-labelledby="dashboard-welcome">
        <div className="relative z-10 flex max-w-2xl flex-col gap-5">
          <p className="text-sm font-medium text-primary-200">Your practice command centre</p>
          <div>
            <h1 id="dashboard-welcome" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {greeting}, {firstName} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-3 text-base sm:text-lg">Ready for your next interview?</p>
          </div>
          {access && (
            <p className="text-sm text-light-100">
              <span className="font-medium text-primary-200">{access.planName}</span> plan ·{" "}
              {access.limit === null ? "unlimited interviews" : `${access.remaining} of ${access.limit} interviews left this month`} · sessions up to {Math.max(...access.allowedMinutes)} min ·{" "}
              <Link href="/pricing" className="underline underline-offset-4 hover:text-white">See plans</Link>
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="btn-primary max-sm:w-full">
              <Link href="/interview">Start New Interview <ArrowRight aria-hidden /></Link>
            </Button>
            <Button asChild className="btn-secondary max-sm:w-full">
              <Link href="/interview?type=resume"><FileText aria-hidden /> Practice From Resume</Link>
            </Button>
          </div>
        </div>
        <div className="dashboard-orb" aria-hidden />
      </section>

      {mySummaries.length === 0 ? (
        <section className="empty-dashboard animate-rise" aria-labelledby="empty-dashboard-title">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Performance overview</p>
            <h2 id="empty-dashboard-title" className="mt-2">No interviews yet</h2>
            <p className="mt-2 max-w-xl text-sm">Complete your first practice session to unlock real scores, activity, and skill analytics.</p>
          </div>
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start your first interview <ArrowRight aria-hidden /></Link>
          </Button>
        </section>
      ) : (
        <PracticeStats interviews={mySummaries} access={access} sessionStats={sessionData.stats} />
      )}

      <section aria-labelledby="quick-practice-heading" className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Choose a focus</p>
          <h2 id="quick-practice-heading" className="mt-1">Quick Practice</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          <QuickPractice href="/interview?type=technical" title="Job Interview" description="Role-specific technical and behavioural practice." icon={<BriefcaseBusiness />} />
          <QuickPractice href="/interview?type=resume" title="Resume Interview" description="Build questions from your actual experience." icon={<FileText />} />
          <QuickPractice href="/interview?type=communication" title="Communication Practice" description="Improve clarity, structure, and confidence." icon={<MessageCircle />} />
          <QuickPractice href="/interview?type=visa" title="Visa Interview" description="Practise a realistic officer conversation." icon={<Plane />} />
        </div>
      </section>

      <section id="interviews" className="flex scroll-mt-28 flex-col gap-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Your history</p>
            <h2 className="mt-1">Recent Interviews</h2>
          </div>
          <p className="text-sm">Review feedback, continue a session, or practise again.</p>
        </div>
        <InterviewList interviews={mySummaries} emptyMessage="You haven't taken any interviews yet." />
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Community library</p>
          <h2 className="mt-1">More Interviews</h2>
        </div>
        <InterviewList interviews={toSummaries(others.filter((interview) => !historyIds.has(interview.id)), {})} emptyMessage="There are no interviews available." />
      </section>
    </>
  );
}

function QuickPractice({ href, title, description, icon }: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="quick-practice-card group" aria-label={`${title}: ${description}`}>
      <span className="quick-practice-icon" aria-hidden>{icon}</span>
      <span className="font-semibold text-white">{title}</span>
      <span className="text-sm leading-5 text-light-100">{description}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-200">
        Set up practice <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default Home;
