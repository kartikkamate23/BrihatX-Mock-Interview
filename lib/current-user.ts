import { cache } from "react";
import { cookies } from "next/headers";

import { auth, db, FirebaseAdminNotConfiguredError } from "@/firebase/admin";
import { errorCode } from "@/lib/errors";

/**
 * The signed-in user, resolved at most once per server request.
 *
 * Resolving a user is not cheap. It costs two round trips: `verifySessionCookie`
 * with `checkRevoked` set asks Google's auth servers whether the session is
 * still valid, and the profile itself is a Firestore read. Neither is local.
 *
 * Nothing called it once. Rendering the dashboard ran it from the layout's
 * `isAuthenticated`, from the page itself, and again inside
 * `getInterviewsByUserId`, `getLatestInterviews`, `getInterviewAccess` and
 * `getFeedbackForInterviews` -- every one of which re-derives the user rather
 * than trusting its caller, which is the right instinct and must not change.
 * That was five or six auth round trips and five or six identical profile reads
 * for one page, in sequence, before any of the real queries could start. It is
 * the single largest reason a click took seconds to do anything.
 *
 * `cache()` from React deduplicates for exactly the scope that is safe: one
 * server request. Two calls in the same render share one result; the next
 * request re-verifies from scratch, so a revoked or expired session is still
 * caught on the very next navigation. No call site changes, and no guard is
 * weakened -- every function still asks who the user is, and still gets a real
 * answer.
 *
 * Deliberately in its own module rather than in auth.action.ts: that file is
 * `"use server"`, where every export must be a server action, and a memoized
 * function is not one.
 */
export const getCurrentUserCached = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    const userRecord = await db.collection("users").doc(decodedClaims.uid).get();
    if (!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    // An expired or revoked cookie is the normal way a session ends -- treat it
    // as "signed out" without logging. Anything else is a real fault worth
    // surfacing in the server log.
    if (error instanceof FirebaseAdminNotConfiguredError) {
      console.error(error.message);
      return null;
    }

    const expected = [
      "auth/session-cookie-expired",
      "auth/session-cookie-revoked",
      "auth/invalid-session-cookie",
      "auth/argument-error",
    ];
    if (!expected.includes(errorCode(error) ?? "")) {
      console.error("Failed to verify session cookie:", error);
    }

    return null;
  }
});
