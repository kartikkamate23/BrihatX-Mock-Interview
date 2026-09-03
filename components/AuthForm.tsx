"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  type UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import FormField from "./FormField";

const authFormSchema = (type: FormType) => {
  return z.object({
    name:
      type === "sign-up"
        ? z.string().min(3, "Name must be at least 3 characters.")
        : z.string().optional(),
    email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
    // Strength policy belongs to account creation only. Applying it during
    // sign-in locks out existing Firebase accounts created under an older
    // policy even though their credentials are still valid.
    password:
      type === "sign-up"
        ? z
            .string()
            .min(8, "Password must be at least 8 characters.")
            .regex(/[A-Za-z]/, "Password must include at least one letter.")
            .regex(/[0-9]/, "Password must include at least one number.")
        : z.string().min(1, "Password is required."),
  });
};

const AUTH_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Firebase requests can otherwise wait indefinitely when a browser extension,
 * firewall, or a stalled network connection prevents a response.  Always
 * settle the form so the user can see an error and try again.
 */
function withAuthTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          "Authentication timed out. Check your connection and try again."
        )
      );
    }, AUTH_REQUEST_TIMEOUT_MS);

    operation.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

type AuthResult = { success: boolean; message?: string };

async function completeAuth(path: "/api/auth/sign-up" | "/api/auth/sign-in", body: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  const result = (await response.json().catch(() => null)) as AuthResult | null;
  if (!result) {
    throw new Error("The authentication service returned an invalid response.");
  }
  return result;
}

// Turn Firebase's error codes into something a user can act on. Anything
// unmapped keeps its code so the terminal and the toast stay diagnosable.
const describeAuthError = (error: unknown): string => {
  if (!(error instanceof FirebaseError)) {
    if (error instanceof Error && error.message) return error.message;
    return "Unable to authenticate right now. Please try again.";
  }

  switch (error.code) {
    // --- Configuration problems: the developer must fix these, not the user.
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    case "auth/invalid-api-key":
      return "Firebase is not configured: the API key is missing or invalid. Set NEXT_PUBLIC_FIREBASE_API_KEY in .env.local and restart the dev server.";
    case "auth/configuration-not-found":
      return "Firebase Authentication is not set up for this project. Enable it in the Firebase console.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is disabled. Enable it in Firebase console > Authentication > Sign-in method.";

    // --- Ordinary user errors.
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in.";
    case "auth/weak-password":
      return "Your password is too weak. Please use a stronger password.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/user-not-found":
      return "No account found with that email. Create an account first.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This account has been disabled.";

    // --- Transient / environmental.
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";

    default:
      return `Authentication failed (${error.code}).`;
  }
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (type === "sign-up") {
        const { name, email, password } = data;
        const normalizedEmail = email.trim().toLowerCase();

        // The schema requires this for sign-up, but the shared form type keeps
        // it optional. Narrow it here instead of asserting it away.
        if (!name) {
          toast.error("Name is required.");
          return;
        }

        let userCredential: UserCredential;
        try {
          userCredential = await withAuthTimeout(
            createUserWithEmailAndPassword(auth, normalizedEmail, password)
          );
        } catch (error) {
          // An earlier interrupted request may have created the Firebase Auth
          // record before its profile/session was saved. Signing in here lets
          // the server finish that setup below instead of stranding the user.
          if (
            error instanceof FirebaseError &&
            error.code === "auth/email-already-in-use"
          ) {
            userCredential = await withAuthTimeout(
              signInWithEmailAndPassword(auth, normalizedEmail, password)
            );
          } else {
            throw error;
          }
        }
        const idToken = await withAuthTimeout(userCredential.user.getIdToken());

        const result = await withAuthTimeout(
          completeAuth("/api/auth/sign-up", { name, idToken })
        );

        if (!result.success) {
          // The Firebase Auth account already exists at this point. Leaving it
          // behind would lock the email out for good: every retry would hit
          // auth/email-already-in-use, while no users/{uid} document exists so
          // sign-in could never resolve a profile. Roll it back.
          try {
            await deleteUser(userCredential.user);
          } catch (cleanupError) {
            console.error(
              "Failed to roll back orphaned auth user; it must be removed from the Firebase console:",
              cleanupError
            );
          }

          toast.error(result.message);
          return;
        }

        toast.success("Account created successfully.");
        router.replace("/");
        router.refresh();
      } else {
        const { email, password } = data;
        const normalizedEmail = email.trim().toLowerCase();

        const userCredential = await withAuthTimeout(
          signInWithEmailAndPassword(auth, normalizedEmail, password)
        );

        const idToken = await withAuthTimeout(userCredential.user.getIdToken());
        if (!idToken) {
          toast.error("Sign in Failed. Please try again.");
          return;
        }

        const result = await withAuthTimeout(
          completeAuth("/api/auth/sign-in", { email: normalizedEmail, idToken })
        );

        if (!result?.success) {
          toast.error(result?.message ?? "Sign in Failed. Please try again.");
          return;
        }

        toast.success("Signed in successfully.");
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      console.error(`${type} failed:`, error);
      toast.error(describeAuthError(error));
    }
  };

  const isSignIn = type === "sign-in";
  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="card-border w-full max-w-xl">
      <div className="card flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="" aria-hidden height={32} width={38} />
          <h2 className="text-primary-100">BrihatX AI Interview</h2>
        </div>

        <div className="text-center">
          <h3>AI-Powered Interview Preparation</h3>
          <p className="mt-2 text-sm text-light-100">
            Practise with realistic interviews and actionable feedback.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            method="post"
            className="w-full space-y-6 mt-4 form"
          >
            {!isSignIn && (
              <FormField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Your Name"
                type="text"
              />
            )}

            <FormField
              control={form.control}
              name="email"
              label="Email"
              placeholder="Your email address"
              type="email"
              autoComplete="email"
            />

            <FormField
              control={form.control}
              name="password"
              label="Password"
              placeholder="Enter your password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
            />

            <Button className="btn" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting
                ? isSignIn
                  ? "Signing in…"
                  : "Creating account…"
                : isSignIn
                  ? "Sign In"
                  : "Create an Account"}
            </Button>
          </form>
        </Form>

        <p className="text-center">
          {isSignIn ? "No account yet?" : "Have an account already?"}
          <Link
            href={!isSignIn ? "/sign-in" : "/sign-up"}
            className="font-bold text-user-primary ml-1"
          >
            {!isSignIn ? "Sign In" : "Sign Up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
