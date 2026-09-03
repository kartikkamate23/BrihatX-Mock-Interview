"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  Globe2,
  Headphones,
  LockKeyhole,
  MessageCircleMore,
  Mic2,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import ResumeUpload, { type AnalysedResume } from "@/components/ResumeUpload";
import RoleSelector from "@/components/RoleSelector";
import { createInterviewFromSetup } from "@/lib/actions/session.action";
import type { InterviewAccess } from "@/lib/actions/plan.action";
import {
  DEFAULT_EXPERIENCE_LEVEL,
  DEFAULT_INTERVIEWER_ID,
  EXPERIENCE_LEVELS,
  INTERVIEWERS,
  MAX_TOPICS,
  validateSetup,
} from "@/lib/interview-config";
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_DEFINITIONS,
  type InterviewType,
} from "@/lib/interview-types";
import { SESSION_LENGTHS } from "@/lib/plans";
import { suggestedTopicsForRole } from "@/lib/roles";
import {
  CUSTOM_VISA_CATEGORY_ID,
  DEFAULT_VISA_CATEGORY_ID,
  DEFAULT_VISA_MODE_ID,
  VISA_CATEGORIES,
  VISA_MODES,
  getVisaCategory,
  resolveVisaTypeLabel,
  validateVisaSetup,
  type VisaDetailField,
} from "@/lib/visa";
import { cn } from "@/lib/utils";

interface Props {
  access: InterviewAccess | null;
  initialType?: InterviewType;
}

/** Labels and placeholders for the optional context a visa officer can probe. */
const DETAIL_LABELS: Record<VisaDetailField, { label: string; placeholder: string }> = {
  destination: { label: "Destination country", placeholder: "e.g. United States" },
  university: { label: "University or institution", placeholder: "e.g. Arizona State University" },
  course: { label: "Course or programme", placeholder: "e.g. MS in Computer Science" },
  employer: { label: "Employer", placeholder: "e.g. Infosys" },
  jobTitle: { label: "Job title", placeholder: "e.g. Systems Engineer" },
  sponsor: { label: "Who is funding the trip", placeholder: "e.g. My father, and a partial scholarship" },
  purpose: { label: "Purpose of travel", placeholder: "e.g. Two-week holiday" },
  duration: { label: "Intended length of stay", placeholder: "e.g. About 3 weeks" },
  relationship: { label: "Relationship to the primary applicant", placeholder: "e.g. Spouse" },
  event: { label: "Event or programme", placeholder: "e.g. Summer research exchange" },
};

const TYPE_PRESENTATION: Record<InterviewType, { badge: string; icon: typeof Code2 }> = {
  technical: { badge: "Career", icon: BriefcaseBusiness },
  resume: { badge: "Personalised", icon: FileText },
  communication: { badge: "Soft skills", icon: MessageCircleMore },
  visa: { badge: "Simulation", icon: Globe2 },
};

const EXPERIENCE_EXPECTATIONS: Record<string, string> = {
  entry: "Fundamentals, learning mindset and clear problem solving.",
  junior: "Practical delivery, debugging and growing ownership.",
  intermediate: "Trade-offs, production decisions and end-to-end ownership.",
  senior: "Architecture, leadership, scale and deep technical judgment.",
};

const INTERVIEWER_DIFFICULTY: Record<string, string> = {
  tanya: "Hard",
  rohan: "Expert",
  aisha: "Medium",
  daniel: "Expert",
};

const DURATION_DETAILS: Record<number, { questions: string; style: string }> = {
  5: { questions: "~3–5 questions", style: "Focused warm-up" },
  10: { questions: "~5–8 questions", style: "Balanced mock interview" },
  15: { questions: "~8–12 questions", style: "In-depth practice" },
};

/**
 * Interview setup.
 *
 * One wizard, three interview types. The first step picks the type and the
 * remaining steps are derived from it, so a visa interview never walks through
 * "choose your experience level" and a job interview never asks for a visa
 * category. Everything chosen here is re-validated server-side before an
 * interview is written -- most importantly the duration, which the plan clamps
 * regardless of what this component allows.
 */
