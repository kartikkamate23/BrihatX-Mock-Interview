import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for the interview.
 *
 * Runs against the machine's real Chrome (`channel: "chrome"`) rather than a
 * downloaded build, because the interview depends on things a stripped browser
 * does not reliably have: getUserMedia, AudioWorklet, WebSocket, and the
 * WebAssembly path MediaPipe uses.
 *
 * Media is faked at the browser level rather than mocked in the page. Chrome's
 * `--use-fake-device-for-media-stream` provides a real MediaStream carrying a
 * synthetic video pattern and a tone, so getUserMedia, the <video> element, the
 * capture worklet and the track lifecycle are all genuinely exercised -- the
 * only thing that is not real is what the camera is pointed at.
 */
/**
 * The @dev specs need `next dev`, because the development duration override is
 * inert in a production build -- which is itself one of the things the @prod
 * specs assert.
 *
 * Read from the environment, not from argv: this config is evaluated again in
 * every worker process, where the command line is Playwright's own and not the
 * one that was typed. scripts/e2e.mjs sets this before Playwright starts, so
 * the main process and the workers agree on which server they are talking to.
 */
const isDevRun = !!process.env.E2E_DEV;

const PORT = Number(process.env.E2E_PORT ?? (isDevRun ? 3101 : 3100));
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * The suite's server keeps its build output out of `.next`.
 *
 * Next.js processes do not coordinate over that directory. Starting this server
 * beside the dev server the developer is already using meant one of them
 * rewriting the other's manifests, and the loser then answered every route with
 * "Internal Server Error" while staying up -- which reads exactly like a broken
 * application. A separate directory per mode makes the two independent.
 */
const DIST_DIR = process.env.NEXT_DIST_DIR ?? (isDevRun ? ".next-e2e-dev" : ".next-e2e");

export default defineConfig({
  testDir: "./e2e",
  // These run against a real Firebase project, not an emulator, so the account's
  // plan is snapshotted before the suite changes it and restored afterwards.
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // The interview specs drive real timers and, in the live spec, a real model.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  // Sequential: these share one Firestore project and one Gemini quota, and
  // parallel interviews would race on the same account's credits.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    // Traces are large -- a full interview run filled the disk on this machine
    // and took the dev server down with ENOSPC. Opt in with E2E_TRACE=1 when
    // something needs investigating.
    trace: process.env.E2E_TRACE ? "retain-on-failure" : "off",
    video: "off",
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        // A synthetic camera and microphone, so no hardware and no permission
        // dialog is involved.
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        // Lets the page start audio without a user gesture, which the harness
        // cannot always supply before the interviewer starts speaking.
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },

  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  webServer: {
    command: isDevRun
      ? `npx next dev --port ${PORT}`
      : `npx next start --port ${PORT}`,
    env: { NEXT_DIST_DIR: DIST_DIR },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
