"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Keeps a failed dashboard feature from turning the whole protected area into
 * Next.js' generic Internal Server Error screen. `reset` retries the segment
 * without forcing the user through authentication again. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Protected page failed:", error);
  }, [error]);

  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h2>We couldn&apos;t load this page</h2>
        <p className="max-w-md text-sm text-light-100">
          Your account and saved interviews are safe. Retry the request, or
          return to the dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary px-6 py-2">
            Retry
          </button>
          <Link href="/" className="btn-secondary px-6 py-2 text-primary-200">
            Dashboard
          </Link>
        </div>
    </section>
  );
}
