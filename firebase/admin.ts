import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Raised when the Admin SDK is used without a complete service account.
 * Callers catch this and turn it into a user-facing message rather than a 500.
 */
export class FirebaseAdminNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      "Firebase Admin is not configured. Missing or empty: " +
        missing.join(", ") +
        ". Download a service account key from Firebase console > Project settings > " +
        "Service accounts > Generate new private key, then run: node setup-env.mjs <file.json>"
    );
    this.name = "FirebaseAdminNotConfiguredError";
  }
}

let cached: { auth: Auth; db: Firestore } | null = null;

export function isFirebaseAdminConfigured(): boolean {
  return (
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY
  );
}

function initFirebaseAdmin() {
  if (cached) return cached;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Values pasted into .env.local carry literal \n instead of real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
  if (missing.length) throw new FirebaseAdminNotConfiguredError(missing);

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  cached = { auth: getAuth(), db: getFirestore() };
  return cached;
}

/**
 * `auth` and `db` are lazy proxies. Initialising the Admin SDK at module scope
 * would throw during import when credentials are absent, which turns every
 * route -- including the sign-in page that explains the problem -- into a 500.
 * Deferring to first property access keeps the app renderable and lets each
 * server action report the failure itself.
 */
function lazy<T extends object>(pick: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const real = pick();
      const value = Reflect.get(real as object, prop, receiver);
      return typeof value === "function" ? value.bind(real) : value;
    },
    has(_target, prop) {
      return prop in (pick() as object);
    },
  });
}

export const auth = lazy<Auth>(() => initFirebaseAdmin().auth);
export const db = lazy<Firestore>(() => initFirebaseAdmin().db);
