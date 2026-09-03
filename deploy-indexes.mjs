#!/usr/bin/env node
/**
 * Create the Firestore composite indexes defined in firestore.indexes.json
 * using the service-account credentials already in .env.local.
 *
 *   node deploy-indexes.mjs          create missing indexes
 *   node deploy-indexes.mjs --status report build state only
 *
 * The default "Firebase Admin SDK Administrator Service Agent" role can READ
 * indexes but not CREATE them. If you see "The caller does not have permission",
 * grant the service account the "Cloud Datastore Index Admin"
 * (roles/datastore.indexAdmin) role in Google Cloud Console > IAM, then re-run.
 * The console URLs printed on failure are the no-IAM-change alternative.
 */
import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const IDX_PATH = path.resolve(process.cwd(), "firestore.indexes.json");

for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length > 1) {
    try { v = JSON.parse(v); } catch { v = v.slice(1, -1); }
  }
  process.env[k] = v;
}

const project = process.env.FIREBASE_PROJECT_ID;
const statusOnly = process.argv.includes("--status");

if (!project || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error("Missing FIREBASE_* admin credentials in .env.local.");
  process.exit(1);
}

const defs = JSON.parse(fs.readFileSync(IDX_PATH, "utf8")).indexes;

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

const base = (coll) =>
  `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${coll}/indexes`;

const sameFields = (a, b) =>
  a.length === b.length &&
  a.every((f, i) => f.fieldPath === b[i].fieldPath && f.order === b[i].order);

let missing = 0;
let building = 0;
let ready = 0;

for (const idx of defs) {
  const coll = idx.collectionGroup;
  const want = idx.fields.map((f) => ({ fieldPath: f.fieldPath, order: f.order }));
  const label = `${coll}: ${want.map((f) => `${f.fieldPath} ${f.order}`).join(", ")}`;

  let existing = [];
  try {
    const res = await client.request({ url: base(coll) });
    existing = res.data.indexes ?? [];
  } catch (e) {
    console.log(`?  ${label}\n   could not list: ${e?.response?.data?.error?.message ?? e.message}`);
    continue;
  }

  // Firestore appends __name__; compare only the fields we asked for.
  const match = existing.find((e) =>
    sameFields(want, (e.fields ?? []).filter((f) => f.fieldPath !== "__name__"))
  );

  if (match) {
    if (match.state === "READY") { ready++; console.log(`OK       ${label}`); }
    else { building++; console.log(`BUILDING ${label}  (state: ${match.state})`); }
    continue;
  }

  missing++;
  if (statusOnly) { console.log(`MISSING  ${label}`); continue; }

  try {
    await client.request({
      url: base(coll),
      method: "POST",
      data: { queryScope: idx.queryScope ?? "COLLECTION", fields: want },
    });
    console.log(`CREATED  ${label}`);
  } catch (e) {
    const msg = e?.response?.data?.error?.message ?? e.message;
    console.log(`FAILED   ${label}\n   ${msg}`);
  }
}

console.log(`\nready: ${ready}  building: ${building}  missing: ${missing}`);
if (missing > 0 && !statusOnly) {
  console.log(
    "\nIf creation failed with a permission error, either:\n" +
      "  a) grant roles/datastore.indexAdmin to the service account, then re-run this; or\n" +
      "  b) run: firebase login && firebase deploy --only firestore:indexes\n" +
      "Re-check any time with: node deploy-indexes.mjs --status"
  );
}
process.exit(missing > 0 || building > 0 ? 1 : 0);
