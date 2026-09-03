#!/usr/bin/env node
/**
 * Diagnose Firebase auth configuration in .env.local.
 *
 *   node check-auth-config.mjs
 *
 * Reports SET / PLACEHOLDER / MISSING / MALFORMED for every variable the
 * auth flow needs. Never prints a secret value -- only lengths, prefixes
 * of non-secret identifiers, and structural validity.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

if (!fs.existsSync(ENV_PATH)) {
  console.error("MISSING: .env.local does not exist at " + ENV_PATH);
  process.exit(1);
}

// Minimal dotenv parse: KEY=value, optionally double-quoted.
const env = {};
for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"') && val.length > 1) {
    try {
      val = JSON.parse(val);
    } catch {
      val = val.slice(1, -1);
    }
  }
  env[key] = val;
}

const PLACEHOLDER_RE =
  /placeholder|^0+$|^1:0+:web:0+$|example\.com|your-|xxx|changeme/i;

const CLIENT_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const ADMIN_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

const OTHER_VARS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_LIVE_MODEL",
  "GOOGLE_GENERATIVE_AI_FEEDBACK_MODEL",
];

// Unset is the normal, working state for these -- flagging them as MISSING
// reads as a fault the user needs to go and fix, which is not true.
const OPTIONAL = {
  GOOGLE_GENERATIVE_AI_MODEL: "unset is fine -- defaults to gemini-2.5-flash",
  GOOGLE_GENERATIVE_AI_LIVE_MODEL:
    "unset is fine -- defaults to gemini-3.1-flash-live-preview",
  GOOGLE_GENERATIVE_AI_FEEDBACK_MODEL:
    "unset is fine -- defaults to the text model above",
};

function classify(key) {
  const v = env[key];
  if (v === undefined || v === "") {
    return key in OPTIONAL
      ? { status: "OPTIONAL", note: OPTIONAL[key] }
      : { status: "MISSING", note: "" };
  }
  if (PLACEHOLDER_RE.test(v)) return { status: "PLACEHOLDER", note: "" };
  return { status: "SET", note: "" };
}

// Extra structural checks that do not leak the value.
function structural(key, res) {
  if (res.status !== "SET") return res;
  const v = env[key];

  if (key === "NEXT_PUBLIC_FIREBASE_API_KEY") {
    // Firebase browser API keys are Google API keys: "AIza" + 35 chars.
    if (!/^AIza[0-9A-Za-z_-]{35}$/.test(v))
      return { status: "MALFORMED", note: "not a Google API key (expected AIza + 35 chars, got length " + v.length + ")" };
  }
  if (key === "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") {
    if (!/\.firebaseapp\.com$/.test(v))
      return { status: "MALFORMED", note: "expected <project>.firebaseapp.com" };
  }
  if (key === "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") {
    if (!/^\d{6,}$/.test(v)) return { status: "MALFORMED", note: "expected all digits" };
  }
  if (key === "NEXT_PUBLIC_FIREBASE_APP_ID") {
    if (!/^\d+:\d+:web:[0-9a-f]+$/i.test(v))
      return { status: "MALFORMED", note: "expected <num>:<num>:web:<hex>" };
  }
  if (key === "FIREBASE_CLIENT_EMAIL") {
    if (!/@.+\.iam\.gserviceaccount\.com$/.test(v))
      return { status: "MALFORMED", note: "expected a *.iam.gserviceaccount.com address" };
  }
  if (key === "FIREBASE_PRIVATE_KEY") {
    const pem = v.replace(/\\n/g, "\n");
    if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(pem))
      return { status: "MALFORMED", note: "no PEM header" };
    try {
      crypto.createPrivateKey(pem);
    } catch (e) {
      return { status: "MALFORMED", note: "PEM does not parse: " + e.message };
    }
    return { status: "SET", note: "PEM parses (" + pem.split("\n").length + " lines)" };
  }
  return res;
}

function report(title, keys) {
  console.log("\n" + title);
  console.log("-".repeat(title.length));
  const out = [];
  for (const k of keys) {
    const res = structural(k, classify(k));
    out.push(res.status);
    const pad = k.padEnd(42);
    console.log("  " + pad + res.status + (res.note ? "  (" + res.note + ")" : ""));
  }
  return out;
}

console.log("Firebase auth configuration check");
console.log("source: " + ENV_PATH);

const clientRes = report("Firebase Web SDK (browser)", CLIENT_VARS);
const adminRes = report("Firebase Admin SDK (server)", ADMIN_VARS);
report("Other services (not required for auth)", OTHER_VARS);

const bad = (arr) => arr.some((s) => s !== "SET");

console.log("\n" + "=".repeat(60));
const clientOk = !bad(clientRes);
const adminOk = !bad(adminRes);
console.log("Firebase client configuration: " + (clientOk ? "WORKING" : "BLOCKED"));
console.log("Firebase Admin configuration:  " + (adminOk ? "WORKING" : "BLOCKED"));

// Cross-check: the browser project and the admin project must be the same.
if (clientOk && adminOk) {
  if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== env.FIREBASE_PROJECT_ID) {
    console.log(
      "\nMISMATCH: NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID " +
        "refer to different projects. Session cookies minted by the admin SDK " +
        "will fail to verify tokens issued to the browser app."
    );
    process.exit(2);
  }
  console.log("Project ID match:              OK");
}

if (!clientOk || !adminOk) {
  console.log("\nCODE IS READY, BUT REAL FIREBASE CREDENTIALS ARE REQUIRED.");
  process.exit(1);
}

console.log("\nConfiguration looks valid. Restart `npm run dev` if you just changed it.");
