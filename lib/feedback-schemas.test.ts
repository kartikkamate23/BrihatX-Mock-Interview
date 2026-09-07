import { describe, expect, it } from "vitest";

import { questionReviewSchema, standardFeedbackSchema } from "./feedback-schemas";

const review = {
  question: "Tell me about a difficult problem you solved.",
  candidateAnswer: "I described a production incident and how I debugged it.",
  score: 74,
  whatWasGood: ["Named the real situation and the debugging approach."],
  mistakes: ["Did not explain the measurable result."],
  howToImprove: ["Close with the result and what changed afterward."],
  improvedAnswer: "In a production incident, I first isolated the failing service, then verified the fix and documented the prevention steps. The change reduced repeat alerts by [add your real metric].",
};

const standard = {
  totalScore: 70,
  categoryScores: [
    { name: "Communication Skills", score: 70, comment: "Clear overall." },
    { name: "Technical Knowledge", score: 72, comment: "Sound fundamentals." },
    { name: "Problem Solving", score: 74, comment: "Logical approach." },
    { name: "Cultural Fit", score: 68, comment: "Professional tone." },
    { name: "Confidence and Clarity", score: 66, comment: "Mostly confident." },
  ],
  strengths: ["Structured the response."],
  areasForImprovement: ["Add measurable outcomes."],
  finalAssessment: "A solid interview with room for more specific evidence.",
  questionReviews: [review],
};

describe("question-by-question feedback schema", () => {
  it("accepts a complete answer review", () => {
    expect(questionReviewSchema.parse(review)).toEqual(review);
  });

  it("requires question reviews on newly generated standard feedback", () => {
    expect(standardFeedbackSchema.parse(standard).questionReviews).toHaveLength(1);
    const { questionReviews: _removed, ...withoutReviews } = standard;
    expect(standardFeedbackSchema.safeParse(withoutReviews).success).toBe(false);
  });

  it("allows an empty strengths list without inventing praise", () => {
    expect(questionReviewSchema.parse({ ...review, whatWasGood: [] }).whatWasGood).toEqual([]);
  });
});
