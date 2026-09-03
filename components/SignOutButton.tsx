"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as signOutFirebase } from "firebase/auth";
import { toast } from "sonner";

import { auth } from "@/firebase/client";
import { signOut as clearServerSession } from "@/lib/actions/auth.action";

/** Clears both halves of authentication: Firebase's browser state and the
 * httpOnly server session used by protected routes. */
export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    if (pending) return;
    setPending(true);

    try {
      // Run both even if one fails. A stale client session must not prevent the
      // server cookie from being cleared, and vice versa.
      const [clientResult, serverResult] = await Promise.allSettled([
        signOutFirebase(auth),
        clearServerSession(),
      ]);

      if (clientResult.status === "rejected") {
        console.error("[AUTH] Firebase client sign-out failed", clientResult.reason);
      }
      if (serverResult.status === "rejected") {
        console.error("[AUTH] Server session cleanup failed", serverResult.reason);
        toast.error("Unable to sign out right now. Please try again.");
        return;
      }

      router.replace("/sign-in");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      aria-busy={pending}
      className="text-sm text-light-100 transition-colors hover:text-primary-200 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
