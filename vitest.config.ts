import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias from tsconfig.json so tests import modules by
    // the same specifier the application does.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // Pure logic only: the timer, attention, plan, prompt, audio, error and
    // state-machine modules are deliberately free of React and browser APIs so
    // they can be tested for real rather than through a wall of mocks. The
    // Playwright suite in e2e/ covers what only a real browser can prove.
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // The docx path lazily imports mammoth, and that first import is slow
    // enough under a loaded worker pool to blow the 5s default even though the
    // test itself runs in ~300ms in isolation. The work is real, not a hang.
    testTimeout: 20_000,
  },
});
