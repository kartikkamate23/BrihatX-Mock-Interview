"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import Link from "next/link";

import InterviewCard from "@/components/InterviewCard";
import {
  INTERVIEW_TYPE_DEFINITIONS,
  resolveInterviewType,
} from "@/lib/interview-types";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | "technical" | "resume" | "communication" | "visa";
type StatusFilter = "all" | "completed" | "in-progress" | "incomplete" | "ready";
type SortKey = "newest" | "oldest" | "highest" | "lowest";

interface Props {
  interviews: InterviewSummary[];
  /** Shown when the list is empty before any filtering. */
  emptyMessage: string;
}

const TYPE_FILTERS: [TypeFilter, string][] = [
  ["all", "All"],
  ["technical", "Job"],
  ["resume", "Resume"],
  ["communication", "Communication"],
  ["visa", "Visa"],
];

const STATUS_FILTERS: [StatusFilter, string][] = [
  ["all", "Any status"],
  ["completed", "Completed"],
  ["in-progress", "In progress"],
  ["incomplete", "Incomplete"],
  ["ready", "Ready"],
];

const SORTS: [SortKey, string][] = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["highest", "Highest score"],
  ["lowest", "Lowest score"],
];

/**
 * The dashboard's interview list, with filtering and sorting.
 *
 * A client component wrapping server-rendered data rather than a set of server
 * round-trips: the whole list is already loaded, so filtering it is a local
 * array operation and changing a filter should not cost a request.
 *
 * "Completed" means the interview has feedback. That is the only durable signal
 * the record carries about whether it was actually taken, and it is the same
 * thing the card's own button already keys off.
 */
const InterviewList = ({ interviews, emptyMessage }: Props) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [role, setRole] = useState("");
  const deferredRole = useDeferredValue(role);
  const controlId = useId();
  const hasActiveFilters =
    typeFilter !== "all" || statusFilter !== "all" || role.trim().length > 0;

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setRole("");
    setSort("newest");
  };

  const visible = useMemo(() => {
    const query = deferredRole.trim().toLowerCase();

    const filtered = interviews.filter((interview) => {
      if (
        typeFilter !== "all" &&
        resolveInterviewType(interview.interviewType) !== typeFilter
      ) {
        return false;
      }
      const status = interview.status ?? (interview.hasFeedback ? "completed" : "ready");
      if (statusFilter === "completed" && status !== "completed") return false;
      if (statusFilter === "in-progress" && status !== "in_progress" && status !== "processing") return false;
      if (statusFilter === "incomplete" && status !== "incomplete") return false;
      if (statusFilter === "ready" && status !== "ready") return false;
      if (query && !interview.role.toLowerCase().includes(query)) return false;
      return true;
    });

    // Copied before sorting: `interviews` is a prop, and sorting in place would
    // mutate the parent's array.
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
        case "highest":
          // Unscored interviews sort last in both score orders: they have no
          // score, and treating that as zero would bury real low scores under
          // interviews that were never taken.
          if (a.score === undefined) return b.score === undefined ? 0 : 1;
          if (b.score === undefined) return -1;
          return b.score - a.score;
        case "lowest":
          if (a.score === undefined) return b.score === undefined ? 0 : 1;
          if (b.score === undefined) return -1;
          return a.score - b.score;
        case "newest":
        default:
          return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
      }
    });
  }, [interviews, typeFilter, statusFilter, sort, deferredRole]);

  const counts = useMemo(
    () =>
      interviews.reduce<Record<string, number>>((acc, interview) => {
        const key = resolveInterviewType(interview.interviewType);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    [interviews]
  );

  if (interviews.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <p className="text-sm text-light-100">{emptyMessage}</p>
        <Link href="/interview" className="text-sm font-semibold text-primary-200 underline underline-offset-4">
          Set up an interview
        </Link>
      </div>
    );
  }

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-4 py-1.5 text-xs transition-colors",
      active ? "bg-primary-200 font-semibold text-dark-100" : "bg-dark-200 text-light-100"
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          {TYPE_FILTERS.map(([id, label]) => {
            const count =
              id === "all" ? interviews.length : (counts[id] ?? 0);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={typeFilter === id}
                onClick={() => setTypeFilter(id)}
                className={pill(typeFilter === id)}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={statusFilter === id}
              onClick={() => setStatusFilter(id)}
              className={pill(statusFilter === id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <label htmlFor={`${controlId}-role-filter`} className="sr-only">
            Filter by role
          </label>
          <input
            id={`${controlId}-role-filter`}
            type="search"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Filter by role…"
            className="min-h-10 w-full rounded-full bg-dark-200 px-4 py-1.5 text-xs text-white placeholder:text-light-100/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:w-44"
          />

          <label htmlFor={`${controlId}-sort`} className="sr-only">
            Sort interviews
          </label>
          <select
            id={`${controlId}-sort`}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="min-h-10 w-full rounded-full bg-dark-200 px-4 py-1.5 text-xs text-light-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:w-auto"
          >
            {SORTS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-light-100" aria-live="polite">
        Showing {visible.length} of {interviews.length} interviews
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-sm text-light-100">
            No interviews match these filters.{" "}
            {typeFilter !== "all" &&
              `You have no ${INTERVIEW_TYPE_DEFINITIONS[typeFilter].label.toLowerCase()} in this view.`}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full bg-dark-200 px-4 py-2 text-sm font-semibold text-primary-200 hover:bg-dark-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="interviews-section stagger-children">
          {visible.map((interview) => (
            <InterviewCard
              key={interview.id}
              interviewId={interview.id}
              role={interview.role}
              type={interview.type}
              techstack={interview.techstack}
              createdAt={interview.createdAt}
              interviewType={interview.interviewType}
              roleCategory={interview.roleCategory}
              iconKey={interview.iconKey}
              visaTypeLabel={interview.visaTypeLabel}
              resumeFileName={interview.resumeFileName}
              score={interview.score}
              finalAssessment={interview.finalAssessment}
              feedbackCreatedAt={interview.feedbackCreatedAt}
              hasFeedback={interview.hasFeedback}
              durationSeconds={interview.durationSeconds}
              elapsedSeconds={interview.elapsedSeconds}
              status={interview.status}
              questionsAnswered={interview.questionsAnswered}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default InterviewList;
