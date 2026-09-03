#!/usr/bin/env node
/**
 * Launches the browser tests with the right server behind them.
 *
 * The @dev specs need `next dev`, because the development duration override is
 * deliberately inert in a production build -- and the @prod specs assert exactly
 * that. Playwright's config is evaluated again in every worker process, where
 * the command line is not the one the user typed, so the mode cannot be sniffed
 * from argv there. Setting it in the environment before Playwright starts is the
 * only place it is reliably visible to both the config and the workers, and this
 * wrapper does that without needing cross-env on Windows.
 *
 *   node scripts/e2e.mjs dev    # short interviews against `next dev`
 *   node scripts/e2e.mjs prod   # plan enforcement against a production build
 */

import { spawn } from "node:child_process";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit", shell: true, env });
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))
    );
  });
}

const mode = process.argv[2];
if (mode !== "dev" && mode !== "prod") {
  console.error("Usage: node scripts/e2e.mjs <dev|prod> [extra playwright args]");
  process.exit(2);
}

/**
 * The suite builds and serves from its own directory rather than `.next`.
 *
 * A `next build` deletes and rewrites `.next` wholesale. Run while a dev server
 * is up -- which is the normal state of this machine -- it pulls the manifests
 * out from under that server, which then stays running and answers every route
 * with a bare "Internal Server Error". Keeping the suite's output separate means
 * running the browser tests can no longer take the developer's server down.
 */
const DIST_DIR = mode === "dev" ? ".next-e2e-dev" : ".next-e2e";

const extra = process.argv.slice(3);
const args = ["playwright", "test", "--grep", mode === "dev" ? "@dev" : "@prod", ...extra];

const env = {
  ...process.env,
  NEXT_DIST_DIR: DIST_DIR,
  ...(mode === "dev" ? { E2E_DEV: "1" } : {}),
};

// The @prod specs assert what a production build does, so one has to exist in
// the suite's own directory. Playwright only starts the server; nothing else
// would produce the build it serves.
if (mode === "prod") {
  console.log(`[e2e] building into ${DIST_DIR}`);
  await run("npx", ["next", "build"], env);
}

await run("npx", args, env).then(
  () => process.exit(0),
  () => process.exit(1)
);
