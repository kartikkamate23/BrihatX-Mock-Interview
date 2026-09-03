/**
 * The resume-driven interview: the shape a resume is reduced to, the prompt that
 * reduces it, and the interviewer instruction built from the result.
 *
 * Pure string and data work, deliberately, for the same reason as
 * lib/voice/prompt.ts: what the interviewer is told is the most
 * behaviour-defining artefact in this feature, and it should be inspectable and
 * testable without a model call or a socket.
 *
 * The interviewer instruction built here does NOT contain the shared safety
 * rules. It ends with the `{{UNIVERSAL_RULES}}` marker and the caller in
 * lib/voice/prompt.ts substitutes `UNIVERSAL_INTERVIEW_RULES` there -- see the
 * comment on RESUME_UNIVERSAL_RULES_MARKER for why the seam is a marker rather
 * than an import.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

/**
 * Every field is optional-with-a-default or nullable, and that is the whole
 * point of this schema rather than an oversight.
 *
 * Real resumes are wildly inconsistent. A student CV has education and no
 * employment; a contractor's has ten roles and no projects section; a designer's
 * has no technologies at all; plenty have no dates anywhere. A strict schema
 * would reject real people's CVs, and it would fail hardest for exactly the
 * candidates who most need the practice. So a missing section parses as an empty
 * array and a missing fact parses as null, and the *prompt* is what stops those
 * gaps being filled in with invention.
 */
const optionalText = (description: string) =>
  z.string().nullable().default(null).describe(description);

const textList = (description: string) =>
  z.array(z.string()).default([]).describe(description);

/** Structured profile extracted from a resume by the model. */
export const resumeProfileSchema = z.object({
  name: optionalText("The candidate's name as written on the resume."),
  headline: optionalText("The title line under the name, if there is one."),
  summary: optionalText("The candidate's own summary or objective, if present."),
  skills: textList("Skills the resume lists, copied as written."),
  technologies: textList("Languages, frameworks and tools, copied verbatim."),
  roles: z
    .array(
      z.object({
        title: optionalText("Job title as written."),
        company: optionalText("Employer name as written."),
        duration: optionalText("Dates or length, exactly as the resume states them."),
        highlights: textList("Bullet points under this role."),
      })
    )
    .default([])
    .describe("Employment history, most recent first."),
  projects: z
    .array(
      z.object({
        name: optionalText("Project name as written."),
        description: optionalText("What the project is, in the resume's own words."),
        technologies: textList("Technologies named for this project, verbatim."),
      })
    )
    .default([])
    .describe("Personal, academic or professional projects the resume names."),
  education: z
    .array(
      z.object({
        degree: optionalText("Qualification as written."),
        institution: optionalText("School, college or university."),
        year: optionalText("Year or range, exactly as written."),
      })
    )
    .default([]),
  certifications: textList("Named certifications only."),
  achievements: textList("Awards, publications, competition results."),
  domains: textList("Industries or problem domains the work sits in."),
  yearsOfExperience: z
    .number()
    .nullable()
    .default(null)
    .describe("Total professional years, if the resume makes it plain. Null otherwise."),
  currentRole: optionalText("The role they hold now, if the resume shows a current one."),
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Caps on what is kept.
 *
 * A profile is stored on the interview record and pasted into a system
 * instruction, so an eighty-item skills list is both storage the record does not
 * need and prompt budget spent on noise. The caps are generous enough that a
 * normal resume passes through untouched.
 */
const LIMITS = {
  skills: 40,
  technologies: 40,
  roles: 12,
  projects: 12,
  education: 8,
  certifications: 20,
  achievements: 20,
  domains: 12,
  highlights: 8,
  projectTechnologies: 16,
} as const;

/** The most professional years worth recording; beyond this it is a parse slip. */
const MAX_YEARS = 60;

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text === "" ? null : text;
}

/**
 * Trimmed, de-duplicated case-insensitively, capped.
 *
 * Case-insensitive because a resume that says "React" in its skills line and
 * "react" in a project bullet is listing one skill, and an interviewer handed
 * both would think it worth asking about twice.
 */
function cleanList(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    if (value === null) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= cap) break;
  }
  return out;
}

function cleanYears(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const years = Math.round(value);
  if (years < 0) return null;
  return Math.min(years, MAX_YEARS);
}

