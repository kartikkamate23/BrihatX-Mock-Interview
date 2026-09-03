/**
 * The catalogue the interview setup wizard offers, and the single place the
 * interviewer personas are defined.
 *
 * Kept separate from lib/plans.ts: that module owns what an account is *allowed*
 * to do, this one owns what an interview is *about*. Both are pure data so the
 * wizard, the prompt builder and the server-side validator all read the same
 * values instead of each carrying their own copy.
 */

export interface InterviewerPersona {
  id: string;
  name: string;
  /** Shown under the name in the picker. */
  title: string;
  /**
   * A Live API prebuilt voice. These are the names the model accepts in
   * `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`; an unknown name is
   * rejected at connect time, so they are not free text.
   */
  voiceName: string;
  /** Folded into the system instruction to colour the interviewer's manner. */
  style: string;
}

export const INTERVIEWERS: InterviewerPersona[] = [
  {
    id: "tanya",
    name: "Tanya",
    title: "Senior Engineering Manager",
    voiceName: "Aoede",
    style:
      "Warm but rigorous. You put the candidate at ease, then probe hard on specifics. " +
      "You often ask 'what would you do differently now' and follow vague answers with a concrete scenario.",
  },
  {
    id: "rohan",
    name: "Rohan",
    title: "Staff Software Engineer",
    voiceName: "Charon",
    style:
      "Direct and technical. You spend little time on preamble, ask precise questions, and " +
      "push into trade-offs and edge cases. You are never rude, but you do not let a hand-wave pass.",
  },
  {
    id: "aisha",
    name: "Aisha",
    title: "Technical Recruiter",
    voiceName: "Kore",
    style:
      "Conversational and behaviour-focused. You care about how the candidate works with others, " +
      "how they explain technical ideas to non-experts, and how they handle pressure and ambiguity.",
  },
  {
    id: "daniel",
    name: "Daniel",
    title: "Principal Architect",
    voiceName: "Puck",
    style:
      "Systems-minded and calm. You like to start broad and narrow down, asking the candidate to " +
      "reason out loud, and you follow every design answer with a question about how it fails.",
  },
];

export const DEFAULT_INTERVIEWER_ID = "tanya";

export function getInterviewer(id: string | undefined | null): InterviewerPersona {
  return (
    INTERVIEWERS.find((i) => i.id === id) ??
    INTERVIEWERS.find((i) => i.id === DEFAULT_INTERVIEWER_ID)!
  );
}

export const EXPERIENCE_LEVELS = [
  {
    id: "entry",
    label: "Entry level",
    hint: "Student, intern, or under a year of experience",
    guidance:
      "Ask foundational questions. Check understanding of core concepts and whether they can reason " +
      "from first principles. Expect gaps in production experience and do not penalise them for it; " +
      "penalise vagueness about things they claim to know.",
  },
  {
    id: "junior",
    label: "Junior",
    hint: "Roughly 1-2 years of experience",
    guidance:
      "Expect solid fundamentals and some real project experience. Probe how they handled concrete " +
      "problems rather than asking for definitions.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    hint: "Roughly 3-5 years of experience",
    guidance:
      "Expect ownership of non-trivial work. Ask about trade-offs, debugging real incidents, and " +
      "decisions they would revisit. Definitions alone are not a sufficient answer at this level.",
  },
  {
    id: "senior",
    label: "Senior",
    hint: "6+ years, or leading technical work",
    guidance:
      "Expect design-level thinking, awareness of failure modes, and the ability to justify decisions " +
      "against alternatives. Push into scale, reliability, and how they bring others along.",
  },
] as const;

export type ExperienceLevelId = (typeof EXPERIENCE_LEVELS)[number]["id"];

export const DEFAULT_EXPERIENCE_LEVEL: ExperienceLevelId = "intermediate";

export function getExperienceLevel(id: string | undefined | null) {
  return (
    EXPERIENCE_LEVELS.find((l) => l.id === id) ??
    EXPERIENCE_LEVELS.find((l) => l.id === DEFAULT_EXPERIENCE_LEVEL)!
  );
}

