import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { admin, testUserUid } from "./auth";

export const PLAN_SNAPSHOT = join(tmpdir(), "prepwise-e2e-plan.json");

/**
 * Records the test account's plan before the suite changes it.
 *
 * The specs set the plan explicitly so each one runs against a known tier, and
 * these tests run against a real project rather than an emulator. Restoring
 * afterwards means a test run does not silently leave a real account on
 * whichever plan the last spec happened to need.
 */
export default async function globalSetup() {
  const uid = testUserUid();
  if (!uid) return;

  const { db } = admin();
  const snapshot = await db.collection("users").doc(uid).get();
  const plan = snapshot.data()?.plan ?? null;

  writeFileSync(PLAN_SNAPSHOT, JSON.stringify({ uid, plan }), "utf8");
  console.log(`[e2e] recorded plan for ${uid}: ${plan ?? "(unset)"}`);
}
