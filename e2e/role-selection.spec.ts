import { admin } from "./auth";
import { expect, test } from "./fixtures";

/**
 * The role picker, in a real browser.
 *
 * Two things are being proved here. First that the searches people actually
 * type -- abbreviations and technologies, not job titles -- return the right
 * roles. Second, and more important, that the role chosen here reaches the
 * interview: the failure mode this feature exists to avoid is a role that is
 * displayed during setup and then has no effect on the questions.
 */
test.describe("role selection @prod", () => {
  test("finds roles by abbreviation, technology and spelled-out form", async ({
    page,
    signIn,
  }) => {
    await signIn("pro");
    await page.goto("/interview");
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const search = page.getByRole("combobox");
    const results = page.getByRole("tabpanel");

    // Each of these returned nothing before aliases existed.
    const cases: [string, string][] = [
      ["AI", "AI Engineer"],
      ["ML", "Machine Learning Engineer"],
      ["GenAI", "Generative AI Engineer"],
      ["LLM", "LLM Engineer"],
      ["Agentic", "Agentic AI Engineer"],
      ["RAG", "RAG Engineer"],
      ["Prompt", "Prompt Engineer"],
      ["React", "React Developer"],
      ["Java", "Java Developer"],
      ["Python", "Python Developer"],
      ["DevOps", "DevOps Engineer"],
      ["Kubernetes", "Kubernetes Engineer"],
      ["SRE", "Site Reliability Engineer"],
      ["Cybersecurity", "Cybersecurity Engineer"],
    ];

    for (const [query, expected] of cases) {
      await search.fill(query);
      await expect(
        results.getByRole("button", { name: expected, exact: true }),
        `searching "${query}" should surface ${expected}`
      ).toBeVisible();
    }
  });

  test("is case-insensitive and offers a custom role when nothing matches", async ({
    page,
    signIn,
  }) => {
    await signIn("pro");
    await page.goto("/interview");
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const search = page.getByRole("combobox");

    await search.fill("mAcHiNe LeArNiNg");
    await expect(
      page.getByRole("button", { name: "Machine Learning Engineer", exact: true })
    ).toBeVisible();

    await search.fill("Quantum Computing Engineer");
    await expect(page.getByText(/No roles match/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Use .*as a custom role/ })).toBeVisible();
  });

  test("browses by category, including a first-class AI tab", async ({ page, signIn }) => {
    await signIn("pro");
    await page.goto("/interview");
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const tabs = page.getByRole("tablist", { name: "Browse roles by category" });
    for (const label of [
      "Suggested",
      "AI & GenAI",
      "Software",
      "Data",
      "Cloud & DevOps",
      "Cybersecurity",
      "Testing",
      "Product & Management",
      "Design",
      "Business",
      "Other",
    ]) {
      await expect(tabs.getByRole("tab", { name: label, exact: true })).toBeVisible();
    }

    await tabs.getByRole("tab", { name: "AI & GenAI", exact: true }).click();
    // Grouped by subcategory rather than rendered as one undifferentiated wall.
    await expect(page.getByText("Generative AI", { exact: true })).toBeVisible();
    await expect(page.getByText("Agentic AI", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "LLM Engineer", exact: true })
    ).toBeVisible();
  });

  /**
   * The one that matters: a selected role must reach the stored interview, and
   * from there the interviewer's system instruction.
   */
  test("carries the selected role through to the interview record", async ({
    page,
    signIn,
    uid,
  }) => {
    await signIn("pro");
    const before = await interviewIdsFor(uid);

    await page.goto("/interview");
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("combobox").fill("GenAI");
    await page
      .getByRole("button", { name: "Generative AI Engineer", exact: true })
      .click();
    await expect(page.getByText("Selected:")).toContainText("Generative AI Engineer");
    await page.getByRole("button", { name: "Continue" }).click();

    // Topics are seeded from the role's category, so they are AI topics.
    await expect(page.getByText(/Suggested for Generative AI Engineer/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click(); // experience
    await page.getByRole("button", { name: "Continue" }).click(); // interviewer
    await page.getByRole("button", { name: "Continue" }).click(); // duration
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start Interview" }).click();

    await page.waitForURL(/\/interview\/[A-Za-z0-9]+$/, { timeout: 120_000 });

    const after = await interviewIdsFor(uid);
    const created = after.filter((id) => !before.includes(id));
    expect(created).toHaveLength(1);

    const { db } = admin();
    const interview = (await db.collection("interviews").doc(created[0]).get()).data()!;

    expect(interview.role).toBe("Generative AI Engineer");
    // The new metadata, stored alongside the name rather than instead of it.
    expect(interview.roleId).toBe("generative-ai-engineer");
    expect(interview.roleCategory).toBe("ai-ml");
    expect(interview.roleSubcategory).toBe("Generative AI");
    expect(interview.iconKey).toBe("brain");

    // The topics reaching the interviewer are AI topics, not generic ones.
    const topics = (interview.topics as string[]).join(" ");
    expect(topics).toMatch(/LLM|RAG|Agentic|Model Evaluation/);

    await db.collection("interviews").doc(created[0]).delete();
  });

  test("accepts a custom role and stores it verbatim", async ({ page, signIn, uid }) => {
    await signIn("pro");
    const before = await interviewIdsFor(uid);

    await page.goto("/interview");
    await page.getByRole("button", { name: /Job Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("combobox").fill("Quantum Computing Engineer");
    await page.getByRole("button", { name: /Use .*as a custom role/ }).click();
    await expect(page.getByText("Selected:")).toContainText("Quantum Computing Engineer");

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // topics
    await page.getByRole("button", { name: "Continue" }).click(); // experience
    await page.getByRole("button", { name: "Continue" }).click(); // interviewer
    await page.getByRole("button", { name: "Continue" }).click(); // duration
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start Interview" }).click();

    await page.waitForURL(/\/interview\/[A-Za-z0-9]+$/, { timeout: 120_000 });

    const after = await interviewIdsFor(uid);
    const created = after.filter((id) => !before.includes(id));
    const { db } = admin();
    const interview = (await db.collection("interviews").doc(created[0]).get()).data()!;

    // Stored exactly as typed, with no catalogue id, and still runnable.
    expect(interview.role).toBe("Quantum Computing Engineer");
    expect(interview.roleId).toBeUndefined();
    expect(interview.roleCategory).toBe("other");
    expect((interview.topics as string[]).length).toBeGreaterThan(0);

    await db.collection("interviews").doc(created[0]).delete();
  });
});

async function interviewIdsFor(uid: string): Promise<string[]> {
  const { db } = admin();
  const snapshot = await db.collection("interviews").where("userId", "==", uid).get();
  return snapshot.docs.map((doc) => doc.id);
}