/**
 * Trims a parsed profile to what is safe and useful to store.
 *
 * Entries carrying no information at all are dropped rather than kept as rows of
 * nulls: an empty role would otherwise reach the prompt as "Unspecified title",
 * which reads to the model as a real employer it should ask the candidate about.
 */
export function normaliseResumeProfile(profile: ResumeProfile): ResumeProfile {
  return {
    name: cleanText(profile.name),
    headline: cleanText(profile.headline),
    summary: cleanText(profile.summary),
    skills: cleanList(profile.skills, LIMITS.skills),
    technologies: cleanList(profile.technologies, LIMITS.technologies),
    roles: profile.roles
      .map((role) => ({
        title: cleanText(role.title),
        company: cleanText(role.company),
        duration: cleanText(role.duration),
        highlights: cleanList(role.highlights, LIMITS.highlights),
      }))
      .filter(
        (role) =>
          role.title !== null || role.company !== null || role.highlights.length > 0
      )
      .slice(0, LIMITS.roles),
    projects: profile.projects
      .map((project) => ({
        name: cleanText(project.name),
        description: cleanText(project.description),
        technologies: cleanList(project.technologies, LIMITS.projectTechnologies),
      }))
      .filter((project) => project.name !== null || project.description !== null)
      .slice(0, LIMITS.projects),
    education: profile.education
      .map((entry) => ({
        degree: cleanText(entry.degree),
        institution: cleanText(entry.institution),
        year: cleanText(entry.year),
      }))
      .filter((entry) => entry.degree !== null || entry.institution !== null)
      .slice(0, LIMITS.education),
    certifications: cleanList(profile.certifications, LIMITS.certifications),
    achievements: cleanList(profile.achievements, LIMITS.achievements),
    domains: cleanList(profile.domains, LIMITS.domains),
    yearsOfExperience: cleanYears(profile.yearsOfExperience),
    currentRole: cleanText(profile.currentRole),
  };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * The prompt used to turn raw resume text into a ResumeProfile.
 *
 * Almost all of this prompt is one instruction said several ways: extract, do
 * not infer. The cost of a hallucinated field here is not a wrong record, it is
 * a wrong *interview*. An invented project becomes an interviewer asking the
 * candidate to walk through work they never did, live, on the clock they paid
 * for, with no graceful way out of the confusion. An empty array costs a
 * slightly more generic question, which is a far cheaper mistake.
 */
export function buildResumeExtractionPrompt(resumeText: string): string {
  return `You are extracting structured facts from a resume so that an interviewer can ask the candidate about their real experience.

EXTRACT ONLY WHAT IS ACTUALLY THERE
- Every value you return must be present in the resume text below. If it is not there, it does not go in.
- Do NOT infer, guess, complete or "reasonably assume" anything. A missing section is a missing section.
- Return an empty array for anything the resume does not list. An empty array is a correct answer and is always better than a plausible one.
- Use null for any fact the resume does not state, including yearsOfExperience when it is not plainly stated or plainly derivable from the dates given.

NEVER FABRICATE
- Never invent an employer, a job title, a date, a duration, a project, a degree, an institution or a certification.
- Never merge two entries into one, and never split one entry into two.
- Never upgrade a claim: if it says "assisted with", do not record "led".
- Do not translate, expand or tidy technology names. Copy them verbatim, exactly as written -- "Next.js", "node", "PostgreSQL", "TF" all stay as they appear. The interviewer will say these words out loud, and a name the candidate does not recognise is worse than no name at all.

HOW TO READ IT
- Keep the resume's own wording for titles, companies, dates and bullet points. Shorten only by cutting, never by rephrasing.
- If a bullet point is unclear, record it as written rather than interpreting it.
- If the text is garbled, truncated, or is not a resume at all, return empty arrays and nulls rather than constructing a profile out of whatever you can see.

RESUME TEXT
---
${resumeText.trim()}
---`;
}

// ---------------------------------------------------------------------------
// The interview instruction
// ---------------------------------------------------------------------------

export interface ResumeInterviewPromptConfig {
  candidateName: string;
  profile: ResumeProfile;
  /** The role being targeted, which may differ from the resume's own role. */
  targetRole: string;
  experienceLevel: string;
  interviewerName: string;
  interviewerStyle: string;
  interviewerTitle: string;
  topics: string[];
  durationSeconds: number;
}

/**
 * The seam where the shared safety rules go.
 *
 * The instruction ends with this marker instead of importing
 * UNIVERSAL_INTERVIEW_RULES directly, so this module stays independent of
 * lib/voice/prompt.ts and can be built and tested on its own. The point of a
 * marker rather than a silent omission is that it cannot be forgotten quietly: a
 * caller that skips the substitution ships a visible `{{UNIVERSAL_RULES}}` in
 * the prompt, and the test suite asserts the marker is the final line, so the
 * shared safety rules cannot be dropped from this interview type.
 */
export const RESUME_UNIVERSAL_RULES_MARKER = "{{UNIVERSAL_RULES}}";

/**
 * Human phrasing for a duration.
 *
 * A deliberate local copy of the same idea in lib/voice/prompt.ts rather than an
 * import: this module is the leaf and prompt.ts is the caller, so importing back
 * up would make the two files a cycle.
 */
function describeSessionLength(durationSeconds: number): string {
  if (durationSeconds < 60) return `${Math.round(durationSeconds)} seconds`;
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function bulletList(lines: string[], fallback: string): string {
  const clean = lines.filter((line) => line.trim() !== "");
  return clean.length > 0 ? clean.map((line) => `- ${line}`).join("\n") : `- ${fallback}`;
}

function describeRoles(profile: ResumeProfile): string {
  return bulletList(
    profile.roles.map((role) => {
      const title = role.title ?? "Unspecified title";
      const at = role.company ? ` at ${role.company}` : "";
      const when = role.duration ? ` (${role.duration})` : "";
      const highlights =
        role.highlights.length > 0 ? `\n  - ${role.highlights.join("\n  - ")}` : "";
      return `${title}${at}${when}${highlights}`;
    }),
    "The resume lists no employment history. Ask them what they have worked on rather than assuming they have not worked."
  );
}

function describeProjects(profile: ResumeProfile): string {
  return bulletList(
    profile.projects.map((project) => {
      const name = project.name ?? "Unnamed project";
      const what = project.description ? `: ${project.description}` : "";
      const tech =
        project.technologies.length > 0
          ? ` [built with ${project.technologies.join(", ")}]`
          : "";
      return `${name}${what}${tech}`;
    }),
    "The resume names no projects. Ask what they have built rather than assuming there is nothing."
  );
}

function describeEducation(profile: ResumeProfile): string {
  return bulletList(
    profile.education.map((entry) => {
      const degree = entry.degree ?? "Unspecified qualification";
      const where = entry.institution ? `, ${entry.institution}` : "";
      const when = entry.year ? ` (${entry.year})` : "";
      return `${degree}${where}${when}`;
    }),
    "The resume states no education. Do not treat that as information they owe you."
  );
}

/** The background the resume itself shows, used to frame the gap analysis. */
function resumeBackground(profile: ResumeProfile): string | null {
  return profile.currentRole ?? profile.roles[0]?.title ?? profile.headline ?? null;
}

/**
 * The interviewer's system instruction for a resume-based interview.
 *
 * What separates this from the role-based instruction in lib/voice/prompt.ts is
 * that the interviewer is handed the candidate's actual history and told that a
 * generic question is a wasted question whenever a specific one is available. A
 * resume interview that asks "tell me about a time you handled conflict" could
 * have been run without ever reading the resume.
 *
 * Two constraints in here are the reason this is its own builder rather than a
 * few extra lines on the technical one:
 *
 * 1. Substantiation without accusation. Pressing on a broad claim is the whole
 *    value of a resume interview, but calling a candidate a liar is a product
 *    failure of the same kind as telling a visa applicant they would be refused:
 *    the model is in no position to know, and a practice tool that leaves
 *    someone feeling accused has done real harm for no benefit. So the prompt
 *    asks relentlessly for mechanics, forbids the verdict outright, and routes
 *    thin substantiation into the written feedback where it can be phrased with
 *    care.
 *
 * 2. Gap analysis against a target role that may not be the resume's own. People
 *    practise for the job they want, so the pivot is the common case rather than
 *    the edge one, and the session is worth far more if it presses on the gap
 *    instead of politely interviewing them for the job they already have.
 */
export function buildResumeInterviewInstruction(
  config: ResumeInterviewPromptConfig
): string {
  const profile = normaliseResumeProfile(config.profile);
  const duration = describeSessionLength(config.durationSeconds);
  const targetRole = config.targetRole.trim() || "the role they are targeting";
  const background = resumeBackground(profile);

  const skills = profile.skills.length > 0 ? profile.skills.join(", ") : null;
  const technologies =
    profile.technologies.length > 0 ? profile.technologies.join(", ") : null;

  const identity = [
    profile.headline ? `Headline: ${profile.headline}` : null,
    profile.currentRole ? `Current role: ${profile.currentRole}` : null,
    profile.yearsOfExperience !== null
      ? `Stated experience: ${profile.yearsOfExperience} year${
          profile.yearsOfExperience === 1 ? "" : "s"
        }`
      : null,
    profile.domains.length > 0 ? `Domains: ${profile.domains.join(", ")}` : null,
    profile.summary ? `Their own summary: ${profile.summary}` : null,
    skills ? `Skills listed: ${skills}` : null,
    technologies ? `Technologies listed: ${technologies}` : null,
    profile.certifications.length > 0
      ? `Certifications: ${profile.certifications.join(", ")}`
      : null,
    profile.achievements.length > 0
      ? `Achievements: ${profile.achievements.join(", ")}`
      : null,
  ].filter((line): line is string => line !== null);

  const gapSection = background
    ? `GAP ANALYSIS: ${background} -> ${targetRole}
- Their background is ${background} and the role they are targeting is ${targetRole}. Where those differ, the gap is the most valuable thing in this interview: probe it directly, and fairly.
- Ask how what they have actually done transfers. Which parts of their experience carry over, which do not, and what have they done to close the difference?
- Probe the target role's own ground, not only their comfort zone. For example, a candidate with a frontend background targeting an AI Engineer role should be asked about LLMs, RAG, embeddings and evaluation -- what they have read, built or tried, and where their understanding currently stops.
- If the gap is real and unclosed, that is a finding for the written feedback. Ask the question, take the answer, move on. Do not lecture them about being unqualified and do not tell them they are not ready.
- If their background already matches ${targetRole}, spend the time on depth instead: go further into the work they have actually done than a generic interview would.`
    : `GAP ANALYSIS AGAINST ${targetRole}
- The resume does not make their background clear, so establish it by asking before you assess any gap against ${targetRole}.
- Never assume they lack experience simply because the resume did not show it. Ask how their experience transfers once you know what it is.`;

  return `You are ${config.interviewerName}, a ${config.interviewerTitle}, conducting a live voice mock interview with ${config.candidateName}. This interview is built from ${config.candidateName}'s own resume, and they are targeting a ${targetRole} position.

YOUR MANNER
${config.interviewerStyle}

CANDIDATE LEVEL: ${config.experienceLevel}

THEIR RESUME -- THIS IS YOUR SOURCE MATERIAL
${bulletList(identity, "The resume yielded no summary details. Build your picture by asking.")}

THEIR ROLES AND EMPLOYERS
${describeRoles(profile)}

THEIR PROJECTS
${describeProjects(profile)}

THEIR EDUCATION
${describeEducation(profile)}

TOPICS TO STEER TOWARDS
${bulletList(
  config.topics,
  `Whatever their resume and the ${targetRole} role make relevant`
)}
These are a guide, not a queue. Reach them through the resume rather than asking them cold.

USE THE RESUME IN EVERY QUESTION YOU CAN
- Open by referencing something specific from the resume -- a named project, a named employer, or a named technology -- so it is obvious from your first sentence that you have read it.
- Ask about their actual projects and their actual employers BY NAME. "At ${
    profile.roles[0]?.company ?? "the company on your resume"
  }, you wrote that you..." is the register you want.
- Never ask a generic question when a resume-specific one is available. "Tell me about a challenge you faced" is a wasted question when their resume names the exact system they built.
- Quote their own bullet points back to them and ask what is underneath one.
- If something is NOT in the profile above, it is not a fact you have. Ask about it rather than assuming it, and never state a detail about their history that the resume did not give you.

FOLLOW-UPS: DRILL INTO THE ANSWER JUST GIVEN
- Your next question comes from the answer you just heard, not from the resume section you were planning to reach.
- Take the vaguest noun in their answer and make them make it concrete. Worked example:
    Candidate: "I optimised the database."
    You: "Which specific bottleneck, and what did you change?"
  Then keep going: what was it before, what was it after, how did they measure it, what did they try first that did not work.
- Three or four layers deep on one real thing tells you more than four surface questions about four things.

SUBSTANTIATING WHAT THE RESUME CLAIMS
- A resume is a claim, not evidence. Your job is to find out what sits underneath a claim, never to rule on whether it is true.
- Where the resume makes a broad claim -- "built scalable microservices", "improved performance by 40%", "led the team" -- ask them to walk through their own specific contribution and the concrete mechanics. Which part did they personally write or decide? What was the scale, in real numbers? Who else worked on it? What was the improvement measured against?
- Ask for mechanics, never for reassurance. "Which part of that did you build yourself?" is a good question; "are you sure you really did that?" is not a question at all.
- NEVER accuse the candidate of lying, exaggerating, inflating or being dishonest, and never hint at it. Do NOT say or imply that a claim is false, unproven, doubtful, or does not add up. Do not demand proof, and do not ask them to defend their honesty.
- If a claim stays thin after two genuine attempts to get at the specifics, do not confront them about it. Ask your next question and move on. Note it privately as weak substantiation: the written feedback afterwards is where that belongs, phrased as something to prepare better, and it is never something to raise during the conversation.

${gapSection}

HOW TO CONDUCT THIS CONVERSATION
- Ask ONE question at a time. Never stack two questions into one turn.
- Then stop talking and listen. Do not fill silence while the candidate is thinking.
- Keep every turn short. This is speech, not prose: two or three sentences is usually right, and never monologue.
- If an answer is vague, generic, evasive, or clearly memorised, probe it rather than moving on.
- If an answer contradicts the resume or something said earlier, ask them to clarify it plainly, without implying they have been caught out.
- Track what you have already covered and never repeat a question you have already asked.
- Do NOT give the candidate the answers, do NOT teach, and do NOT tell them how they are doing. They receive written feedback after the interview; your job during it is to assess.

TIME
- This interview runs for ${duration} and ends when the time is up.
- It does NOT end when you run out of resume material or listed topics. The lists above are a guide, not a queue to work through.
- If you have been through the whole resume and time remains, go deeper: revisit the strongest answer and push further, or pose a practical scenario drawn from their own domain. There is always more to ask.
- Never announce that you have run out of questions.

HOW THIS INTERVIEW ENDS
- You cannot end this session, and you must never try to. It is ended by the application when the clock runs out, or by the candidate pressing the End button.
- If you are told the time is nearly up, stop opening new topics and bring the current thread to a close, but keep talking with the candidate until the system ends the call.

OPENING
Introduce yourself by name in one sentence, name one specific thing from their resume, and ask your first question about it.
${RESUME_UNIVERSAL_RULES_MARKER}`;
}

// ---------------------------------------------------------------------------
// Confirmation screen
// ---------------------------------------------------------------------------

function countOf(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/**
 * A short human summary for the confirmation screen.
 *
 * The candidate sees this straight after upload, and it is their only chance to
 * notice that the wrong file was parsed, so it leads with the facts that would
 * look wrong at a glance: how long they have worked and what they do now. A
 * profile with nothing in it says so plainly rather than rendering a row of
 * zeroes, because "0 skills detected" reads as a judgement of the candidate
 * rather than as a parse result.
 */
export function describeResumeProfile(profile: ResumeProfile): string {
  const clean = normaliseResumeProfile(profile);

  const opening: string[] = [];
  if (clean.yearsOfExperience !== null) {
    opening.push(`${countOf(clean.yearsOfExperience, "year")} of experience`);
  }
  const current = clean.currentRole ?? clean.roles[0]?.title ?? null;
  if (current) opening.push(`currently a ${current}`);

  const counts: string[] = [];
  if (clean.skills.length > 0) counts.push(countOf(clean.skills.length, "skill"));
  if (clean.projects.length > 0) counts.push(countOf(clean.projects.length, "project"));

  const sentences: string[] = [];
  if (opening.length > 0) sentences.push(`${opening.join(", ")}.`);
  if (counts.length > 0) sentences.push(`${counts.join(", ")} detected.`);

  if (sentences.length === 0) {
    return "No details could be read from this resume. The interview will start from your answers instead.";
  }
  return sentences.join(" ");
}
