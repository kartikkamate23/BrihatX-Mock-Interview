import { admin } from "./auth";
import { expect, test, walkToJobDuration } from "./fixtures";

/**
 * The setup flow, end to end, for each interview type.
 *
 * The wizard branches after the first step, so a job interview and a visa
 * interview walk different screens. Both are driven here, and both assert what
 * the interview document ends up containing -- because that document is what the
 * interviewer is later given as context.
 */
test.describe("interview setup @prod", () => {
  test("walks the job interview sequence and writes the interview it describes", async ({
    page,
    signIn,
    uid,
  }) => {
    await signIn("pro");

    const before = await interviewIdsFor(uid);
    await page.goto("/interview");

    // 1. Type
    await expect(
      page.getByRole("heading", { name: /What would you like to practise/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 2. Role -- searched for, not picked from a short list.
    await expect(
      page.getByRole("heading", { name: /What role are you practising for/ })
    ).toBeVisible();
    await page.getByRole("combobox").fill("Machine Learning");
    await page.getByRole("button", { name: "Machine Learning Engineer", exact: true }).click();
    await expect(page.getByText("Selected:")).toContainText("Machine Learning Engineer");
    await page.getByRole("button", { name: "Continue" }).click();

    // 3. Topics -- seeded from the role's category, so they are already valid.
    await expect(
      page.getByRole("heading", { name: /Which topics should it cover/ })
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Experience
    await page.getByRole("button", { name: /Senior/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 5. Interviewer
    await page.getByRole("button", { name: /Rohan/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Duration
    await page
      .getByRole("group", { name: "Interview length" })
      .getByRole("button", { name: /^10 min/ })
      .click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 7. Terms -- start stays blocked until they are accepted.
    await expect(page.getByRole("heading", { name: /Before you start/ })).toBeVisible();
    const start = page.getByRole("button", { name: "Start Interview" });
    await expect(start).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(start).toBeEnabled();
    await start.click();

    await page.waitForURL(/\/interview\/[A-Za-z0-9]+$/, { timeout: 120_000 });

    const created = await newInterviewFor(uid, before);
    const interview = await readInterview(created);

    expect(interview.interviewType).toBe("technical");
    expect(interview.role).toBe("Machine Learning Engineer");
    // AI is its own category now, rather than sharing one with analytics.
    expect(interview.roleCategory).toBe("ai-ml");
    expect(interview.roleId).toBe("machine-learning-engineer");
    expect(interview.iconKey).toBe("brain");
    expect(interview.level).toBe("senior");
    expect(interview.interviewerId).toBe("rohan");
    expect(interview.durationSeconds).toBe(600);
    expect((interview.topics as string[]).length).toBeGreaterThan(0);
    // A topic guide is written, but it is not what ends the interview.
    expect((interview.questions as string[]).length).toBeGreaterThan(0);

    await deleteInterview(created);
  });

  test("walks the visa interview sequence and writes the visa setup", async ({
    page,
    signIn,
    uid,
  }) => {
    await signIn("pro");

    const before = await interviewIdsFor(uid);
    await page.goto("/interview");

    // 1. Type
    await page.getByRole("button", { name: /Visa Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 2. Visa category
    await expect(
      page.getByRole("heading", { name: /Which visa are you interviewing for/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /F1 Student Visa/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 3. Officer mode
    await expect(
      page.getByRole("heading", { name: /How tough should the officer be/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /Strict Visa Officer/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Details -- destination is required, the rest optional.
    await expect(page.getByRole("heading", { name: /A little background/ })).toBeVisible();
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();
    await page.getByLabel(/Destination country/).fill("United States");
    await page.getByLabel(/University or institution/).fill("Arizona State University");
    await expect(continueButton).toBeEnabled();
    // The screen must warn against entering real identifiers.
    await expect(page.getByText(/Never enter a passport number/)).toBeVisible();
    await continueButton.click();

    // 5. Duration
    await page
      .getByRole("group", { name: "Interview length" })
      .getByRole("button", { name: /^5 min/ })
      .click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Terms -- the practice disclaimer must be on this screen.
    await expect(
      page.getByText(/cannot tell you whether a real visa application would succeed/)
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start Interview" }).click();

    await page.waitForURL(/\/interview\/[A-Za-z0-9]+$/, { timeout: 120_000 });

    const created = await newInterviewFor(uid, before);
    const interview = await readInterview(created);

    expect(interview.interviewType).toBe("visa");
    expect(interview.visaType).toBe("f1-student");
    expect(interview.visaMode).toBe("strict");
    expect(interview.destination).toBe("United States");
    expect((interview.visaDetails as Record<string, string>).university).toBe(
      "Arizona State University"
    );
    expect(interview.visaTypeLabel).toBe("F1 Student Visa");
    expect(interview.iconKey).toBe("globe");
    expect(interview.durationSeconds).toBe(300);
    // The same duration rule as every other type, taken from the same plan gate.
    expect((interview.topics as string[]).length).toBeGreaterThan(0);

    // The session page identifies it as a visa interview, not a job one.
    await expect(page.getByText("Visa Interview").first()).toBeVisible();
    await expect(page.getByText("F1 Student Visa").first()).toBeVisible();
    await expect(page.getByText(/Destination · United States/)).toBeVisible();

    await deleteInterview(created);
  });

  test("a custom visa type can be typed in", async ({ page, signIn }) => {
    await signIn("pro");
    await page.goto("/interview");

    await page.getByRole("button", { name: /Visa Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: /Other \/ Custom Visa/ }).click();
    // The wizard must not advance without the free-text value.
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByLabel(/Which visa type/).fill("Schengen Short-Stay Visa");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("a free account cannot choose a length its plan does not allow", async ({
    page,
    signIn,
  }) => {
    await signIn("starter");
    await page.goto("/interview");

    await walkToJobDuration(page, "Data Analyst");

    const lengths = page.getByRole("group", { name: "Interview length" });
    await expect(lengths.getByRole("button", { name: /^10 min/ })).toBeDisabled();
    await expect(lengths.getByRole("button", { name: /^15 min/ })).toBeDisabled();
    await expect(page.getByText(/Starter plan allows sessions up to 5 minutes/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------

async function interviewIdsFor(uid: string): Promise<string[]> {
  const { db } = admin();
  const snapshot = await db.collection("interviews").where("userId", "==", uid).get();
  return snapshot.docs.map((doc) => doc.id);
}

async function newInterviewFor(uid: string, before: string[]): Promise<string> {
  const after = await interviewIdsFor(uid);
  const created = after.filter((id) => !before.includes(id));
  expect(created).toHaveLength(1);
  return created[0];
}

async function readInterview(id: string) {
  const { db } = admin();
  const snapshot = await db.collection("interviews").doc(id).get();
  return snapshot.data()!;
}

async function deleteInterview(id: string) {
  const { db } = admin();
  await db.collection("interviews").doc(id).delete();
}