/**
 * Suggested roles. Not a closed set -- the wizard lets people type their own,
 * because the useful long tail of job titles is much longer than any list worth
 * maintaining here.
 */
export const SUGGESTED_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "DevOps Engineer",
  "Mobile Developer",
  "QA Engineer",
  "Product Manager",
];

/**
 * Topic catalogue, grouped so the wizard can show sections rather than one very
 * long list. Topics are also free-text extensible for the same reason as roles.
 */
export const TOPIC_GROUPS = [
  {
    label: "Computer science",
    topics: [
      "Data Structures & Algorithms",
      "System Design",
      "Object-Oriented Programming",
      "Databases & SQL",
      "Operating Systems",
      "Computer Networks",
      "Concurrency",
    ],
  },
  {
    label: "Engineering practice",
    topics: [
      "Testing & Quality",
      "Debugging & Incidents",
      "Code Review",
      "CI/CD & Deployment",
      "Security",
      "Performance",
      "Cloud & Infrastructure",
    ],
  },
  {
    label: "Technologies",
    topics: [
      "JavaScript & TypeScript",
      "React",
      "Node.js",
      "Python",
      "Java",
      "REST & APIs",
      "Docker & Kubernetes",
    ],
  },
  {
    label: "Non-technical",
    topics: [
      "Behavioural & Situational",
      "Communication",
      "Teamwork & Collaboration",
      "Ownership & Conflict",
      "Career & Motivation",
    ],
  },
] as const;

export const ALL_TOPICS: string[] = TOPIC_GROUPS.flatMap((g) => [...g.topics]);

/** At least one topic, and few enough that the interview can cover them. */
export const MIN_TOPICS = 1;
export const MAX_TOPICS = 6;

export interface InterviewSetup {
  role: string;
  topics: string[];
  experienceLevel: string;
  interviewerId: string;
  durationMinutes: number;
}

export interface SetupValidation {
  valid: boolean;
  errors: Partial<Record<keyof InterviewSetup | "terms", string>>;
}

/**
 * Validates a setup the same way on the client and the server.
 *
 * The client uses it to enable the Start button; the server uses it before
 * writing anything, because a disabled button is a UX affordance and not a
 * check. Duration is validated against the plan separately -- that gate lives in
 * lib/plans.ts and must not be duplicated here.
 */
export function validateSetup(
  setup: Partial<InterviewSetup>,
  options: { termsAccepted?: boolean } = {}
): SetupValidation {
  const errors: SetupValidation["errors"] = {};

  const role = setup.role?.trim() ?? "";
  if (role.length < 2) {
    errors.role = "Enter the role you want to practise for.";
  } else if (role.length > 80) {
    errors.role = "That role name is too long.";
  }

  const topics = setup.topics ?? [];
  if (topics.length < MIN_TOPICS) {
    errors.topics = "Choose at least one topic.";
  } else if (topics.length > MAX_TOPICS) {
    errors.topics = `Choose at most ${MAX_TOPICS} topics so the interview can cover them properly.`;
  }

  if (!EXPERIENCE_LEVELS.some((l) => l.id === setup.experienceLevel)) {
    errors.experienceLevel = "Choose your experience level.";
  }

  if (!INTERVIEWERS.some((i) => i.id === setup.interviewerId)) {
    errors.interviewerId = "Choose an interviewer.";
  }

  if (!setup.durationMinutes || setup.durationMinutes <= 0) {
    errors.durationMinutes = "Choose how long the interview should run.";
  }

  if (options.termsAccepted === false) {
    errors.terms = "You need to accept the interview terms before starting.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Normalises free-text topics: trimmed, de-duplicated, capped. */
export function normaliseTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of topics) {
    const topic = raw.trim().replace(/\s+/g, " ");
    if (!topic) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(topic);
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

/**
 * Topics reduced to the lowercase tags the existing dashboard renders as tech
 * icons. Keeps the new setup flow compatible with the `techstack` field that
 * InterviewCard and DisplayTechIcons already read.
 */
export function topicsToTechstack(topics: string[]): string[] {
  return normaliseTopics(topics).map((t) =>
    t
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9. ]/g, "")
      .trim()
  );
}
