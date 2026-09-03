import { z } from "zod";

import { feedbackSchema } from "@/constants";
import type { InterviewType } from "@/lib/interview-types";

/**
 * What the model is asked to return when scoring a transcript.
 *
 * Every schema here keeps the same five top-level fields -- `totalScore`,
 * `categoryScores`, `strengths`, `areasForImprovement`, `finalAssessment` --
 * because the feedback page already renders exactly those, and a document that
 * changed shape per interview type would mean either a second feedback page or a
 * page full of branches. A visa report adds its detail *underneath* that common
 * shape, in an optional `visa` block, so an existing record with no such block
 * renders exactly as it always did.
 *
 * Category names are `z.literal` tuples rather than free-form strings on
 * purpose: the scores are rendered as a fixed set of labelled bars, and a model
 * free to invent a sixth category would break that layout. Tuples cannot be
 * expressed in Gemini's native structured-output mode, which is why every call
 * that uses these passes `structuredOutputs: false` to fall back to tool mode.
 */

/** Technical and communication interviews keep the original five categories. */
export const standardFeedbackSchema = feedbackSchema;

const scored = <T extends string>(name: T) =>
  z.object({
    name: z.literal(name),
    score: z.number().describe("0 to 100."),
    comment: z.string().describe("One or two specific sentences citing what was said."),
  });

const visaAnswerNote = z.object({
  question: z.string().describe("The officer's question, paraphrased briefly."),
  note: z.string().describe("What was good or what was wrong with the answer."),
});

/**
 * The visa report.
 *
 * The wording constraints are enforced in the prompt rather than the schema --
 * a schema cannot stop a model writing "you would be refused" inside a string --
 * but the field names are chosen so that there is no natural slot for a verdict
 * to go. There is a readiness summary and a practice recommendation; there is
 * deliberately no "outcome", "decision" or "likelihood" field, because the
 * product must never claim to predict a real decision.
 */
export const visaFeedbackSchema = z.object({
  totalScore: z.number().describe("Overall practice score, 0 to 100."),
  categoryScores: z.tuple([
    scored("Confidence"),
    scored("Clarity"),
    scored("Conciseness"),
    scored("Relevance"),
    scored("Consistency"),
    scored("Communication"),
    scored("Answer Quality"),
    scored("Visa Interview Readiness"),
  ]),
  strengths: z.array(z.string()).describe("What the candidate did well."),
  areasForImprovement: z
    .array(z.string())
    .describe("What to work on, phrased as an action."),
  finalAssessment: z
    .string()
    .describe(
      "A short summary of how the practice session went. Never state or imply a real visa outcome."
    ),
  visa: z.object({
    strongAnswers: z
      .array(visaAnswerNote)
      .describe("Answers that were clear, specific and credible."),
    weakAnswers: z
      .array(visaAnswerNote)
      .describe("Answers that an officer would have pushed back on."),
    tooLongAnswers: z
      .array(visaAnswerNote)
      .describe("Answers that rambled or over-explained."),
    tooVagueAnswers: z
      .array(visaAnswerNote)
      .describe("Answers that lacked the specifics an officer expects."),
    contradictions: z
      .array(z.string())
      .describe("Points where answers conflicted with each other. Empty if none."),
    struggledWith: z
      .array(z.string())
      .describe("Questions or topics where the candidate hesitated or lost the thread."),
    suggestedAnswers: z
      .array(
        z.object({
          question: z.string(),
          suggestion: z
            .string()
            .describe("A tighter, more specific way the candidate could have answered."),
        })
      )
      .describe("Concrete rewrites, in the candidate's own situation."),
    practiceAreas: z
      .array(z.string())
      .describe("Specific things to rehearse before the real interview."),
    readiness: z
      .string()
      .describe(
        "How prepared the candidate sounds, as practice feedback only. Never a prediction of a real decision."
      ),
    nextRecommendation: z
      .string()
      .describe("What to practise in the next session, and in which mode."),
  }),
});

export type VisaFeedback = z.infer<typeof visaFeedbackSchema>;

/**
 * The resume interview report.
 *
 * Shares the same five top-level fields as every other type so the feedback page
 * renders it without branching, and adds a `resume` block for the things only
 * this interview can say: whether the answers substantiated what the resume
 * claimed, and where the gap to the target role showed.
 *
 * "Substantiation" rather than "accuracy" is deliberate wording. The interview
 * cannot know whether a resume is truthful -- it can only observe whether the
 * candidate explained a claim convincingly under questioning, which is a fact
 * about the answer and not an accusation about the person.
 */
export const resumeFeedbackSchema = z.object({
  totalScore: z.number().describe("Overall interview score, 0 to 100."),
  categoryScores: z.tuple([
    scored("Technical Knowledge"),
    scored("Communication"),
    scored("Confidence"),
    scored("Answer Relevance"),
    scored("Resume Substantiation"),
    scored("Depth of Experience"),
  ]),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
  resume: z.object({
    strongAnswers: z
      .array(visaAnswerNote)
      .describe("Answers that were specific, credible and well structured."),
    weakAnswers: z
      .array(visaAnswerNote)
      .describe("Answers an interviewer would have pushed back on."),
    missedOpportunities: z
      .array(z.string())
      .describe("Resume material the candidate could have used but did not."),
    suggestedAnswers: z
      .array(z.object({ question: z.string(), suggestion: z.string() }))
      .describe("Stronger versions of specific answers, in the candidate's own situation."),
    studyTopics: z
      .array(z.string())
      .describe("Topics to revise before a real interview."),
    resumeRecommendations: z
      .array(z.string())
      .describe(
        "Changes to the resume itself: claims that need evidence, or strengths that are undersold."
      ),
    targetRoleGap: z
      .string()
      .describe(
        "How the candidate's background lines up with the role they targeted, and what is missing."
      ),
  }),
});

export type ResumeFeedback = z.infer<typeof resumeFeedbackSchema>;

/** The schema to score a given interview type's transcript with. */
export function feedbackSchemaFor(type: InterviewType) {
  if (type === "visa") return visaFeedbackSchema;
  if (type === "resume") return resumeFeedbackSchema;
  return standardFeedbackSchema;
}
