/**
 * Helpers for reading values off caught errors without widening to `any`.
 *
 * `catch (e)` gives `unknown` under strict TypeScript. Firebase and gRPC
 * attach a `code` (string for Firebase Auth, number for Firestore/gRPC), so
 * narrow explicitly instead of asserting the shape.
 */

/** Firebase Auth style string codes, e.g. "auth/user-not-found". */
export function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/** gRPC/Firestore style numeric codes, e.g. 9 = FAILED_PRECONDITION. */
export function errorNumericCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}
