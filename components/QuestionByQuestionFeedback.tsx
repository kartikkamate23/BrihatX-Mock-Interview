import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";

interface Props {
  reviews: QuestionReview[];
}

function scoreVariant(score: number): "success" | "accent" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 65) return "accent";
  if (score >= 45) return "warning";
  return "danger";
}

export default function QuestionByQuestionFeedback({ reviews }: Props) {
  if (reviews.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="Question-by-question review"
        hint="Open each question to compare your response with specific coaching and a stronger example answer."
        action={<Badge variant="accent">{reviews.length} questions</Badge>}
      />

      <div className="space-y-3">
        {reviews.map((review, index) => {
          const score = Math.max(0, Math.min(100, Math.round(review.score)));
          return (
            <details
              key={`${index}-${review.question}`}
              open={index === 0}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 open:border-primary-200/25 open:bg-primary-200/[0.025]"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-200 [&::-webkit-details-marker]:hidden sm:px-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-200/10 text-xs font-bold text-primary-200">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-white">
                  {review.question}
                </span>
                <Badge variant={scoreVariant(score)}>{score}/100</Badge>
                <ChevronDown className="size-4 shrink-0 text-light-100 transition-transform group-open:rotate-180" aria-hidden />
              </summary>

              <div className="space-y-5 border-t border-white/10 p-4 sm:p-5">
                <ReviewBlock
                  icon={<UserRound />}
                  eyebrow="Your answer"
                  className="border-white/10 bg-white/[0.025]"
                >
                  <blockquote className="text-sm leading-7 text-light-100">
                    “{review.candidateAnswer}”
                  </blockquote>
                </ReviewBlock>

                {review.whatWasGood.length > 0 && (
                  <ReviewBlock
                    icon={<CheckCircle2 />}
                    eyebrow="What worked"
                    className="border-success-100/20 bg-success-100/[0.035]"
                    iconClassName="text-success-100"
                  >
                    <FeedbackList items={review.whatWasGood} dotClassName="bg-success-100" />
                  </ReviewBlock>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <ReviewBlock
                    icon={<CircleAlert />}
                    eyebrow="Mistakes and gaps"
                    className="border-destructive-100/20 bg-destructive-100/[0.035]"
                    iconClassName="text-destructive-100"
                  >
                    {review.mistakes.length > 0 ? (
                      <FeedbackList items={review.mistakes} dotClassName="bg-destructive-100" />
                    ) : (
                      <p className="text-sm text-light-100">No major mistake was identified in this answer.</p>
                    )}
                  </ReviewBlock>

                  <ReviewBlock
                    icon={<Wrench />}
                    eyebrow="How to improve"
                    className="border-warning-100/20 bg-warning-100/[0.035]"
                    iconClassName="text-warning-100"
                  >
                    <FeedbackList items={review.howToImprove} dotClassName="bg-warning-100" />
                  </ReviewBlock>
                </div>

                <ReviewBlock
                  icon={<Sparkles />}
                  eyebrow="Improved answer"
                  className="border-primary-200/30 bg-gradient-to-br from-primary-200/[0.09] to-[#00c9f2]/[0.035]"
                  iconClassName="text-primary-200"
                >
                  <p className="text-sm leading-7 text-primary-100">
                    {review.improvedAnswer}
                  </p>
                </ReviewBlock>
              </div>
            </details>
          );
        })}
      </div>
    </Panel>
  );
}

function ReviewBlock({
  icon,
  eyebrow,
  className,
  iconClassName = "text-primary-200",
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  className: string;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`[&_svg]:size-4 ${iconClassName}`} aria-hidden>{icon}</span>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">{eyebrow}</h4>
      </div>
      {children}
    </section>
  );
}

function FeedbackList({ items, dotClassName }: { items: string[]; dotClassName: string }) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-6 text-light-100">
          <span className={`mt-2.5 size-1.5 shrink-0 rounded-full ${dotClassName}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
