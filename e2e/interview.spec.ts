import type { Page } from "@playwright/test";

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
 * The interview itself, against the real Gemini Live API.
 *
 * Tagged @dev because these need the development duration override to run a
 * whole interview in seconds rather than minutes. The override is deliberately
 * inert in production, and plan-limits.spec.ts proves that.
 *
 * Nothing here is mocked: a real Chrome opens a real (synthetic) camera and
 * microphone, a real ephemeral token is minted, a real model speaks, and a real
 * feedback document is written.
 */

const SHORT = 25; // seconds -- long enough for a greeting and a question

test.describe("the interview @dev", () => {
  test("opens the camera, fills the panel, and holds a live microphone", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=${SHORT}`);
    await startInterview(page);

    // The camera must actually be producing frames, not merely be requested.
    await expect
      .poll(async () => (await mediaTrackState(page)).videoWidth, { timeout: 30_000 })
      .toBeGreaterThan(0);

    const media = await mediaTrackState(page);
    expect(media.hasStream).toBe(true);
    expect(media.video).toEqual(["live"]);
    // The microphone is the interview's input, so it must be held here rather
    // than handed to a separate SDK.
    expect(media.audio).toEqual(["live"]);

    // The camera fills its panel rather than sitting in a small avatar.
    const box = await page.locator("video").boundingBox();
    expect(box!.width).toBeGreaterThan(500);
    await expect(page.locator("video")).toHaveClass(/object-cover/);

    await expect(page.getByText("Camera on")).toBeVisible();
    await expect(page.getByText("Mic on")).toBeVisible();
  });

  test("the interviewer speaks first and the transcript records it", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({
      role: "Backend Developer",
      topics: ["Databases & SQL"],
      durationSeconds: 300,
    });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=${SHORT}`);
    await startInterview(page);

    // The model opens the conversation; the transcript strip shows the line.
    await expect(page.getByText("Tanya", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".transcript")).toBeVisible({ timeout: 60_000 });
    const spoken = await page.locator(".transcript").innerText();
    expect(spoken.length).toBeGreaterThan(20);
  });

  test("the clock counts down once and does not restart on a re-render", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=60`);
    await startInterview(page);

    const clock = page.getByTestId("interview-clock");
    await expect(clock).toBeVisible({ timeout: 45_000 });

    const first = await readClockSeconds(page);
    // The dev override caps the session well below the plan's 15 minutes.
    expect(first).toBeLessThanOrEqual(60);

    await page.waitForTimeout(6000);
    const second = await readClockSeconds(page);

    // Monotonically down, and by roughly the wall-clock time that passed --
    // a timer that restarted would read ~60 again.
    expect(second).toBeLessThan(first);
    expect(first - second).toBeGreaterThanOrEqual(4);
    expect(first - second).toBeLessThanOrEqual(9);

    await endInterview(page);
  });

  test("expiry ends the interview, releases the devices, and scores it exactly once", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });
    const consoleErrors = captureConsoleErrors(page);

    await page.goto(`/interview/${interviewId}?devDurationSeconds=${SHORT}`);
    await startInterview(page);

    // Let the whole interview run out on its own. Nothing is clicked.
    await page.waitForURL(`**/interview/${interviewId}/feedback`, {
      timeout: 150_000,
    });

    const sessions = await readSessions(uid);
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(session.status).toBe("completed");
    expect(session.endReason).toBe("duration_expired");
    expect(session.grantedSeconds).toBe(SHORT);
    // Elapsed is measured server-side against the recorded start.
    expect(Number(session.elapsedSeconds)).toBeGreaterThan(SHORT - 10);
    expect(Number(session.elapsedSeconds)).toBeLessThanOrEqual(SHORT);
    expect(session.completedFullDuration).toBe(true);
    // The transcript is persisted, not merely passed to the scorer.
    expect(Array.isArray(session.transcript)).toBe(true);
    expect((session.transcript as unknown[]).length).toBeGreaterThan(0);

    // Exactly one feedback document, however many ways the end was reached.
    const feedback = await readFeedbackFor(interviewId);
    expect(feedback).toHaveLength(1);
    expect(Number(feedback[0].totalScore)).toBeGreaterThanOrEqual(0);

    // The webcam light must be out. The <video> is gone from the feedback page,
    // so this asserts the page no longer holds a stream at all.
    const media = await mediaTrackState(page);
    expect(media.hasStream).toBe(false);

    // A normal disconnect is not an application error. This is the assertion
    // that the previous architecture could not have passed: ending a call there
    // always logged a failure on the way out.
    expect(applicationErrors(consoleErrors)).toEqual([]);
  });

  test("ending early is not an error and still saves and scores the interview", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });
    const consoleErrors = captureConsoleErrors(page);

    await page.goto(`/interview/${interviewId}?devDurationSeconds=120`);
    await startInterview(page);

    // Let the interviewer say something so there is a transcript to score.
    await expect(page.locator(".transcript")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(4000);

    await endInterview(page);
    await page.waitForURL(`**/interview/${interviewId}/feedback`, {
      timeout: 120_000,
    });

    const [session] = await readSessions(uid);
    expect(session.status).toBe("completed");
    expect(session.endReason).toBe("manual");
    // Ended early, so it did not run the full length -- and that is recorded as
    // a fact about the session, not as a failure.
    expect(session.completedFullDuration).toBe(false);
    expect(session.outcome).toBe("scored");

    expect(await readFeedbackFor(interviewId)).toHaveLength(1);
    // Ending early is a normal way to finish, so it must log nothing either.
    expect(applicationErrors(consoleErrors)).toEqual([]);
  });

  test("reloading mid-interview does not spend a second interview credit", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=120`);
    await startInterview(page);
    await expect(page.getByTestId("interview-clock")).toBeVisible({ timeout: 45_000 });

    expect(await readSessions(uid)).toHaveLength(1);

    // The candidate refreshes and starts again -- one attempt, not two.
    await page.reload();
    await startInterview(page);
    await expect(page.getByTestId("interview-clock")).toBeVisible({ timeout: 45_000 });

    expect(await readSessions(uid)).toHaveLength(1);

    await endInterview(page);
  });

  test("warns about attention when no face is visible to the camera", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=90`);
    await startInterview(page);

    // Chrome's fake camera shows a rolling pattern, so no face is ever detected.
    // The tracker tolerates that for its grace period and then, five seconds
    // later, raises exactly one warning.
    await expect(page.getByRole("alert").filter({ hasText: "Attention Warning" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText("Please maintain eye contact with the interview camera.")
    ).toBeVisible();

    await endInterview(page);
  });

  test("the candidate can turn the camera and microphone off during the interview", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("pro");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=90`);
    await startInterview(page);
    await expect(page.getByText("Camera on")).toBeVisible({ timeout: 45_000 });

    await page.getByRole("button", { name: "Turn your camera off" }).click();
    await expect(page.getByText("Camera off")).toBeVisible();

    await page.getByRole("button", { name: "Mute your microphone" }).click();
    await expect(page.getByText("Mic off")).toBeVisible();

    // Disabled, not stopped: turning it back on must not need a new permission
    // round-trip, so the track has to still be live.
    const media = await mediaTrackState(page);
    expect(media.video).toEqual(["live"]);

    await endInterview(page);
  });
});

// ---------------------------------------------------------------------------

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

/** Reads the countdown as a number of seconds. */
async function readClockSeconds(page: Page): Promise<number> {
  const text = await page.getByTestId("interview-clock").innerText();
  const match = text.match(/(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Could not read the clock from "${text}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}
