import { test as base, type BrowserContext, type Page } from "@playwright/test";

import {
  admin,
  clearSessionsFor,
  ensureTestUser,
  mintSessionCookie,
  testUserUid,
} from "./auth";

export { readFeedbackFor, readSessions } from "./auth";

export interface InterviewSeed {
  role: string;
  topics: string[];
  level: string;
  interviewerId: string;
  durationSeconds: number;
  interviewType: "technical" | "communication" | "visa" | "resume";
  visaType: string;
  visaMode: string;
  destination: string;
  visaTypeLabel: string;
  iconKey: string;
  roleCategory: string;
}

interface Fixtures {
  uid: string;
  /** Signs the context in as the test user on the given plan. */
  signIn: (plan: string) => Promise<void>;
  /** Writes an interview directly, so specs do not pay for the wizard's model call. */
  seedInterview: (seed: Partial<InterviewSeed>) => Promise<string>;
}

/**
 * Shared setup for the browser tests.
 *
 * Interviews are seeded straight into Firestore rather than created through the
 * wizard in every spec: building one costs a model call, and what most of these
 * tests are about is the *session*, not how the interview was written. The
 * wizard has its own spec that does drive it end to end.
 */
export const test = base.extend<Fixtures>({
  uid: async ({}, use) => {
    const uid = testUserUid();
    if (!uid) {
      base.skip(
        true,
        "E2E_TEST_USER_UID is not set, so the signed-in browser tests cannot run."
      );
    }
    await use(uid!);
  },

  signIn: async ({ context, uid }, use) => {
    await use(async (plan: string) => {
      await ensureTestUser(uid, plan);
      await clearSessionsFor(uid);
      const cookie = await mintSessionCookie(uid);
      await installSession(context, cookie);
    });
  },

  seedInterview: async ({ uid }, use) => {
    const created: string[] = [];

    await use(async (seed) => {
      const { db } = admin();
      const isVisa = seed.interviewType === "visa";
      const ref = await db.collection("interviews").add({
        interviewType: seed.interviewType ?? "technical",
        role: seed.role ?? (isVisa ? "F1 Student Visa" : "Software Engineer"),
        type: isVisa ? "visa" : "mixed",
        level: seed.level ?? (isVisa ? "n/a" : "intermediate"),
        levelLabel: isVisa ? "Visa applicant" : "Intermediate",
        topics: seed.topics ?? (isVisa ? ["Purpose of travel", "Finances"] : ["System Design"]),
        roleCategory: seed.roleCategory ?? (isVisa ? "visa" : "software-development"),
        iconKey: seed.iconKey ?? (isVisa ? "globe" : "code"),
        interviewerId: seed.interviewerId ?? "tanya",
        interviewerName: "Tanya",
        techstack: isVisa ? [] : ["system design"],
        ...(isVisa
          ? {
              visaType: seed.visaType ?? "f1-student",
              visaTypeLabel: seed.visaTypeLabel ?? "F1 Student Visa",
              visaMode: seed.visaMode ?? "standard",
              destination: seed.destination ?? "United States",
              visaDetails: { university: "Arizona State University" },
            }
          : {}),
        questions: [
          "Tell me about yourself.",
          "Describe a system you have designed.",
          "How would you scale it?",
        ],
        durationSeconds: seed.durationSeconds ?? 300,
        userId: uid,
        finalized: true,
        status: "ready",
        coverImage: "/covers/adobe.png",
        createdAt: new Date().toISOString(),
      });
      created.push(ref.id);
      return ref.id;
    });

    // Seeded interviews and anything they produced are removed again, so a run
    // does not slowly fill the project with test data.
    const { db } = admin();
    for (const id of created) {
      const feedback = await db.collection("feedback").where("interviewId", "==", id).get();
      await Promise.all(feedback.docs.map((doc) => doc.ref.delete()));
      const sessions = await db.collection("sessions").where("interviewId", "==", id).get();
      await Promise.all(sessions.docs.map((doc) => doc.ref.delete()));
      await db.collection("interviews").doc(id).delete();
    }
  },
});

export const expect = test.expect;

async function installSession(context: BrowserContext, cookie: string) {
  await context.addCookies([
    {
      name: "session",
      value: cookie,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * The state of the candidate's media tracks, read from the live <video>.
 *
 * Asserted from the DOM rather than from React state, because "the interview
 * released the camera" is a claim about the hardware: a component can render
 * "camera off" while the webcam light is still on.
 */
export async function mediaTrackState(page: Page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    const stream = video?.srcObject as MediaStream | null;
    if (!stream) {
      return { hasStream: false, video: [], audio: [], videoWidth: video?.videoWidth ?? 0 };
    }
    return {
      hasStream: true,
      video: stream.getVideoTracks().map((t) => t.readyState),
      audio: stream.getAudioTracks().map((t) => t.readyState),
      videoWidth: video?.videoWidth ?? 0,
    };
  });
}

/**
 * Noise that is written to console.error by something other than this
 * application, and which says nothing about whether the interview worked.
 *
 * Kept to an explicit, narrow list rather than a loose pattern: the whole point
 * of the assertion these feed is that a normal interview -- including hanging up
 * at the end of one -- produces no application errors at all, and a filter broad
 * enough to hide a real one would defeat it.
 */
const THIRD_PARTY_CONSOLE_NOISE = [
  // MediaPipe's wasm runtime announces its backend at error level.
  "Created TensorFlow Lite XNNPACK delegate for CPU",
  // Next's dev overlay and the browser's own asset fetching.
  "Failed to load resource",
  "favicon",
];

/** Collects console errors so a spec can assert none were produced. */
export function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

/** The console errors this application is actually responsible for. */
export function applicationErrors(lines: string[]): string[] {
  return lines.filter(
    (line) => !THIRD_PARTY_CONSOLE_NOISE.some((noise) => line.includes(noise))
  );
}

/**
 * Drives the job-interview branch of the wizard as far as the duration step.
 *
 * Lives here rather than in a spec because Playwright refuses to let one spec
 * file import another, and more than one spec needs to reach that screen.
 */
export async function walkToJobDuration(page: Page, role: string) {
  await page.getByRole("button", { name: /Job Interview/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("combobox").fill(role);
  await page.getByRole("button", { name: role, exact: true }).first().click();
  await page.getByRole("button", { name: "Continue" }).click(); // role -> topics
  await page.getByRole("button", { name: "Continue" }).click(); // topics -> experience
  await page.getByRole("button", { name: "Continue" }).click(); // experience -> interviewer
  await page.getByRole("button", { name: "Continue" }).click(); // interviewer -> duration
}
