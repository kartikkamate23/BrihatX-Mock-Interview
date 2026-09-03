import type { Page } from "@playwright/test";

import { admin } from "./auth";
import {
  applicationErrors,
  captureConsoleErrors,
  expect,
  mediaTrackState,
  readFeedbackFor,
  readSessions,
  test,
} from "./fixtures";

/**
 * A visa interview, end to end, against the real Gemini Live API.
 *
 * The point of this spec is that a visa interview is not a second interview
 * system: it runs through the same voice provider, the same camera and
 * microphone, the same countdown, the same plan gate and the same finalisation
 * as a job interview. What differs is the instruction the officer is given and
 * the shape of the report at the end -- and both of those are asserted here.
 */

const SHORT = 25; // seconds -- long enough for a greeting and a question or two

test.describe("visa interview @dev", () => {
  test("runs on the same voice, camera and timer infrastructure", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({
      interviewType: "visa",
      visaType: "f1-student",
      visaTypeLabel: "F1 Student Visa",
      destination: "United States",
      durationSeconds: 300,
    });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=${SHORT}`);

    // The practice disclaimer must be on the screen before anything starts.
    await expect(
      page.getByText(/cannot tell you whether a real visa application would succeed/)
    ).toBeVisible();

    await startInterview(page);

    // Same camera path as every other interview type.
    await expect
      .poll(async () => (await mediaTrackState(page)).videoWidth, { timeout: 30_000 })
      .toBeGreaterThan(0);
    const media = await mediaTrackState(page);
    expect(media.video).toEqual(["live"]);
    expect(media.audio).toEqual(["live"]);

    // Same countdown.
    await expect(page.getByTestId("interview-clock")).toBeVisible({ timeout: 45_000 });

    // The officer opens the conversation.
    await expect(page.locator(".transcript")).toBeVisible({ timeout: 60_000 });
    const opening = await page.locator(".transcript").innerText();
    expect(opening.length).toBeGreaterThan(15);

    // Identified as a visa officer, not as a named job interviewer.
    await expect(page.getByText("Visa Officer").first()).toBeVisible();

    await endInterview(page);
  });

  test("expires on time and produces a visa report, not a job one", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({
      interviewType: "visa",
      visaType: "b1-b2-visitor",
      visaTypeLabel: "B1/B2 Visitor Visa",
      visaMode: "standard",
      destination: "United States",
      durationSeconds: 300,
    });
    const consoleErrors = captureConsoleErrors(page);

    await page.goto(`/interview/${interviewId}?devDurationSeconds=${SHORT}`);
    await startInterview(page);

    // Nothing is clicked: the clock ends it.
    await page.waitForURL(`**/interview/${interviewId}/feedback`, { timeout: 150_000 });

    const sessions = await readSessions(uid);
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(session.interviewType).toBe("visa");
    expect(session.status).toBe("completed");
    // The same termination rule as every other type: time, never question count.
    expect(session.endReason).toBe("duration_expired");
    expect(session.grantedSeconds).toBe(SHORT);
    expect(session.completedFullDuration).toBe(true);
    expect((session.transcript as unknown[]).length).toBeGreaterThan(0);

    // Exactly one report, scored against the visa categories.
    const feedback = await readFeedbackFor(interviewId);
    expect(feedback).toHaveLength(1);
    const report = feedback[0];
    expect(report.interviewType).toBe("visa");

    const categories = (report.categoryScores as { name: string }[]).map((c) => c.name);
    expect(categories).toEqual([
      "Confidence",
      "Clarity",
      "Conciseness",
      "Relevance",
      "Consistency",
      "Communication",
      "Answer Quality",
      "Visa Interview Readiness",
    ]);

    // The visa detail block is present and structured.
    const visa = report.visa as Record<string, unknown>;
    expect(visa).toBeTruthy();
    expect(Array.isArray(visa.practiceAreas)).toBe(true);
    expect(typeof visa.readiness).toBe("string");
    expect(typeof visa.nextRecommendation).toBe("string");

    /**
     * The product's central safety rule, checked against what the model actually
     * wrote. A practice tool must never tell someone their real visa application
     * would be approved or refused.
     */
    const prose = [
      report.finalAssessment,
      visa.readiness,
      visa.nextRecommendation,
      ...(report.strengths as string[]),
      ...(report.areasForImprovement as string[]),
    ]
      .join(" ")
      .toLowerCase();
    expect(prose).not.toMatch(/will be (approved|rejected|denied|refused|granted)/);
    expect(prose).not.toMatch(/you would be (approved|rejected|denied|refused|granted)/);
    expect(prose).not.toMatch(/guarantee/);

    // The feedback page renders the visa sections and the disclaimer.
    await expect(page.getByText("Visa Interview").first()).toBeVisible();
    await expect(page.getByText("Visa Interview Readiness")).toBeVisible();
    await expect(
      page.getByText(/no simulation can tell you how a real visa application would be decided/i)
    ).toBeVisible();

    // Devices released, and a normal ending is not an error.
    expect((await mediaTrackState(page)).hasStream).toBe(false);
    expect(applicationErrors(consoleErrors)).toEqual([]);
  });

  test("ending early is not an error", async ({ page, signIn, seedInterview, uid }) => {
    await signIn("pro");
    const interviewId = await seedInterview({
      interviewType: "visa",
      durationSeconds: 300,
    });
    const consoleErrors = captureConsoleErrors(page);

    await page.goto(`/interview/${interviewId}?devDurationSeconds=120`);
    await startInterview(page);
    await expect(page.locator(".transcript")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(4000);

    await endInterview(page);
    await page.waitForURL(`**/interview/${interviewId}/feedback`, { timeout: 120_000 });

    const [session] = await readSessions(uid);
    expect(session.endReason).toBe("manual");
    expect(session.completedFullDuration).toBe(false);
    expect(session.outcome).toBe("scored");
    expect(applicationErrors(consoleErrors)).toEqual([]);
  });

  test("a visa interview consumes the same plan credit as any other", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    // Two interviews on a free plan: the second must be refused by the same
    // quota gate, with no separate visa allowance.
    await signIn("starter");
    const { db } = admin();

    // Burn both of the free plan's monthly credits.
    for (let i = 0; i < 2; i++) {
      await db.collection("sessions").add({
        userId: uid,
        interviewId: `spent-${i}`,
        planId: "starter",
        status: "completed",
        grantedSeconds: 300,
        startedAt: new Date().toISOString(),
      });
    }

    const interviewId = await seedInterview({
      interviewType: "visa",
      durationSeconds: 300,
    });
    await page.goto(`/interview/${interviewId}`);

    // The existing out-of-interviews UI, not a visa-specific one.
    await expect(page.getByText("No interviews left this month")).toBeVisible();
    await expect(page.getByRole("link", { name: "View plans" })).toBeVisible();

    const before = (await readSessions(uid)).length;
    expect(before).toBe(2);
  });
});

async function startInterview(page: Page) {
  await page.getByRole("checkbox").check();
  const start = page.getByRole("button", { name: /Start interview/i });
  await expect(start).toBeEnabled();
  await start.click();
}

async function endInterview(page: Page) {
  const end = page.getByRole("button", { name: "End", exact: true });
  if ((await end.count()) === 0) return;
  await end.click();
  await page.getByRole("button", { name: "End interview" }).click();
}
