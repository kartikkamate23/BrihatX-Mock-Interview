import { expect, test } from "./fixtures";

test("dashboard timing", async ({ page, signIn }) => {
  await signIn("pro");
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Your Interviews/i })).toBeVisible();
    samples.push(Date.now() - t);
  }
  console.log(`[PERF] dashboard: ${samples.join("ms, ")}ms`);

  const t2 = Date.now();
  await page.goto("/interview", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Set up your interview/i })).toBeVisible();
  console.log(`[PERF] setup page: ${Date.now() - t2}ms`);
});
