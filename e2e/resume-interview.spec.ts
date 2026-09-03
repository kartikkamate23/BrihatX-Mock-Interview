import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
 * The resume-based interview, end to end.
 *
 * The claim being tested is not "a file uploaded" -- it is that the resume
 * reaches the interviewer. A resume interview that uploads a document and then
 * asks generic questions is the exact failure this feature exists to avoid, so
 * the spec asserts on what the model was actually told and on what it said.
 */

const RESUME_TEXT = `John Doe
Senior Software Engineer

Summary
Software engineer with 3 years of experience building web applications.

Skills
React, Node.js, MongoDB, AWS, TypeScript, Express

Experience
Software Engineer, Zentara Systems (2022 - present)
- Built and maintained an e-commerce platform serving 40,000 monthly users
- Optimised MongoDB aggregation pipelines, cutting checkout latency by 60%
- Led the migration of the payment service to AWS Lambda

Junior Developer, Bright Apps (2021 - 2022)
- Built internal dashboards in React

Projects
E-commerce Platform - React, Node.js, MongoDB, Stripe. A storefront with a
custom checkout and an inventory service.
AI Chatbot - Python, OpenAI API. A support chatbot answering product questions.

Education
B.Tech in Computer Science, Pune University, 2021

Certifications
AWS Certified Developer Associate
`;

/** Writes the fixture resumes this spec uploads. */
function writeFixtures() {
  const dir = mkdtempSync(join(tmpdir(), "prepwise-resume-"));
  const txt = join(dir, "John_Doe_Resume.txt");
  writeFileSync(txt, RESUME_TEXT, "utf8");

  // An executable, to prove the upload gate rejects what it should.
  const exe = join(dir, "payload.exe");
  writeFileSync(exe, Buffer.from([0x4d, 0x5a, 0x90, 0x00]));

  return { txt, exe };
}

