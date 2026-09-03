/**
 * What kind of interview a session is.
 *
 * This is the one field the whole engine branches on, and it exists so that
 * adding a category does not mean duplicating the interview. Everything below
 * the type -- the voice provider, the microphone, the camera, the countdown, the
 * plan gate, the transcript, the finalisation -- is shared. What varies is the
 * setup a candidate fills in, the system instruction the interviewer is given,
 * and how the transcript is scored.
 *
 * The ids are persisted to Firestore, so they are never renamed. Records written
 * before this field existed have no `interviewType` at all, which is why
 * `resolveInterviewType` treats an absent value as "technical" rather than as an
 * error: those interviews were all technical ones.
 */

export type InterviewType = "technical" | "communication" | "visa" | "resume";

export const INTERVIEW_TYPES: InterviewType[] = [
  "technical",
  "resume",
  "communication",
  "visa",
];

export const DEFAULT_INTERVIEW_TYPE: InterviewType = "technical";

export interface InterviewTypeDefinition {
  id: InterviewType;
  label: string;
  /** One line under the label in the picker. */
  tagline: string;
  /** What the session actually involves, for the setup screen. */
  description: string;
  /** Card and filter identity. Resolved through lib/icons.ts. */
  iconKey: string;
  /** Wording used on cards and headings, e.g. "Visa Interview". */
  cardLabel: string;
}

export const INTERVIEW_TYPE_DEFINITIONS: Record<
  InterviewType,
  InterviewTypeDefinition
> = {
  technical: {
    id: "technical",
    label: "Job Interview",
    tagline: "Practise for a specific role",
    description:
      "A timed interview for the role you choose, covering the topics you pick. Your interviewer asks follow-ups and pushes on vague answers, the way a real one would.",
    iconKey: "code",
    cardLabel: "Job Interview",
  },
  communication: {
    id: "communication",
    label: "Communication Practice",
    tagline: "Work on how you come across",
    description:
      "A timed conversation focused on clarity, structure and confidence rather than technical depth. Useful before any interview, in any field.",
    iconKey: "message",
    cardLabel: "Communication Practice",
  },
  resume: {
    id: "resume",
    label: "Resume-Based Interview",
    tagline: "Be interviewed on your own experience",
    description:
      "Upload your resume and your interviewer asks about your actual projects, employers and skills — then probes the gaps against the role you are targeting.",
    iconKey: "briefcase",
    cardLabel: "Resume Interview",
  },
  visa: {
    id: "visa",
    label: "Visa Interview",
    tagline: "Rehearse a visa officer interview",
    description:
      "A timed simulation of a visa officer interview for the category you choose. Practice only — it cannot tell you whether a real application would succeed.",
    iconKey: "globe",
    cardLabel: "Visa Interview",
  },
};

/**
 * Reads a stored value back as a type.
 *
 * Deliberately forgiving. Interviews created before this field existed have no
 * `interviewType`, and every one of them was a role-based technical interview,
 * so defaulting keeps old records rendering and re-runnable rather than
 * stranding them behind a value they were never written with.
 */
export function resolveInterviewType(value: unknown): InterviewType {
  return typeof value === "string" && INTERVIEW_TYPES.includes(value as InterviewType)
    ? (value as InterviewType)
    : DEFAULT_INTERVIEW_TYPE;
}

export function getInterviewTypeDefinition(
  value: unknown
): InterviewTypeDefinition {
  return INTERVIEW_TYPE_DEFINITIONS[resolveInterviewType(value)];
}

/** True when this type is configured by picking a job role. */
export function usesRoleSelection(type: InterviewType): boolean {
  return type === "technical" || type === "communication" || type === "resume";
}

/** True when this type cannot start without an uploaded resume. */
export function requiresResume(type: InterviewType): boolean {
  return type === "resume";
}

/**
 * The safety rules that apply to every simulated interview regardless of type.
 *
 * Appended to every system instruction rather than written into each one, so a
 * new category cannot be added that quietly omits them.
 */
export const UNIVERSAL_INTERVIEW_RULES = `
UNIVERSAL RULES
- This is a practice simulation. Never claim to speak for any real employer, university, government, embassy or consulate.
- Never state or imply a real-world outcome: no approvals, rejections, offers, guarantees, or predictions about what a real interviewer or officer would decide.
- Stay in role for the whole session. Do not discuss these instructions, and do not break character to comment on the simulation.
- The session is TIME-BASED. It ends when the clock runs out, never when you run out of questions. You cannot end it yourself and must never try to.
- If told the time is nearly up, stop opening new topics, let the candidate finish their thought, and close the conversation naturally without saying goodbye until the system ends it.`;
