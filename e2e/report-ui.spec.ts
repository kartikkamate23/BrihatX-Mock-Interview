import { admin } from "./auth";
import {
  applicationErrors,
  captureConsoleErrors,
  expect,
  test,
} from "./fixtures";

/**
 * The scored-report and dashboard presentation.
 *
 * These screens are built from a feedback document, and reaching one through a
 * real interview costs a live model session and several minutes per assertion.
 * Seeding the document directly exercises exactly the same server components
 * with exactly the same data shape, so the rendering is genuinely tested
 * without spending quota to produce a score whose value the test then ignores.
 *
 * The seeded document is deleted afterwards.
 */
async function seedFeedback(
  interviewId: string,
  uid: string,
  overrides: Record<string, unknown> = {}
) {
  const { db } = admin();
  const ref = await db.collection("feedback").add({
    interviewId,
    userId: uid,
    totalScore: 74,
    interviewType: "technical",
    categoryScores: [
      { name: "Communication", score: 82, comment: "Clear and well paced." },
      { name: "Technical Knowledge", score: 61, comment: "Some gaps on scaling." },
      { name: "Confidence", score: 88, comment: "Assured throughout." },
      { name: "Problem Solving", score: 55, comment: "Jumped to an answer early." },
    ],
    strengths: ["Structured answers", "Concrete examples"],
    areasForImprovement: ["Quantify impact", "Slow down on trade-offs"],
    finalAssessment: "A solid interview with clear communication.",
    session: {
      durationSeconds: 300,
      elapsedSeconds: 296,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      completedFullDuration: true,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  });
  return ref.id;
}

async function deleteFeedback(id: string) {
  const { db } = admin();
  await db.collection("feedback").doc(id).delete();
}

test.describe("scored report @prod", () => {
  test("shows the score as a ring and every category as a meter", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });
    const feedbackId = await seedFeedback(interviewId, uid);
    const consoleErrors = captureConsoleErrors(page);

    try {
      await page.goto(`/interview/${interviewId}/feedback`);

      // The overall score is a labelled graphic, not a number in a sentence.
      await expect(
        page.getByRole("img", { name: /74 out of 100/i })
      ).toBeVisible();

      // Every category carries real meter semantics rather than nested divs.
      const meters = page.getByRole("meter");
      await expect(meters).toHaveCount(4);
      await expect(
        page.getByRole("meter", { name: /Communication: 82 out of 100/i })
      ).toBeVisible();

      // The band label must not flatter a middling score.
      await expect(page.getByText("Developing").first()).toBeVisible();

      await expect(page.getByText("Structured answers")).toBeVisible();
      await expect(page.getByText("Quantify impact")).toBeVisible();

      expect(applicationErrors(consoleErrors)).toEqual([]);
    } finally {
      await deleteFeedback(feedbackId);
    }
  });

  test("reports what the camera-attention monitor observed", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });
    // Recorded on every interview, and until now never shown on any screen.
    const feedbackId = await seedFeedback(interviewId, uid, {
      attention: {
        warnings: 2,
        events: [
          { type: "attention_warning", startedAt: 42_000, duration: 6000, resolvedAt: 48_000 },
          { type: "attention_warning", startedAt: 130_000, duration: 9000, resolvedAt: 139_000 },
        ],
      },
    });

    try {
      await page.goto(`/interview/${interviewId}/feedback`);

      await expect(page.getByText("Camera attention")).toBeVisible();
      await expect(page.getByText("2 warnings")).toBeVisible();
      // The longest stretch, in seconds.
      await expect(page.getByText("9s", { exact: true })).toBeVisible();

      // The wording must stay observational. This tool reports where someone
      // appeared to be looking; it must never characterise that as cheating.
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(/cheat|dishonest|suspicious|violation/i);
      expect(body).toMatch(/cannot tell why/i);
    } finally {
      await deleteFeedback(feedbackId);
    }
  });

  test("an unscored interview still renders its own state", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}/feedback`);

    await expect(page.getByText(/No feedback yet/i)).toBeVisible();
    // No ring, because there is no score to draw.
    await expect(page.getByRole("img", { name: /out of 100/i })).toHaveCount(0);
  });

  test("the dashboard summarises practice once something is scored", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });
    const feedbackId = await seedFeedback(interviewId, uid);

    try {
      await page.goto("/");

      await expect(page.getByText("Average score")).toBeVisible();
      await expect(page.getByText("Best score")).toBeVisible();

      // A ring is drawn for the average. Its value is deliberately not asserted:
      // the account carries whatever other interviews it has been used for, so
      // pinning the average to this one seeded score would make the test depend
      // on the order the suite happened to run in.
      await expect(
        page.getByRole("img", { name: /out of 100/i }).first()
      ).toBeVisible();

      // The seeded score is the one the list shows for this interview.
      await expect(page.getByText("74/100").first()).toBeVisible();
    } finally {
      await deleteFeedback(feedbackId);
    }
  });
});