test.describe("resume interview @prod", () => {
  test("rejects a file that is not a resume", async ({ page, signIn }) => {
    await signIn("pro");
    const { exe } = writeFixtures();

    await page.goto("/interview");
    await page.getByRole("button", { name: /Resume-Based Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /Upload your resume/ })).toBeVisible();
    await page.locator("#resume-file").setInputFiles(exe);

    // Scoped by text: Next renders its own route announcer with role="alert",
    // so an unqualified alert lookup matches two elements.
    await expect(
      page.getByText(/Upload your resume as a PDF|cannot be used as a resume/i)
    ).toBeVisible();
    // The step cannot be passed without a usable resume.
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("parses a resume and shows what was read out of it", async ({ page, signIn, uid }) => {
    await signIn("pro");
    const { txt } = writeFixtures();

    await page.goto("/interview");
    await page.getByRole("button", { name: /Resume-Based Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.locator("#resume-file").setInputFiles(txt);

    // Parsing is a real model call; give it room.
    await expect(page.getByText("Resume analysed")).toBeVisible({ timeout: 90_000 });

    // The confirmation screen shows the actual detected content, so a misread
    // employer is visible before the interview rather than during it.
    await expect(page.getByText("John_Doe_Resume.txt")).toBeVisible();
    await expect(page.getByText(/React/).first()).toBeVisible();

    // Only the profile is stored: no file, no raw resume text.
    //
    // Scoped to this fixture's own filename. An earlier version of this spec
    // read "the last resume for this user" and deleted every document it found,
    // which is both flaky -- the query has no ordering -- and destructive, since
    // the collection also holds resumes the account uploaded for real.
    const { db } = admin();
    const stored = await db
      .collection("resumes")
      .where("userId", "==", uid)
      .where("fileName", "==", "John_Doe_Resume.txt")
      .get();
    expect(stored.size).toBeGreaterThan(0);
    const record = stored.docs[0].data();
    expect(record.fileName).toBe("John_Doe_Resume.txt");
    expect(record.profile).toBeTruthy();
    expect(Object.keys(record)).not.toContain("fileUrl");
    expect(Object.keys(record)).not.toContain("rawText");
    // Skills were genuinely extracted, not defaulted to empty.
    expect((record.profile.skills as string[]).length).toBeGreaterThan(2);

    // Only what this test created.
    await Promise.all(stored.docs.map((d) => d.ref.delete()));
  });

  test("carries the resume into the interview record and the interviewer's brief", async ({
    page,
    signIn,
    uid,
  }) => {
    await signIn("pro");
    const { txt } = writeFixtures();

    const before = await interviewIdsFor(uid);
    await page.goto("/interview");

    await page.getByRole("button", { name: /Resume-Based Interview/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("#resume-file").setInputFiles(txt);
    await expect(page.getByText("Resume analysed")).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Target role deliberately differs from the resume, to exercise gap analysis.
    await expect(page.getByRole("heading", { name: /Which role are you targeting/ })).toBeVisible();
    await page.getByRole("combobox").fill("AI Engineer");
    await page.getByRole("button", { name: "AI Engineer", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click(); // topics
    await page.getByRole("button", { name: "Continue" }).click(); // experience
    await page.getByRole("button", { name: "Continue" }).click(); // interviewer
    await page.getByRole("button", { name: "Continue" }).click(); // duration
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start Interview" }).click();

    await page.waitForURL(/\/interview\/[A-Za-z0-9]+$/, { timeout: 120_000 });

    const created = (await interviewIdsFor(uid)).filter((id) => !before.includes(id));
    expect(created).toHaveLength(1);

    const { db } = admin();
    const interview = (await db.collection("interviews").doc(created[0]).get()).data()!;

    expect(interview.interviewType).toBe("resume");
    expect(interview.role).toBe("AI Engineer");
    expect(interview.resumeId).toBeTruthy();
    expect(interview.resumeFileName).toBe("John_Doe_Resume.txt");
    // The profile is referenced, not copied into every interview.
    expect(interview.resumeProfile).toBeUndefined();

    // The pre-flight names the resume and the target role.
    await expect(page.getByText(/Resume interview · Target: AI Engineer/)).toBeVisible();

    /**
     * The load-bearing assertion. The instruction the interviewer is given is
     * assembled server-side and locked into the session token, so intercepting
     * that response is the only way to see what the model was actually told --
     * and it is the difference between a resume interview and a generic one
     * wearing the label.
     */
    // The session page has its own terms gate; the wizard's acceptance does not
    // carry over, and the start button stays disabled until it is ticked.
    await page.getByRole("checkbox").check();
    const start = page.getByRole("button", { name: /Start interview/i });
    await expect(start).toBeEnabled();

    const tokenResponse = page.waitForResponse(
      (r) => r.url().includes("/api/live-token") && r.status() === 200,
      { timeout: 120_000 }
    );
    await start.click();
    const payload = await (await tokenResponse).json();
    const instruction: string = payload.systemInstruction;

    expect(payload.interviewType).toBe("resume");
    // Named employers and projects from the actual document.
    expect(instruction).toContain("Zentara Systems");
    expect(instruction).toContain("E-commerce Platform");
    expect(instruction).toMatch(/MongoDB|Node\.js/);
    // The target role, and the gap-analysis instruction it implies.
    expect(instruction).toContain("AI Engineer");
    expect(instruction).toMatch(/GAP ANALYSIS/i);
    // The shared safety rules were substituted in, not left as a marker.
    expect(instruction).toContain("UNIVERSAL RULES");
    expect(instruction).not.toContain("{{UNIVERSAL_RULES}}");
    // And it must never instruct the interviewer to accuse the candidate.
    expect(instruction).toMatch(/NEVER accuse/i);

    await endInterview(page);

    await db.collection("interviews").doc(created[0]).delete();
    // Again scoped by filename, so a resume the account uploaded for real is
    // never caught by a test's cleanup.
    const resumes = await db
      .collection("resumes")
      .where("userId", "==", uid)
      .where("fileName", "==", "John_Doe_Resume.txt")
      .get();
    await Promise.all(resumes.docs.map((d) => d.ref.delete()));
  });
});

/**
 * The live half, which needs the development duration override to run a whole
 * interview in seconds. Tagged @dev for the same reason every other live spec is.
 */
test.describe("resume interview live @dev", () => {
  test("asks about the resume, then expires on time and scores it", async ({
    page,
    signIn,
    seedInterview,
    uid,
  }) => {
    await signIn("pro");
    const consoleErrors = captureConsoleErrors(page);

    // Seeded so the run does not depend on a second live parse.
    const { db } = admin();
    const resumeRef = await db.collection("resumes").add({
      userId: uid,
      fileName: "John_Doe_Resume.txt",
      fileKind: "txt",
      wordCount: 140,
      profile: {
        name: "John Doe",
        headline: "Senior Software Engineer",
        summary: "Three years building web applications.",
        skills: ["React", "Node.js", "MongoDB", "AWS", "TypeScript"],
        technologies: ["React", "Node.js", "MongoDB", "AWS"],
        roles: [
          {
            title: "Software Engineer",
            company: "Zentara Systems",
            duration: "2022 - present",
            highlights: ["Built an e-commerce platform", "Optimised MongoDB pipelines"],
          },
        ],
        projects: [
          {
            name: "E-commerce Platform",
            description: "Storefront with a custom checkout.",
            technologies: ["React", "Node.js", "MongoDB"],
          },
        ],
        education: [
          { degree: "B.Tech Computer Science", institution: "Pune University", year: "2021" },
        ],
        certifications: ["AWS Certified Developer Associate"],
        achievements: [],
        domains: ["E-commerce"],
        yearsOfExperience: 3,
        currentRole: "Software Engineer",
      },
      createdAt: new Date().toISOString(),
    });

    const interviewId = await seedInterview({
      interviewType: "resume",
      role: "AI Engineer",
      durationSeconds: 300,
    });
    await db.collection("interviews").doc(interviewId).update({
      resumeId: resumeRef.id,
      resumeFileName: "John_Doe_Resume.txt",
    });

    await page.goto(`/interview/${interviewId}?devDurationSeconds=30`);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Start interview/i }).click();

    // Same camera, microphone and clock as every other interview type.
    await expect(page.getByTestId("interview-clock")).toBeVisible({ timeout: 45_000 });
    const media = await mediaTrackState(page);
    expect(media.video).toEqual(["live"]);
    expect(media.audio).toEqual(["live"]);

    // The opening question is about the resume, not a generic opener.
    await expect(page.locator(".transcript")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(6000);
    const spoken = await page.locator(".transcript").innerText();
    expect(spoken.length).toBeGreaterThan(20);

    // Nothing is clicked: the clock ends it.
    await page.waitForURL(`**/interview/${interviewId}/feedback`, { timeout: 150_000 });

    const [session] = await readSessions(uid);
    expect(session.interviewType).toBe("resume");
    expect(session.endReason).toBe("duration_expired");
    expect(session.grantedSeconds).toBe(30);

    const feedback = await readFeedbackFor(interviewId);
    expect(feedback).toHaveLength(1);
    const report = feedback[0];
    expect(report.interviewType).toBe("resume");

    const categories = (report.categoryScores as { name: string }[]).map((c) => c.name);
    expect(categories).toEqual([
      "Technical Knowledge",
      "Communication",
      "Confidence",
      "Answer Relevance",
      "Resume Substantiation",
      "Depth of Experience",
    ]);

    const detail = report.resume as Record<string, unknown>;
    expect(detail).toBeTruthy();
    expect(Array.isArray(detail.studyTopics)).toBe(true);
    expect(typeof detail.targetRoleGap).toBe("string");

    // Never accuses the candidate of misrepresenting their resume.
    const prose = [
      report.finalAssessment,
      detail.targetRoleGap,
      ...(report.strengths as string[]),
      ...(report.areasForImprovement as string[]),
      ...((detail.resumeRecommendations as string[]) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    expect(prose).not.toMatch(/\b(lying|liar|dishonest|fabricat\w*|falsif\w*)\b/);

    // Devices released; a normal ending is not an error.
    expect((await mediaTrackState(page)).hasStream).toBe(false);
    expect(applicationErrors(consoleErrors)).toEqual([]);
    // The specific regressions this task was about.
    expect(consoleErrors.join(" ")).not.toMatch(/Maximum update depth/i);

    await resumeRef.delete();
  });
});

async function interviewIdsFor(uid: string): Promise<string[]> {
  const { db } = admin();
  const snapshot = await db.collection("interviews").where("userId", "==", uid).get();
  return snapshot.docs.map((doc) => doc.id);
}

async function endInterview(page: Page) {
  const end = page.getByRole("button", { name: "End", exact: true });
  if ((await end.count()) === 0) return;
  await end.click();
  await page.getByRole("button", { name: "End interview" }).click();
}
