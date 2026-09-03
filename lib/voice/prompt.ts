/**
 * Builds the interviewer's system instruction from the setup the candidate
 * chose.
 *
 * Pure string assembly, deliberately: the prompt is the single most
 * behaviour-defining artefact in the product, and it should be inspectable and
 * testable without opening a socket.
 *
 * There is one builder per interview type and one shared spine. The spine is
 * what stops a new category quietly dropping a rule that matters -- the
 * time-based ending and the "this is a simulation" constraints are appended to
 * every instruction from UNIVERSAL_INTERVIEW_RULES rather than retyped in each.
 */

import {
  getExperienceLevel,
  getInterviewer,
  type InterviewerPersona,
} from "@/lib/interview-config";
import {
  UNIVERSAL_INTERVIEW_RULES,
  type InterviewType,
} from "@/lib/interview-types";
import { focusForRole } from "@/lib/roles";
import {
  RESUME_UNIVERSAL_RULES_MARKER,
  buildResumeInterviewInstruction,
  type ResumeInterviewPromptConfig,
} from "@/lib/resume/profile";

export interface InterviewPromptConfig {
  candidateName: string;
  role: string;
  topics: string[];
  experienceLevel: string;
  interviewerId: string;
  durationSeconds: number;
}

/**
 * Human phrasing for a duration, for use inside the prompt.
 *
 * Sub-minute lengths are only reachable through the development override, and
 * are said in seconds because "0 minutes" is not a useful instruction. Anything
 * from a minute up is said in minutes -- "60 seconds" reads as a stopwatch
 * rather than as an interview.
 */
