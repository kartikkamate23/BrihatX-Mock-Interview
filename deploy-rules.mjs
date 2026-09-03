/**
 * Publish firestore.rules using the service-account credentials in .env.local,
 * via the Firebase Rules REST API (the same thing `firebase deploy --only
 * firestore:rules` does), so no interactive CLI login is needed.
 */
import fs from "node:fs";
import { GoogleAuth } from "google-auth-library";

for (const line of fs.readFileSync("C:/Mock_intern/.env.local", "utf8").split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
  process.env[t.slice(0, i).trim()] = v;
}

const project = process.env.FIREBASE_PROJECT_ID;
const source = fs.readFileSync("C:/Mock_intern/firestore.rules", "utf8");

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

let ruleset;
try {
  const res = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`,
    method: "POST",
    data: { source: { files: [{ name: "firestore.rules", content: source }] } },
  });
  ruleset = res.data.name;
  console.log("created ruleset:", ruleset);
} catch (e) {
  console.log("CREATE FAILED:", e?.response?.data?.error?.message ?? e.message);
  process.exit(1);
}

try {
  await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore?updateMask=rulesetName`,
    method: "PATCH",
    data: { release: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: ruleset } },
  });
  console.log("released to cloud.firestore");
} catch (e) {
  const msg = e?.response?.data?.error?.message ?? e.message;
  if (/not found|NOT_FOUND/i.test(msg)) {
    try {
      await client.request({
        url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases`,
        method: "POST",
        data: { name: `projects/${project}/releases/cloud.firestore`, rulesetName: ruleset },
      });
      console.log("released to cloud.firestore (created release)");
    } catch (e2) {
      console.log("RELEASE FAILED:", e2?.response?.data?.error?.message ?? e2.message);
      process.exit(1);
    }
  } else {
    console.log("RELEASE FAILED:", msg);
    process.exit(1);
  }
}
