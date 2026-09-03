import Link from "next/link";
import { Activity, Award, CalendarDays, Clock3, Target, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { InterviewAccess } from "@/lib/actions/plan.action";
import { averageScore, clampScore, scoreBand } from "@/lib/score";

interface Props {
  interviews: InterviewSummary[];
  access: InterviewAccess | null;
  sessionStats: {
    totalInterviews: number;
    completedInterviews: number;
    practiceSeconds: number;
    questionsAnswered: number;
  };
}
const DAY_MS = 86_400_000;

function dateKey(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function currentStreak(interviews: InterviewSummary[]) {
  const days = [...new Set(interviews.map((item) => dateKey(item.feedbackCreatedAt)).filter((day): day is number => day !== null))].sort((a, b) => b - a);
  if (!days.length) return 0;
  const today = dateKey(new Date().toISOString())!;
  if (today - days[0] > DAY_MS) return 0;
  let streak = 1;
  for (let index = 1; index < days.length && days[index - 1] - days[index] === DAY_MS; index += 1) streak += 1;
  return streak;
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const PracticeStats = ({ interviews, access, sessionStats }: Props) => {
  const scored = interviews.filter((interview) => interview.hasFeedback);
  const average = averageScore(scored.map((interview) => interview.score));
  const best = scored.reduce((max, interview) => Math.max(max, interview.score ?? 0), 0);
  const streak = currentStreak(scored);
  const progression = [...scored].reverse().slice(-8);
  const latestScore = progression.at(-1)?.score;
  const previousScore = progression.at(-2)?.score;
  const scoreChange =
    typeof latestScore === "number" && typeof previousScore === "number"
      ? clampScore(latestScore) - clampScore(previousScore)
      : null;
  const categoryMap = new Map<string, number[]>();
  scored.forEach((interview) => interview.categoryScores?.forEach(({ name, score }) => {
    const values = categoryMap.get(name) ?? [];
    values.push(score);
    categoryMap.set(name, values);
  }));
  const categories = [...categoryMap]
    .map(([name, scores]) => ({ name, score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) }))
    .sort((a, b) => b.score - a.score);

  return (
    <section aria-labelledby="practice-stats-heading" className="flex flex-col gap-5 animate-rise">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Real session data</p><h2 id="practice-stats-heading" className="mt-1">Performance Overview</h2></div>
        {access && <Badge variant="accent">{access.planName} plan</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 stagger-children">
        <Stat icon={<Activity />} label="Total interviews" value={String(sessionStats.totalInterviews)} hint={`${sessionStats.completedInterviews} completed`} />
        <Stat icon={<Target />} label="Average score" value={average === null ? "—" : String(average)} hint={average === null ? "No scores yet" : scoreBand(average).label} />
        <Stat icon={<Trophy />} label="Best score" value={scored.length ? String(clampScore(best)) : "—"} hint="out of 100" />
        <Stat icon={<Clock3 />} label="Practice time" value={sessionStats.practiceSeconds ? formatTime(sessionStats.practiceSeconds) : "—"} hint="across real sessions" />
        <Stat icon={<Award />} label="Questions answered" value={String(sessionStats.questionsAnswered)} hint="saved candidate responses" />
        <Stat icon={<CalendarDays />} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} hint="based on completion dates" />
      </div>
      {scored.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Panel innerClassName="p-5 sm:p-6">
            <PanelHeader
              title="Score progression"
              hint={`Oldest to newest across your last ${progression.length} scored interview${progression.length === 1 ? "" : "s"}`}
              action={scoreChange !== null ? <Badge variant={scoreChange >= 0 ? "success" : "warning"}>{scoreChange >= 0 ? "+" : ""}{scoreChange} latest</Badge> : undefined}
            />
            <div className="flex h-44 items-end gap-2" role="img" aria-label={`Score progression: ${progression.map((item) => clampScore(item.score ?? 0)).join(", ")}`}>
              {progression.map((item) => { const score = clampScore(item.score ?? 0); return (
                <div key={item.id} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-medium tabular-nums text-light-100">{score}</span>
                  <span className="analytics-column animate-bar-fill" style={{ height: `${Math.max(score, 4)}%` }} title={`${item.role}: ${score}/100`} />
                  <span className="w-full truncate text-center text-[10px] text-light-100" title={item.role}>{item.role}</span>
                </div>
              ); })}
            </div>
          </Panel>
          <Panel innerClassName="p-5 sm:p-6">
            <PanelHeader title="Skill performance" hint="Average category scores from saved feedback" />
            {categories.length ? <div className="space-y-4">{categories.map((category) => (
              <div key={category.name}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate text-light-100">{category.name}</span><span className="font-semibold tabular-nums text-white">{category.score}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-dark-200"><div className="h-full origin-left rounded-full bg-gradient-to-r from-[#8b82ff] to-[#cac5fe] animate-bar-fill" style={{ width: `${clampScore(category.score)}%` }} /></div>
              </div>
            ))}</div> : <p className="text-sm">Category details are not available on these feedback records.</p>}
          </Panel>
        </div>
      )}
      {!scored.length && <Panel innerClassName="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><p className="font-medium text-white">Your analytics are ready when you are.</p><p className="text-sm">Complete an interview to reveal score progression and skill performance.</p></div><Link href="/interview" className="text-sm font-semibold text-primary-200 underline underline-offset-4">Start an interview</Link></Panel>}
    </section>
  );
};

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <Panel innerClassName="flex min-h-36 flex-col justify-between gap-2 p-4"><span className="text-primary-200 [&_svg]:size-4" aria-hidden>{icon}</span><div><p className="text-xs text-light-100">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p></div><p className="text-[11px] text-light-100">{hint}</p></Panel>;
}

export default PracticeStats;
