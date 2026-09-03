#!/usr/bin/env node
/**
 * Populate .env.local from real Firebase credentials.
 *
 *   node setup-env.mjs <service-account.json> [web-config.txt]
 *
 *   <service-account.json>  The file downloaded from
 *                           Firebase console > Project settings > Service accounts
 *                           > "Generate new private key".
 *
 *   [web-config.txt]        Optional. A file containing the `firebaseConfig`
 *                           snippet copied from
 *                           Project settings > General > Your apps > SDK setup.
 *                           Either the raw JS object or plain JSON works.
 *
 * Existing values in .env.local are preserved unless this script replaces them.
 * The admin private key is written via JSON.stringify, which produces the
 * quoted, backslash-n-escaped form that firebase-admin's cert() expects.
 */
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function die(msg) {
  console.error("error: " + msg);
  process.exit(1);
}

function upsert(lines, key, rawValue) {
  const entry = key + "=" + rawValue;
  const idx = lines.findIndex((l) => l.startsWith(key + "="));
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
}

const argv = process.argv.slice(2);
const webOnly = argv.includes("--web-only");
const positional = argv.filter((a) => !a.startsWith("--"));
const [saPath, webPath] = webOnly ? [null, positional[0]] : positional;

if (!webOnly && !saPath)
  die("pass the service-account JSON path, or use --web-only <web-config.txt>.");
if (saPath && !fs.existsSync(saPath)) die("no such file: " + saPath);

const lines = fs.existsSync(ENV_PATH)
  ? fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)
  : [];

const applied = [];

if (saPath) {
  let sa;
  try {
    sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  } catch {
    die(saPath + " is not valid JSON.");
  }

  for (const k of ["project_id", "client_email", "private_key"]) {
    if (!sa[k]) die("service account JSON is missing '" + k + "'.");
  }

  // Firebase Admin SDK
  upsert(lines, "FIREBASE_PROJECT_ID", sa.project_id);
  upsert(lines, "FIREBASE_CLIENT_EMAIL", sa.client_email);
  // JSON.stringify gives us "-----BEGIN...\n...\n-----END-----\n" with literal
  // backslash-n, which firebase/admin.ts turns back into real newlines.
  upsert(lines, "FIREBASE_PRIVATE_KEY", JSON.stringify(sa.private_key));
  applied.push("FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY");
}

// Firebase Web SDK (optional)
if (webPath) {
  if (!fs.existsSync(webPath)) die("no such file: " + webPath);
  const raw = fs.readFileSync(webPath, "utf8");
  const pick = (key) => {
    const m = raw.match(new RegExp(key + '\\s*[:=]\\s*["\']([^"\']+)["\']'));
    return m ? m[1] : null;
  };
  const map = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "apiKey",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "authDomain",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "projectId",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "storageBucket",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "messagingSenderId",
    NEXT_PUBLIC_FIREBASE_APP_ID: "appId",
  };
  for (const [envKey, cfgKey] of Object.entries(map)) {
    const val = pick(cfgKey);
    if (val) {
      upsert(lines, envKey, val);
      applied.push(envKey);
    } else {
      console.warn("warn: could not find '" + cfgKey + "' in " + webPath);
    }
  }
}

while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");

console.log("wrote " + ENV_PATH);
for (const k of applied) console.log("  set " + k);

const stillPlaceholder = fs
  .readFileSync(ENV_PATH, "utf8")
  .split(/\r?\n/)
  .filter((l) => /=.*placeholder/i.test(l))
  .map((l) => l.split("=")[0]);

if (stillPlaceholder.length) {
  console.log("\nstill placeholders (fill these in yourself):");
  for (const k of stillPlaceholder) console.log("  " + k);
}
