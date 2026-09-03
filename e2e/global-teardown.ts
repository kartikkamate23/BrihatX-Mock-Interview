import { readFileSync, rmSync } from "node:fs";

import { FieldValue } from "firebase-admin/firestore";

import { admin } from "./auth";
import { PLAN_SNAPSHOT } from "./global-setup";

/** Puts the test account back on the plan it was on before the suite ran. */
export default async function globalTeardown() {
  let snapshot: { uid: string; plan: string | null };
  try {
    snapshot = JSON.parse(readFileSync(PLAN_SNAPSHOT, "utf8"));
  } catch {
    return; // nothing was recorded, so there is nothing to put back
  }

  const { db } = admin();
  const ref = db.collection("users").doc(snapshot.uid);

  await ref.update({
    // An absent plan means the free Starter tier, and that is a different state
    // from an explicit "starter" -- restore whichever it actually was.
    plan: snapshot.plan === null ? FieldValue.delete() : snapshot.plan,
  });

  // Sessions created by the suite are test data, not the account's history.
  const sessions = await db.collection("sessions").where("userId", "==", snapshot.uid).get();
  await Promise.all(sessions.docs.map((doc) => doc.ref.delete()));

  console.log(`[e2e] restored plan for ${snapshot.uid}: ${snapshot.plan ?? "(unset)"}`);
  rmSync(PLAN_SNAPSHOT, { force: true });
}
