"use server";

import { auth, db, FirebaseAdminNotConfiguredError } from "@/firebase/admin";
import { cookies } from "next/headers";
import { errorCode, errorMessage, errorNumericCode } from "@/lib/errors";
import { getCurrentUserCached } from "@/lib/current-user";

// Server-side configuration faults must not be reported as bad credentials.
const CONFIG_ERROR_MESSAGE =
  "Server is missing Firebase Admin credentials. Add FIREBASE_CLIENT_EMAIL and " +
  "FIREBASE_PRIVATE_KEY to .env.local and restart the server.";

function describeServerAuthError(error: unknown, operation: "sign-up" | "sign-in") {
  const code = errorCode(error);
  const numericCode = errorNumericCode(error);
  const message = errorMessage(error);

  if (code === "auth/id-token-expired" || code === "auth/invalid-id-token") {
    return "Your authentication request expired. Please try again.";
  }
  if (code === "auth/user-disabled") {
    return "This account has been disabled.";
  }
  if (
    numericCode === 4 ||
    numericCode === 14 ||
    /ENOTFOUND|EAI_AGAIN|EACCES|ECONNRESET|ETIMEDOUT|ECONNREFUSED|network|socket hang up/i.test(
      message
    )
  ) {
    return "The server could not reach Firebase. Check your connection and try again.";
  }
  if (numericCode === 7 || /PERMISSION_DENIED/i.test(message)) {
    return "The account service cannot save profiles right now. Check the server's Firestore permissions.";
  }
  if (numericCode === 5 && /database.*does not exist/i.test(message)) {
    return "Firestore is not configured for this Firebase project.";
  }
  if (/private key|credential|PEM|DECODER/i.test(message)) {
    return "Server Firebase credentials are invalid. Check FIREBASE_* values in .env.local.";
  }

  return operation === "sign-up"
    ? "Unable to create your account right now. Please try again."
    : "Unable to sign in right now. Please try again.";
}

function logServerAuthError(operation: "sign-up" | "sign-in", error: unknown) {
  console.error(`[AUTH] ${operation} failed`, {
    code: errorCode(error) ?? errorNumericCode(error) ?? "unknown",
    message: errorMessage(error),
  });
}

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

/** A token that fails the shape check never reaches Firebase, so no SDK error
 *  exists to carry the code. Mint one in the same shape the SDK uses, since
 *  `errorCode` reads the `code` property -- a code left only in the message
 *  would fall through to the generic "unable to sign in" text. */
function invalidIdTokenError() {
  return Object.assign(new Error("The authentication token is not valid."), {
    code: "auth/invalid-id-token",
  });
}

/** Rejects anything that cannot be a JWT before it reaches Firebase. */
function isPlausibleIdToken(idToken: unknown): idToken is string {
  return typeof idToken === "string" && idToken.length >= 100 && idToken.length <= 20_000;
}

// Set session cookie
export async function setSessionCookie(idToken: string) {
  if (!isPlausibleIdToken(idToken)) {
    throw invalidIdTokenError();
  }
  const cookieStore = await cookies();

  // Create session cookie
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION * 1000, // milliseconds
  });

  // Set cookie in the browser
  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function signUp(params: SignUpParams) {
  const { name, idToken } = params;

  try {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100 ||
      !isPlausibleIdToken(idToken)
    ) {
      return { success: false, message: "The account details are not valid." };
    }

    // Identity comes entirely from a verified token, never from a caller-
    // supplied uid or email. The Auth record already exists because the client
    // creates it immediately before this action.
    const decoded = await auth.verifyIdToken(idToken, true);
    if (typeof decoded.email !== "string" || !decoded.email.trim()) {
      return { success: false, message: "The Firebase account has no email address." };
    }
    const uid = decoded.uid;

    // check if user exists in db
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists) {
      // This can happen when a previous browser request created the Firebase
      // account and profile but disconnected before receiving its response.
      // The caller has just authenticated with that account, so complete the
      // missing browser session rather than treating it as an unrecoverable
      // duplicate.
      await setSessionCookie(idToken);
      return { success: true, message: "Account signed in successfully." };
    }

    // save user to db
    const profileRef = db.collection("users").doc(uid);
    await profileRef.set({
      name: name.trim(),
      email: decoded.email,
      plan: "starter",
      // profileURL,
      // resumeURL,
    });

    try {
      // A completed signup is a completed authentication flow: establish the
      // same httpOnly session used by sign-in so the dashboard and refresh both
      // work immediately.
      await setSessionCookie(idToken);
    } catch (error) {
      // The client rolls back the newly-created Auth user when this action
      // fails. Remove the profile too so retrying cannot leave an orphaned
      // users/{uid} document.
      try {
        await profileRef.delete();
      } catch (cleanupError) {
        logServerAuthError("sign-up", cleanupError);
      }
      throw error;
    }

    return { success: true, message: "Account created successfully." };
  } catch (error) {
    logServerAuthError("sign-up", error);

    if (error instanceof FirebaseAdminNotConfiguredError) {
      return { success: false, message: CONFIG_ERROR_MESSAGE };
    }

    // Handle Firebase specific errors
    if (errorCode(error) === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return { success: false, message: describeServerAuthError(error, "sign-up") };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    if (typeof email !== "string" || email.length > 320) {
      return { success: false, message: "Enter a valid email address." };
    }

    // Sign-up already screens its token. Without the same guard here a missing
    // token reaches verifyIdToken() and surfaces as the generic "unable to sign
    // in" message instead of naming the real problem.
    if (!isPlausibleIdToken(idToken)) {
      return { success: false, message: "The sign-in details are not valid." };
    }

    // Bind the form email to the token. Previously any valid token could be
    // paired with a different existing email, making audit logs and error
    // handling describe the wrong account.
    const decoded = await auth.verifyIdToken(idToken, true);
    if (
      typeof decoded.email !== "string" ||
      decoded.email.toLowerCase() !== email.trim().toLowerCase()
    ) {
      return { success: false, message: "The sign-in details do not match." };
    }

    const profile = await db.collection("users").doc(decoded.uid).get();
    if (!profile.exists) {
      return { success: false, message: "User does not exist. Create an account." };
    }

    await setSessionCookie(idToken);

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    if (error instanceof FirebaseAdminNotConfiguredError) {
      console.error(error.message);
      return { success: false, message: CONFIG_ERROR_MESSAGE };
    }

    if (errorCode(error) === "auth/user-not-found") {
      // Someone typing an email they never registered is ordinary use, not a
      // fault. A stack trace here buries the failures that do need attention.
      console.warn(`Sign-in attempt for an address with no account: ${email}`);
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };
    }

    const code = errorCode(error);
    if (code === "auth/id-token-expired" || code === "auth/invalid-id-token") {
      console.warn(`Sign-in rejected a stale ID token (${code}).`);
      return {
        success: false,
        message: "Your session expired before it could be created. Please try again.",
      };
    }

    logServerAuthError("sign-in", error);
    return { success: false, message: describeServerAuthError(error, "sign-in") };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

/**
 * The signed-in user.
 *
 * A thin wrapper over the request-scoped memo in lib/current-user.ts. The work
 * itself -- an auth round trip and a profile read -- happens at most once per
 * server request no matter how many callers ask, which is what stopped the
 * dashboard resolving the same user five times before it could render.
 */
export async function getCurrentUser(): Promise<User | null> {
  return getCurrentUserCached();
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
