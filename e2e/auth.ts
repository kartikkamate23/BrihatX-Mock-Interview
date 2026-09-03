import { config as loadEnv } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local", quiet: true });

/**
 * Signs the browser in without going through the password form.
 *
 * The application's session is an httpOnly cookie minted by the Admin SDK from
 * an ID token. Rather than automating a real password login -- which would mean
 * storing a password in the repository and creating accounts in the project --
 * the harness mints the same cookie directly for an existing uid and installs
 * it in the browser context. That exercises exactly the session the app uses in
 * production, and creates nothing that has to be cleaned up.
 */

let cached: { auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore> } | null =
  null;

export function admin() {
  if (cached) return cached;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing from .env.local; the browser tests cannot sign in."
    );
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  cached = { auth: getAuth(), db: getFirestore() };
  return cached;
}

/** The uid the browser tests run as. */
export function testUserUid(): string | null {
  return process.env.E2E_TEST_USER_UID?.trim() || null;
}

/**
 * A session cookie for the test user.
 *
 * `createSessionCookie` needs an ID token, and the Admin SDK can only mint
 * *custom* tokens. The exchange below is the documented way to turn one into
 * the other, and it is the same round-trip the real sign-in form performs.
 */
export async function mintSessionCookie(uid: string): Promise<string> {
  const { auth } = admin();
  const customToken = await auth.createCustomToken(uid);

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set.");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );

  const payload = (await response.json()) as { idToken?: string; error?: { message?: string } };
  if (!payload.idToken) {
    throw new Error(
      `Could not exchange the custom token for an ID token: ${payload.error?.message ?? "unknown error"}`
    );
  }

  return auth.createSessionCookie(payload.idToken, {
    expiresIn: 60 * 60 * 1000,
  });
}

/** Makes sure the test user exists and is on a known plan. */
export async function ensureTestUser(uid: string, plan: string): Promise<void> {
  const { auth, db } = admin();

  try {
    await auth.getUser(uid);
  } catch {
    throw new Error(
      `E2E_TEST_USER_UID=${uid} does not exist in Firebase Auth. Create the account, or unset the variable to skip the signed-in tests.`
    );
  }

  const ref = db.collection("users").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error(
      `No users/${uid} document. Sign in through the app once so the profile is created.`
    );
  }
  // Plan is the only thing the tests change, and it is set explicitly per spec
  // so a test never depends on whatever the account happened to be on.
  await ref.update({ plan });
}

/** Deletes this run's session documents so quota assertions start from zero. */
export async function clearSessionsFor(uid: string): Promise<void> {
  const { db } = admin();
  const snapshot = await db.collection("sessions").where("userId", "==", uid).get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

export async function readSessions(uid: string) {
  const { db } = admin();
  const snapshot = await db.collection("sessions").where("userId", "==", uid).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown>);
}

export async function readFeedbackFor(interviewId: string) {
  const { db } = admin();
  const snapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown>);
}