const InterviewSetupWizard = ({ access, initialType = "technical" }: Props) => {
  const router = useRouter();
  const allowedMinutes = useMemo(() => access?.allowedMinutes ?? [5], [access]);

  const [step, setStep] = useState(0);
  const [interviewType, setInterviewType] = useState<InterviewType>(initialType);

  // Role-based setup.
  const [role, setRole] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<string>(DEFAULT_EXPERIENCE_LEVEL);
  const [interviewerId, setInterviewerId] = useState<string>(DEFAULT_INTERVIEWER_ID);

  // Visa setup.
  const [visaTypeId, setVisaTypeId] = useState<string>(DEFAULT_VISA_CATEGORY_ID);
  const [customVisaType, setCustomVisaType] = useState("");
  const [visaModeId, setVisaModeId] = useState<string>(DEFAULT_VISA_MODE_ID);
  const [destination, setDestination] = useState("");
  const [visaDetails, setVisaDetails] = useState<Record<string, string>>({});

  // Resume setup.
  const [resume, setResume] = useState<AnalysedResume | null>(null);

  const [durationMinutes, setDurationMinutes] = useState<number>(allowedMinutes[0] ?? 5);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const confirmTriggerRef = useRef<HTMLButtonElement>(null);

  const isVisa = interviewType === "visa";
  const isResume = interviewType === "resume";
  const visaCategory = getVisaCategory(visaTypeId);

  const steps = isVisa
    ? (["Type", "Visa", "Officer", "Details", "Duration", "Terms"] as const)
    : isResume
      ? (["Type", "Resume", "Role", "Topics", "Experience", "Interviewer", "Duration", "Terms"] as const)
      : (["Type", "Role", "Topics", "Experience", "Interviewer", "Duration", "Terms"] as const);

  const roleValidation = validateSetup(
    { role, topics, experienceLevel, interviewerId, durationMinutes },
    { termsAccepted }
  );
  const visaValidation = validateVisaSetup(
    { visaTypeId, customVisaType, visaModeId, destination, details: visaDetails },
    { termsAccepted }
  );
  const validation = isVisa ? visaValidation : roleValidation;

  /**
   * Picking a role seeds the topics for that role's family.
   *
   * A Data Scientist and a DevOps Engineer should not be offered the same
   * checklist, and making someone assemble one from scratch before they can
   * continue is friction for no benefit. The seeded set is fully editable.
   */
  const chooseRole = (next: string) => {
    setRole(next);
    // A role change must not carry Data topics into a DevOps interview (or
    // vice versa). The seeded set remains fully editable on the next step.
    setTopics(suggestedTopicsForRole(next).slice(0, 4));
  };

  const roleTopicOptions = useMemo(
    () => (role ? suggestedTopicsForRole(role) : []),
    [role]
  );

  const filteredTopicOptions = useMemo(() => {
    const query = topicSearch.trim().toLowerCase();
    return query
      ? roleTopicOptions.filter((topic) => topic.toLowerCase().includes(query))
      : roleTopicOptions;
  }, [roleTopicOptions, topicSearch]);

  const progressPercent = Math.round(((step + 1) / steps.length) * 100);

  useEffect(() => {
    if (!confirmOpen) return;

    const dialog = confirmDialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        setConfirmOpen(false);
        confirmTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmOpen, submitting]);

  const toggleTopic = (topic: string) => {
    setTopics((current) => {
      if (current.includes(topic)) return current.filter((t) => t !== topic);
      if (current.length >= MAX_TOPICS) return current;
      return [...current, topic];
    });
  };

  const stepName = steps[step];

  const editStep = (name: string) => {
    const index = steps.findIndex((label) => label === name);
    if (index >= 0) setStep(index);
  };

  const stepComplete = (() => {
    switch (stepName) {
      case "Type":
        return true;
      case "Resume":
        // The only step that genuinely blocks: a resume interview with no
        // resume would just be a generic interview wearing the wrong label.
        return resume !== null;
      case "Role":
        return !roleValidation.errors.role;
      case "Topics":
        return !roleValidation.errors.topics;
      case "Experience":
        return !roleValidation.errors.experienceLevel;
      case "Interviewer":
        return !roleValidation.errors.interviewerId;
      case "Visa":
        return !visaValidation.errors.visaType && !visaValidation.errors.customVisaType;
      case "Officer":
        return !visaValidation.errors.visaMode;
      case "Details":
        return !visaValidation.errors.destination;
      case "Duration":
        return durationMinutes > 0;
      case "Terms":
        return termsAccepted;
      default:
        return false;
    }
  })();

  const handleSubmit = async () => {
    if (submitting || !validation.valid) return;
    setSubmitting(true);
    try {
      const result = await createInterviewFromSetup(
        isVisa
          ? {
              interviewType: "visa",
              visaTypeId,
              customVisaType,
              visaModeId,
              destination,
              visaDetails,
              durationMinutes,
              termsAccepted,
            }
          : {
              interviewType,
              role,
              topics,
              experienceLevel,
              interviewerId,
              durationMinutes,
              termsAccepted,
              ...(isResume && resume
                ? { resumeId: resume.resumeId, resumeFileName: resume.fileName }
                : {}),
            }
      );

      if (!result.success || !result.interviewId) {
        toast.error(result.message ?? "Could not create the interview.");
        return;
      }

      toast.success(isVisa ? "Your visa interview is ready." : "Your interview is ready.");
      router.push(`/interview/${result.interviewId}`);
    } catch {
      toast.error("Unable to start the interview. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (access !== null && !access.canStart) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-dark-200 p-8 text-center">
        <h3 className="text-primary-100">No interviews left this month</h3>
        <p className="max-w-md text-sm text-light-100">
          {access.reason ?? "You have used all the interviews included in your plan."}
        </p>
        <Link href="/pricing" className="btn-primary px-6 py-2">
          View plans
        </Link>
      </div>
    );
  }

  const card = (selected: boolean) =>
    cn(
      "setup-choice group relative flex min-h-32 flex-col gap-2 overflow-hidden rounded-2xl border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-100",
      selected ? "is-selected border-primary-200/70 bg-primary-200/[0.09]" : "border-white/10 bg-white/[0.035]"
    );

  return (
    <div className="setup-shell flex flex-col gap-7 rounded-[1.75rem] p-4 sm:p-7 lg:p-8">
      <div className="sm:hidden">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-200">
              Step {step + 1} of {steps.length}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{stepName}</p>
          </div>
          <span className="text-sm font-semibold text-primary-200">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Interview setup progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${steps.length}: ${stepName}`}
          className="h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div className="setup-progress-fill h-full rounded-full" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="relative hidden sm:block">
        <div
          className="absolute left-5 right-5 top-5 h-px bg-white/10"
          role="progressbar"
          aria-label="Interview setup progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${steps.length}: ${stepName}`}
        >
          <div className="setup-progress-fill h-full" style={{ width: `${step === 0 ? 0 : (step / (steps.length - 1)) * 100}%` }} />
        </div>
        <ol className="relative z-10 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Interview setup steps">
        {steps.map((label, index) => (
          <li key={label} className="min-w-0 text-center">
            <button
              type="button"
              // Going back is always allowed; jumping ahead is not, because a
              // later step can depend on an earlier answer.
              disabled={index > step}
              onClick={() => setStep(index)}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "group mx-auto flex min-h-12 w-full flex-col items-center gap-2 text-xs focus-visible:outline-none",
                index === step
                  ? "font-semibold text-primary-100"
                  : index < step
                    ? "text-primary-200"
                    : "text-light-100/45"
              )}
            >
              <span className={cn(
                "flex size-10 items-center justify-center rounded-full border bg-[#1a1917] transition-[transform,border-color,background-color] duration-200",
                index === step && "scale-105 border-primary-200 bg-primary-200 text-dark-100 shadow-[0_0_24px_rgba(202,197,254,0.25)]",
                index < step && "border-primary-200/60 bg-[#2b2521] text-primary-200",
                index > step && "border-white/10"
              )}>
                {index < step ? <Check className="size-4" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="truncate">{label}</span>
            </button>
          </li>
        ))}
        </ol>
        <p className="mt-2 text-right text-xs font-semibold text-primary-200">{progressPercent}% complete</p>
      </div>

      {stepName === "Type" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">What would you like to practise?</h3>
            <p className="text-sm text-light-100">
              Every type runs as a timed voice session with your camera on.
            </p>
          </div>
          <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INTERVIEW_TYPES.map((id) => {
              const definition = INTERVIEW_TYPE_DEFINITIONS[id];
              const presentation = TYPE_PRESENTATION[id];
              const Icon = presentation.icon;
              const selected = interviewType === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setInterviewType(id);
                    // The remaining steps differ per type, so an index carried
                    // over from another branch would land on the wrong screen.
                    setStep(0);
                  }}
                  className={card(selected)}
                >
                  <span className="flex items-start justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary-200/10 text-primary-200">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className={cn("flex size-6 items-center justify-center rounded-full border", selected ? "border-primary-200 bg-primary-200 text-dark-100" : "border-white/15 text-transparent")}>
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="mt-2 font-semibold text-white">{definition.label}</span>
                  <span className="w-fit rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-200">{presentation.badge}</span>
                  <span className="text-xs leading-5 text-light-100/80">{definition.tagline}. {definition.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stepName === "Resume" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">Upload your resume</h3>
            <p className="text-sm text-light-100">
              Your interviewer reads it and asks about your real experience,
              projects and skills — then probes how they transfer to the role you
              pick next.
            </p>
          </div>

          <ResumeUpload
            value={resume}
            onAnalysed={(analysed) => {
              setResume(analysed);
              // The detected role is offered as a starting point, never forced:
              // plenty of people practise for a role they have not held yet, and
              // silently overwriting their choice would be worse than useless.
              const detected = analysed.profile.currentRole?.trim();
              if (detected && !role) chooseRole(detected);
            }}
            onCleared={() => setResume(null)}
          />

          <p className="rounded-2xl bg-dark-200/60 p-4 text-xs text-light-100">
            Only the summary above is stored. The file itself is read once and
            discarded, and is never shared or made public.
          </p>
        </section>
      )}

      {stepName === "Role" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">
              {interviewType === "communication"
                ? "Which field are you preparing for?"
                : isResume
                  ? "Which role are you targeting?"
                  : "What role are you practising for?"}
            </h3>
            <p className="text-sm text-light-100">
              {isResume
                ? "This can differ from your resume — your interviewer will probe how your experience transfers."
                : "Search several hundred roles, or type your own."}
            </p>
          </div>
          <RoleSelector value={role} onChange={chooseRole} />
        </section>
      )}

      {stepName === "Topics" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-primary-100">Which topics should it cover?</h3>
              <p className="text-sm text-light-100">Prioritised for {role}. Choose up to {MAX_TOPICS}.</p>
            </div>
            <span className="w-fit rounded-full border border-primary-200/20 bg-primary-200/10 px-3 py-1.5 text-xs font-semibold text-primary-200" aria-live="polite">
              {topics.length} of {MAX_TOPICS} selected
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1" htmlFor="topic-search">
              <span className="sr-only">Search suggested topics</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-light-100/50" aria-hidden="true" />
              <input id="topic-search" type="search" value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} placeholder="Search topics" className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] py-2 pl-11 pr-4 text-sm text-white placeholder:text-light-100/45 focus:border-primary-200/60 focus:outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" disabled={topics.length >= MAX_TOPICS || filteredTopicOptions.every((topic) => topics.includes(topic))} onClick={() => setTopics((current) => [...new Set([...current, ...filteredTopicOptions])].slice(0, MAX_TOPICS))} className="min-h-12 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-primary-200 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Select all</button>
              <button type="button" disabled={topics.length === 0} onClick={() => setTopics([])} className="min-h-12 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-light-100 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
            </div>
          </div>

          <div className="flex min-h-24 flex-wrap content-start gap-2 rounded-2xl border border-white/10 bg-black/10 p-3">
            {filteredTopicOptions.map((topic) => {
              const selected = topics.includes(topic);
              const full = topics.length >= MAX_TOPICS && !selected;
              return (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={selected}
                  disabled={full}
                  onClick={() => toggleTopic(topic)}
                  className={cn(
                    "setup-chip min-h-11 rounded-xl border px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
                    selected
                      ? "is-selected border-primary-200/70 bg-primary-200 font-semibold text-dark-100"
                      : "border-white/10 bg-white/[0.04] text-light-100",
                    full && "cursor-not-allowed opacity-40"
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">{selected && <Check className="size-3.5" aria-hidden="true" />}{topic}</span>
                </button>
              );
            })}
            {filteredTopicOptions.length === 0 && <p className="m-auto py-4 text-center text-sm text-light-100/70">No suggested topics match. Add your own below.</p>}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="custom-topic">
              Add your own topic
            </label>
            <input
              id="custom-topic"
              value={customTopic}
              onChange={(event) => setCustomTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (customTopic.trim()) toggleTopic(customTopic.trim());
                  setCustomTopic("");
                }
              }}
              placeholder="Add your own topic"
              maxLength={60}
              className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white placeholder:text-light-100/50 focus:border-primary-200/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (customTopic.trim()) toggleTopic(customTopic.trim());
                setCustomTopic("");
              }}
              disabled={!customTopic.trim() || topics.length >= MAX_TOPICS}
              className="min-h-12 rounded-xl bg-primary-200 px-5 py-2 text-sm font-semibold text-dark-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-primary-200/15 bg-primary-200/[0.04] p-3" aria-label="Selected topics">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  aria-label={`Remove ${topic}`}
                  className="setup-chip min-h-10 rounded-xl bg-primary-200 px-3 py-2 text-sm font-semibold text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {topic} <X className="ml-1 inline size-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {stepName === "Experience" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">What is your experience level?</h3>
            <p className="text-sm text-light-100">
              This sets how hard the questions and follow-ups get.
            </p>
          </div>
          <div className="stagger-children grid gap-3 sm:grid-cols-2">
            {EXPERIENCE_LEVELS.map((level, index) => {
              const selected = level.id === experienceLevel;
              return (
                <button key={level.id} type="button" aria-pressed={selected} onClick={() => setExperienceLevel(level.id)} className={card(selected)}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-200/10 font-bold text-primary-200">{index + 1}</span>
                    {selected && <span className="flex size-6 items-center justify-center rounded-full bg-primary-200 text-dark-100"><Check className="size-3.5" aria-hidden="true" /></span>}
                  </span>
                  <span className="mt-1 font-semibold text-white">{level.label}</span>
                  <span className="text-xs text-primary-200">{level.hint}</span>
                  <span className="text-xs leading-5 text-light-100/75">{EXPERIENCE_EXPECTATIONS[level.id]}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stepName === "Interviewer" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">Who should interview you?</h3>
            <p className="text-sm text-light-100">
              Each interviewer has a different voice and a different style.
            </p>
          </div>
          <div className="stagger-children grid gap-3 sm:grid-cols-2">
            {INTERVIEWERS.map((interviewer) => {
              const selected = interviewer.id === interviewerId;
              return (
                <button key={interviewer.id} type="button" aria-pressed={selected} onClick={() => setInterviewerId(interviewer.id)} className={card(selected)}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-200/30 to-primary-200/5 text-primary-200"><UserRound className="size-5" aria-hidden="true" /></span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-200">{selected && <Check className="size-3" aria-hidden="true" />}{INTERVIEWER_DIFFICULTY[interviewer.id]}</span>
                  </span>
                  <span className="font-semibold text-white">{interviewer.name}</span>
                  <span className="text-xs font-medium text-primary-200">{interviewer.title}</span>
                  <span className="text-xs leading-5 text-light-100/75">{interviewer.style.split(".")[0]}.</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {stepName === "Visa" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">Which visa are you interviewing for?</h3>
            <p className="text-sm text-light-100">
              This sets what the officer probes hardest on.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {VISA_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={category.id === visaTypeId}
                onClick={() => setVisaTypeId(category.id)}
                className={card(category.id === visaTypeId)}
              >
                <span className="font-semibold text-white">{category.label}</span>
                <span className="text-xs text-light-100">{category.description}</span>
              </button>
            ))}
          </div>

          {visaTypeId === CUSTOM_VISA_CATEGORY_ID && (
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-visa" className="text-sm text-light-100">
                Which visa type?
              </label>
              <input
                id="custom-visa"
                value={customVisaType}
                onChange={(event) => setCustomVisaType(event.target.value)}
                placeholder="e.g. Schengen Short-Stay Visa"
                maxLength={80}
                className="rounded-full bg-dark-200 px-5 py-3 text-sm text-white placeholder:text-light-100/60"
              />
            </div>
          )}
        </section>
      )}

      {stepName === "Officer" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">How tough should the officer be?</h3>
            <p className="text-sm text-light-100">
              This changes the questioning style, not the questions you might face.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {VISA_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={mode.id === visaModeId}
                onClick={() => setVisaModeId(mode.id)}
                className={card(mode.id === visaModeId)}
              >
                <span className="font-semibold text-white">{mode.label}</span>
                <span className="text-xs text-light-100">{mode.description}</span>
                {mode.allowsCoaching && (
                  <span className="text-xs text-primary-200">
                    Includes brief coaching during the session
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {stepName === "Details" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">A little background</h3>
            <p className="text-sm text-light-100">
              The officer questions you on what you give here. Only the destination
              is required — leave the rest blank and you will be asked for it in the
              interview instead.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {visaCategory.detailFields.map((field) => {
              const meta = DETAIL_LABELS[field];
              const isDestination = field === "destination";
              return (
                <div key={field} className="flex flex-col gap-2">
                  <label htmlFor={`visa-${field}`} className="text-sm text-light-100">
                    {meta.label}
                    {isDestination && <span aria-hidden> *</span>}
                  </label>
                  <input
                    id={`visa-${field}`}
                    required={isDestination}
                    value={isDestination ? destination : (visaDetails[field] ?? "")}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (isDestination) setDestination(next);
                      else setVisaDetails((current) => ({ ...current, [field]: next }));
                    }}
                    placeholder={meta.placeholder}
                    maxLength={80}
                    className="rounded-full bg-dark-200 px-5 py-3 text-sm text-white placeholder:text-light-100/60"
                  />
                </div>
              );
            })}
          </div>

          <p className="rounded-2xl bg-dark-200/60 p-4 text-xs text-light-100">
            Never enter a passport number, identification number or bank details.
            This is a practice simulation and none of that is needed — the officer
            will not ask for it.
          </p>
        </section>
      )}

      {stepName === "Duration" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">How long should it run?</h3>
            <p className="text-sm text-light-100">
              The session runs for the full time. The interviewer decides how many
              questions fit — it does not end after a set number.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Interview length">
            {SESSION_LENGTHS.map((option) => {
              const permitted = allowedMinutes.includes(option);
              const selected = option === durationMinutes && permitted;
              const detail = DURATION_DETAILS[option];
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!permitted}
                  aria-pressed={option === durationMinutes}
                  title={permitted ? undefined : `${option} minute sessions need a higher plan`}
                  onClick={() => permitted && setDurationMinutes(option)}
                  className={cn(
                    "setup-choice relative flex min-h-40 flex-col items-start gap-2 rounded-2xl border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
                    selected
                      ? "is-selected border-primary-200/70 bg-primary-200/[0.09]"
                      : "border-white/10 bg-white/[0.035] text-light-100",
                    !permitted && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="flex w-full items-center justify-between text-primary-200"><Clock3 className="size-5" aria-hidden="true" />{!permitted ? <LockKeyhole className="size-4" aria-hidden="true" /> : selected ? <Check className="size-4" aria-hidden="true" /> : null}</span>
                  <span className="text-2xl font-semibold text-white">{option} min</span>
                  <span className="text-xs font-medium text-primary-200">{detail.questions}</span>
                  <span className="text-xs text-light-100/70">{detail.style}</span>
                </button>
              );
            })}
          </div>

          {access && (
            <p className="text-xs text-light-100">
              Your {access.planName} plan allows sessions up to{" "}
              {Math.max(...allowedMinutes)} minutes.{" "}
              <Link href="/pricing" className="underline">
                See plans
              </Link>
            </p>
          )}
        </section>
      )}

      {stepName === "Terms" && (
        <section key={stepName} className="flex flex-col gap-4 animate-slide-in">
          <div>
            <h3 className="text-primary-100">Before you start</h3>
            <p className="text-sm text-light-100">Here is what you have set up.</p>
          </div>

          <dl className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm sm:grid-cols-2 sm:p-5">
            <div className="rounded-xl bg-white/[0.035] p-3">
              <dt className="flex items-center justify-between gap-3 text-light-100/70">Session <button type="button" onClick={() => editStep("Type")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
              <dd className="text-white">
                {INTERVIEW_TYPE_DEFINITIONS[interviewType].label}
              </dd>
            </div>
            {isVisa ? (
              <>
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Visa <button type="button" onClick={() => editStep("Visa")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">
                    {resolveVisaTypeLabel({ visaTypeId, customVisaType })}
                  </dd>
                </div>
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Destination <button type="button" onClick={() => editStep("Details")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">{destination}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Officer <button type="button" onClick={() => editStep("Officer")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">
                    {VISA_MODES.find((m) => m.id === visaModeId)?.label}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Role <button type="button" onClick={() => editStep("Role")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">{role}</dd>
                </div>
                {isResume && (
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <dt className="flex items-center justify-between gap-3 text-light-100/70">Resume <button type="button" onClick={() => editStep("Resume")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                    <dd className="flex items-center gap-1.5 text-white"><Check className="size-3.5 text-success-100" aria-hidden="true" />{resume?.fileName ?? "Analysed"}</dd>
                  </div>
                )}
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Experience <button type="button" onClick={() => editStep("Experience")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">
                    {EXPERIENCE_LEVELS.find((l) => l.id === experienceLevel)?.label}
                  </dd>
                </div>
                <div className="rounded-xl bg-white/[0.035] p-3">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Interviewer <button type="button" onClick={() => editStep("Interviewer")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">
                    {INTERVIEWERS.find((i) => i.id === interviewerId)?.name}
                  </dd>
                </div>
                <div className="rounded-xl bg-white/[0.035] p-3 sm:col-span-2">
                  <dt className="flex items-center justify-between gap-3 text-light-100/70">Topics <button type="button" onClick={() => editStep("Topics")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
                  <dd className="text-white">{topics.join(", ")}</dd>
                </div>
              </>
            )}
            <div className="rounded-xl bg-white/[0.035] p-3">
              <dt className="flex items-center justify-between gap-3 text-light-100/70">Length <button type="button" onClick={() => editStep("Duration")} className="rounded-md px-1.5 py-1 text-xs font-semibold text-primary-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200">Edit</button></dt>
              <dd className="text-white">{durationMinutes} minutes</dd>
            </div>
          </dl>

          {isVisa && (
            <p className="rounded-2xl border border-primary-200/40 bg-dark-200/60 p-4 text-xs text-light-100">
              This is a practice simulation. It is not connected to any embassy,
              consulate or government, and it cannot tell you whether a real visa
              application would succeed.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3" aria-label="Interview requirements">
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-light-100"><Headphones className="size-4 text-primary-200" aria-hidden="true" />Quiet space</span>
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-light-100"><Mic2 className="size-4 text-primary-200" aria-hidden="true" />Microphone access</span>
            <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-light-100"><ShieldCheck className="size-4 text-primary-200" aria-hidden="true" />Private by design</span>
          </div>

          <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-light-100 transition-colors hover:border-primary-200/30">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary-200"
            />
            <span>
              I understand this is a timed practice session. My camera and
              microphone will be used, my answers will be transcribed and scored,
              and attention monitoring runs in my browser — no video is recorded or
              uploaded.
            </span>
          </label>
        </section>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
          className="w-full rounded-full bg-dark-200 px-5 py-2 text-sm text-light-100 disabled:opacity-40 sm:w-auto"
        >
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={!stepComplete}
            className="btn-primary w-full px-6 py-2 text-sm disabled:opacity-40 sm:w-auto"
          >
            {stepName === "Resume" ? "Confirm & continue" : "Continue"}
          </button>
        ) : (
          <button
            ref={confirmTriggerRef}
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!validation.valid || submitting}
            className="btn-primary group w-full gap-2 px-7 py-3 text-sm shadow-[0_10px_30px_rgba(255,193,158,0.14)] disabled:opacity-40 sm:inline-flex sm:w-auto sm:items-center"
          >
            {submitting ? "Preparing…" : <>Review & start <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></>}
          </button>
        )}
      </div>

      {!stepComplete && (
        <p className="text-xs text-light-100" aria-live="polite">
          {stepName === "Role" && roleValidation.errors.role}
          {stepName === "Topics" && roleValidation.errors.topics}
          {stepName === "Visa" &&
            (visaValidation.errors.visaType ?? visaValidation.errors.customVisaType)}
          {stepName === "Details" && visaValidation.errors.destination}
          {stepName === "Resume" && !resume && "Upload a resume to continue."}
          {stepName === "Terms" && !termsAccepted && "Accept the terms to start."}
        </p>
      )}

      {confirmOpen && (
        <div
          className="setup-dialog-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setConfirmOpen(false);
              confirmTriggerRef.current?.focus();
            }
          }}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-dialog-title"
            aria-describedby="start-dialog-description"
            className="setup-dialog-panel relative w-full max-w-lg rounded-t-[1.75rem] border border-white/10 bg-[#191816] p-5 shadow-2xl shadow-black/60 sm:rounded-[1.75rem] sm:p-7"
          >
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                confirmTriggerRef.current?.focus();
              }}
              disabled={submitting}
              aria-label="Close confirmation"
              className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full text-light-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 disabled:opacity-40"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-200/10 text-primary-200">
              <Sparkles className="size-6" aria-hidden="true" />
            </span>
            <h3 id="start-dialog-title" className="pr-12 text-2xl text-white">Ready for your interview?</h3>
            <p id="start-dialog-description" className="mt-2 text-sm leading-6 text-light-100/80">
              We will request camera and microphone access in the interview room. Nothing starts until you are ready.
            </p>
            <ul className="mt-5 space-y-3" aria-label="Readiness checklist">
              {[
                "Interview configuration ready",
                "Camera and microphone checked next",
                isResume ? "Resume processed and linked" : "Private session prepared",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3 text-sm text-light-100">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-100/15 text-success-100"><Check className="size-3.5" aria-hidden="true" /></span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={submitting} onClick={() => setConfirmOpen(false)} className="min-h-12 rounded-full px-5 text-sm font-semibold text-light-100 hover:bg-white/5 disabled:opacity-40">Not yet</button>
              <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-7 text-sm disabled:opacity-50 sm:w-auto">
                {submitting ? "Preparing interview…" : <>Start Interview <ChevronRight className="size-4" aria-hidden="true" /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewSetupWizard;
