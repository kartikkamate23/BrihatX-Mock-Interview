import { expect, readSessions, test, walkToJobDuration } from "./fixtures";

/**
 * Plan enforcement, in a real browser.
 *
 * The important assertions here are the server-side ones. That the wizard
 * disables a 15-minute button on a free plan is a courtesy; that a free account
 * cannot *obtain* a 15-minute session even when the interview document asks for
 * one is the actual control, and it is checked by reading what the server wrote.
 *
 * Tagged @prod because two of these depend on production behaviour: the
 * development duration override must be ignored, and the plan gate must run
 * against a production build.
 */

test.describe("plan limits @prod", () => {
  test("a free account is offered only the 5 minute session", async ({
    page,
    signIn,
  }) => {
    await signIn("starter");
    await page.goto("/interview");

    // Type -> Role -> Topics -> Experience -> Interviewer -> Duration
    await walkToJobDuration(page, "Software Engineer");

    const lengths = page.getByRole("group", { name: "Interview length" });
    await expect(lengths.getByRole("button", { name: /^5 min/ })).toBeEnabled();
    await expect(lengths.getByRole("button", { name: /^10 min/ })).toBeDisabled();
    await expect(lengths.getByRole("button", { name: /^15 min/ })).toBeDisabled();
  });

  test("an accelerator account unlocks 10 but not 15 minutes", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    await signIn("accelerator");
    const interviewId = await seedInterview({ durationSeconds: 600 });
    await page.goto(`/interview/${interviewId}`);

    const lengths = page.getByRole("group", { name: "Interview length" });
    await expect(lengths.getByRole("button", { name: /^5 min/ })).toBeEnabled();
    await expect(lengths.getByRole("button", { name: /^10 min/ })).toBeEnabled();
    await expect(lengths.getByRole("button", { name: /^15 min/ })).toBeDisabled();
  });

  test("pro and mastery accounts unlock the 15 minute session", async ({
    page,
    signIn,
    seedInterview,
  }) => {
    for (const plan of ["pro", "mastery"]) {
      await signIn(plan);
      const interviewId = await seedInterview({ durationSeconds: 900 });
      await page.goto(`/interview/${interviewId}`);

      const lengths = page.getByRole("group", { name: "Interview length" });
      await expect(
        lengths.getByRole("button", { name: /^15 min/ }),
        `15 minutes should be available on ${plan}`
      ).toBeEnabled();
    }
  });

  test("the server clamps a free account to 5 minutes even when the interview asks for 15", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("starter");
    // An interview built while on a higher plan, opened after a downgrade. The
    // document says 900 seconds; the account may have 300.
    const interviewId = await seedInterview({ durationSeconds: 900 });

    await page.goto(`/interview/${interviewId}`);
    await acceptTermsAndStart(page);

    // Wait for the server to have recorded the session.
    await expect
      .poll(async () => (await readSessions(uid)).length, { timeout: 60_000 })
      .toBeGreaterThan(0);

    const [session] = await readSessions(uid);
    expect(session.grantedSeconds).toBe(300);
    expect(session.requestedSeconds).toBe(900);
  });

  test("a production build ignores devDurationSeconds", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("starter");
    const interviewId = await seedInterview({ durationSeconds: 300 });

    // The override that shortens a session in development must do nothing here.
    await page.goto(`/interview/${interviewId}?devDurationSeconds=20`);
    await expect(page.getByText(/Development override active/)).toHaveCount(0);

    await acceptTermsAndStart(page);

    await expect
      .poll(async () => (await readSessions(uid)).length, { timeout: 60_000 })
      .toBeGreaterThan(0);

    const [session] = await readSessions(uid);
    expect(session.grantedSeconds).toBe(300);
  });
});

/** Accepts the terms and presses the start button. */
async function acceptTermsAndStart(page: import("@playwright/test").Page) {
  await page.getByRole("checkbox").check();
  const start = page.getByRole("button", { name: /Start interview/i });
  await expect(start).toBeEnabled();
  await start.click();
}