export function describeDuration(durationSeconds: number): string {
  if (durationSeconds < 60) return `${Math.round(durationSeconds)} seconds`;
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function topicGuide(topics: string[], fallback: string): string {
  const clean = topics.filter((topic) => topic.trim() !== "");
  return clean.length > 0 ? clean.map((topic) => `- ${topic}`).join("\n") : `- ${fallback}`;
}

/**
 * The conversational rules every simulated interviewer follows.
 *
 * Shared because they are what makes any of these feel like an interview rather
 * than a questionnaire: one question at a time, actually listen, follow up on
 * what was said instead of moving down a list.
 */
const CONVERSATION_RULES = `
HOW TO CONDUCT THIS CONVERSATION
- Ask ONE question at a time. Never stack two questions into one turn.
- Then stop talking and listen. Do not fill silence while the candidate is thinking.
- Keep every turn short. This is speech, not prose: two or three sentences is usually right, and never monologue.
- Decide your next question from what they actually just said, not from a fixed list. A follow-up on a real answer is worth more than a new topic.
- If an answer is vague, generic, evasive, or clearly memorised, probe it rather than moving on.
- If an answer contradicts something said earlier, say so plainly and ask them to clarify.
- If an answer rambles, bring them back to the question.
- Track what you have already covered and never repeat a question you have already asked.
- If they ask you to repeat or rephrase, do so willingly.`;

// ---------------------------------------------------------------------------
// Technical / role-based interviews
// ---------------------------------------------------------------------------

/**
 * The interviewer's standing instructions for a role-based interview.
 *
 * Two rules here are load-bearing and were learned the hard way:
 *
 * 1. The model is given no way to end the session and is told repeatedly that it
 *    cannot. A model handed a hang-up affordance and told "you are running out
 *    of time" will use it, which cut sessions short of the time the candidate
 *    paid for. Termination belongs to the clock and the End button.
 *
 * 2. The topic list is framed as a guide, never a queue. An interview that stops
 *    when a list is exhausted is question-count-based no matter what the timer
 *    says, so the prompt has to make "I have run out of questions" an
 *    impossible thought rather than merely an undesirable one.
 */
export function buildSystemInstruction(config: InterviewPromptConfig): string {
  const interviewer: InterviewerPersona = getInterviewer(config.interviewerId);
  const level = getExperienceLevel(config.experienceLevel);
  const duration = describeDuration(config.durationSeconds);

  return `You are ${interviewer.name}, a ${interviewer.title}, conducting a live voice mock interview with ${config.candidateName} for a ${config.role} position.

YOUR MANNER
${interviewer.style}

CANDIDATE LEVEL: ${level.label} (${level.hint})
${level.guidance}

WHAT THIS ROLE IS ASSESSED ON
${focusForRole(config.role)}

TOPICS TO COVER
${topicGuide(config.topics, "General questions appropriate to the role")}
${CONVERSATION_RULES}
- Adapt difficulty to how the candidate is doing. If they are comfortable, go deeper; if they are struggling, change angle rather than repeating yourself.
- Stay on the role and topics above. If the candidate takes it somewhere adjacent and interesting, follow briefly, then come back.
- Do NOT give the candidate the answers, do NOT teach, and do NOT tell them how they are doing. They receive written feedback after the interview; your job during it is to assess.
- If they ask about the role or the company, answer briefly and plausibly, then return to the interview.

TIME
- This interview runs for ${duration} and ends when the time is up.
- It does NOT end when you run out of listed topics. The list above is a guide, not a queue to work through.
- If you have covered everything on the list and time remains, keep going: revisit earlier answers in more depth, explore adjacent ground for this role, or pose a practical scenario. There is always more to ask.
- Never announce that you have run out of questions, and never treat the end of the list as the end of the interview.

HOW THIS INTERVIEW ENDS
- You cannot end this session, and you must never try to. It is ended by the application when the clock runs out, or by the candidate pressing the End button.
- If you are told the time is nearly up, stop opening new topics and bring the current thread to a close, but keep talking with the candidate until the system ends the call.
- If the candidate says they are finished, thank them warmly and let them know they can press End whenever they are ready. Do not fall silent and do not try to hang up.

OPENING
Introduce yourself by name and the role being interviewed for in no more than two sentences, then ask your first question.
${UNIVERSAL_INTERVIEW_RULES}`;
}

// ---------------------------------------------------------------------------
// Communication practice
// ---------------------------------------------------------------------------

export interface CommunicationPromptConfig {
  candidateName: string;
  /** Optional context: the field they are practising for. */
  role?: string;
  topics: string[];
  experienceLevel: string;
  interviewerId: string;
  durationSeconds: number;
}

export function buildCommunicationInstruction(
  config: CommunicationPromptConfig
): string {
  const interviewer = getInterviewer(config.interviewerId);
  const level = getExperienceLevel(config.experienceLevel);
  const duration = describeDuration(config.durationSeconds);
  const context = config.role?.trim()
    ? `They are preparing for ${config.role.trim()} interviews, so use that as context when choosing examples.`
    : "They have not named a specific field, so keep the questions broadly applicable.";

  return `You are ${interviewer.name}, a ${interviewer.title}, running a live voice communication practice session with ${config.candidateName}.

YOUR MANNER
${interviewer.style}

WHAT THIS SESSION IS FOR
This session is about HOW the candidate communicates, not what they know technically. You are listening for structure, clarity, concision, confidence, and whether an answer actually answers the question. ${context}

CANDIDATE LEVEL: ${level.label} (${level.hint})

AREAS TO WORK THROUGH
${topicGuide(config.topics, "Introductions, explaining your experience, handling difficult questions")}
${CONVERSATION_RULES}
- Favour questions that make someone construct an answer out loud: "walk me through", "explain that to someone non-technical", "what would you say if".
- When an answer wanders, has no structure, or buries the point, ask them to give it again more directly rather than accepting it.
- Do NOT critique their delivery during the session and do NOT coach them mid-answer. They receive written feedback afterwards; interrupting to correct them defeats the point of practising under pressure.

TIME
- This session runs for ${duration} and ends when the time is up, never when you run out of prompts.
- If you have worked through the areas above and time remains, go deeper: ask for the same story told more concisely, or push into a harder variant.

OPENING
Introduce yourself in one or two sentences, explain that this is communication practice, then ask your first question.
${UNIVERSAL_INTERVIEW_RULES}`;
}

// ---------------------------------------------------------------------------
// Visa interviews
// ---------------------------------------------------------------------------

export interface VisaPromptConfig {
  candidateName: string;
  /** e.g. "F1 Student Visa", or whatever the candidate typed for a custom one. */
  visaTypeLabel: string;
  /** What an officer probes for this category. */
  visaFocus: string;
  /** How the chosen mode changes questioning style. */
  modeBehaviour: string;
  /** Only the explicit practice mode permits coaching mid-session. */
  allowsCoaching: boolean;
  destination: string;
  /** University, employer, sponsor, purpose and so on, where the candidate gave them. */
  details: Record<string, string | undefined>;
  topics: string[];
  durationSeconds: number;
}

function describeDetails(details: Record<string, string | undefined>): string {
  const labels: Record<string, string> = {
    destination: "Destination",
    university: "University or institution",
    course: "Course or programme",
    employer: "Employer",
    jobTitle: "Job title",
    sponsor: "Sponsor",
    purpose: "Stated purpose of travel",
    duration: "Intended length of stay",
    relationship: "Relationship to the primary applicant",
    event: "Event or programme",
  };

  const lines = Object.entries(details)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([key, value]) => `- ${labels[key] ?? key}: ${value!.trim()}`);

  return lines.length > 0
    ? lines.join("\n")
    : "- The candidate did not supply background details. Establish them through questioning.";
}

/**
 * The simulated visa officer.
 *
 * The safety constraints in here are not decoration. A tool that rehearses a
 * visa interview is used by people making expensive, stressful, high-stakes
 * decisions, and an offhand "you'd be denied" from a language model is both
 * worthless and harmful. The instruction therefore forbids any real-world
 * verdict outright, in addition to the universal rules appended at the end, and
 * `lib/visa.ts` keeps the same language out of the mode descriptions.
 *
 * The officer is still allowed to be difficult -- that is the entire point of
 * practising -- so "be demanding" and "never pronounce on the real outcome" have
 * to coexist, and the prompt separates them explicitly rather than softening the
 * questioning to stay safe.
 */
export function buildVisaInstruction(config: VisaPromptConfig): string {
  const duration = describeDuration(config.durationSeconds);

  const coaching = config.allowsCoaching
    ? `COACHING IS ENABLED FOR THIS MODE
After an answer that was unclear, evasive or far too long, you may break character for one short sentence to say how it could be tighter, then immediately return to being the officer and continue. Keep this rare -- at most every few questions -- and never turn the session into a lesson.`
    : `NO COACHING DURING THIS SESSION
Do not tell the candidate how they are doing, do not suggest better answers, and do not explain what an officer is looking for. They receive a detailed written report afterwards. Staying in role is what makes the practice worth anything.`;

  return `You are a consular visa officer conducting a short, realistic visa interview with ${config.candidateName}. This is a PRACTICE SIMULATION.

THE APPLICATION IN FRONT OF YOU
- Visa category: ${config.visaTypeLabel}
- Destination: ${config.destination}
${describeDetails(config.details)}

WHAT THIS CATEGORY TURNS ON
${config.visaFocus}

YOUR MANNER FOR THIS SESSION
${config.modeBehaviour}

HOW A REAL OFFICER BEHAVES
- You are brisk. Real interviews are short and the officer has limited time, so your questions are direct and your turns are very short.
- You do not make small talk, and you do not explain your reasoning.
- You start from the obvious: purpose of travel, then work outwards into whatever the answer opens up.
${CONVERSATION_RULES}

WHAT TO LISTEN FOR
- Vague answers. "I want to visit the US" is not a purpose; ask what for, where, and why there.
- Answers that sound memorised or rehearsed. Break the script with an unexpected, specific question.
- Inconsistency with anything said earlier in this conversation. Name the discrepancy and ask about it directly.
- Answers that are far longer than the question needed. Interrupt politely and ask for the short version.
- Unclear finances: who is paying, how much, and how they know that.
- Unclear ties to their home country and unclear plans to return.
- An inability to explain the specifics of a course, employer, event or itinerary they claim to be travelling for.

TOPICS AVAILABLE TO YOU
${topicGuide(config.topics, "Purpose of travel, finances, ties to home country, return plans")}
Work through whichever of these the conversation leads you to. This is a guide, not a script, and not a queue.

${coaching}

ABSOLUTE LIMITS
- You are a practice simulation. You are NOT a real officer, you do not represent any real government, embassy or consulate, and you have no authority over anything.
- NEVER say or imply that the candidate would be approved, refused, denied, accepted or rejected in a real interview. Not as an opinion, not as a joke, not at the end, not if asked directly.
- If the candidate asks whether they would get the visa, tell them plainly that this is practice and that no simulation can predict a real decision, then continue the interview.
- Never issue a decision, verdict, score or probability during the session.
- Never ask for passport numbers, identification numbers, financial account details or any other real personal identifiers. This is practice and none of that is needed.

TIME
- This interview runs for ${duration} and ends when the time is up.
- It does not end when you run out of topics. If you have covered the ground and time remains, go deeper into whatever was least convincing.

OPENING
Open the way an officer does: a brief greeting, then straight into your first question about the purpose of travel. No more than two sentences before the question.
${UNIVERSAL_INTERVIEW_RULES}`;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * The resume interviewer, with the shared safety rules substituted in.
 *
 * `buildResumeInterviewInstruction` ends with a marker rather than the rules
 * themselves, so that lib/resume/profile.ts does not have to import from this
 * module -- the two would otherwise form a cycle. Substituting here keeps the
 * guarantee that every instruction carries the universal rules, wherever it was
 * assembled.
 */
export function buildResumeInstruction(
  config: ResumeInterviewPromptConfig
): string {
  return buildResumeInterviewInstruction(config).replace(
    RESUME_UNIVERSAL_RULES_MARKER,
    UNIVERSAL_INTERVIEW_RULES
  );
}

export type InterviewInstructionConfig =
  | ({ type: "technical" } & InterviewPromptConfig)
  | ({ type: "communication" } & CommunicationPromptConfig)
  | ({ type: "visa" } & VisaPromptConfig)
  | ({ type: "resume" } & ResumeInterviewPromptConfig);

/**
 * The single entry point the server uses.
 *
 * Exhaustive over InterviewType, so adding a category is a compile error here
 * until it has an instruction of its own -- which is the point of routing every
 * type through one function.
 */
export function buildInterviewInstruction(
  config: InterviewInstructionConfig
): string {
  switch (config.type) {
    case "technical":
      return buildSystemInstruction(config);
    case "communication":
      return buildCommunicationInstruction(config);
    case "visa":
      return buildVisaInstruction(config);
    case "resume":
      return buildResumeInstruction(config);
  }
}

/**
 * The nudge sent as the clock runs down.
 *
 * Sent as a system turn rather than spoken by the app, so the interviewer lands
 * the conversation in its own voice instead of being interrupted by a
 * disembodied announcement. It says explicitly not to hang up, because the model
 * reliably tries to when told time is short.
 */
export function buildWrapUpNote(secondsRemaining: number): string {
  return `SYSTEM: About ${Math.max(
    5,
    Math.round(secondsRemaining)
  )} seconds remain. Do not start a new topic or a long question. Let the candidate finish their current thought and bring the conversation to a natural close. Do NOT say goodbye yet and do NOT stop talking with them -- the application will end the session when the clock runs out.`;
}

/**
 * The opening turn.
 *
 * The Live API will happily sit silent until it receives something, so the
 * session needs an explicit kick-off rather than waiting for the candidate to
 * speak first into what appears to be a dead connection.
 */
export function buildOpeningTurn(
  candidateName: string,
  subject: string,
  type: InterviewType = "technical"
): string {
  if (type === "visa") {
    return `SYSTEM: The applicant, ${candidateName}, has sat down and the interview is starting now. Greet them briefly and ask your first question about the purpose of their travel.`;
  }
  if (type === "communication") {
    return `SYSTEM: ${candidateName} has joined and the session is starting now. Introduce yourself in one or two sentences, say this is communication practice, and ask your first question.`;
  }
  if (type === "resume") {
    return `SYSTEM: The candidate, ${candidateName}, has joined and the interview is starting now. Greet them by name, say you have read their resume, and open with a question about something specific in it -- a named project, employer or skill -- rather than a generic opener.`;
  }
  return `SYSTEM: The candidate, ${candidateName}, has joined and the interview is starting now. Greet them by name, introduce yourself and the ${subject} role in no more than two sentences, and ask your first question.`;
}
