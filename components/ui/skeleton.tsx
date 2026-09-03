import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A placeholder for content that is still loading.
 *
 * Deliberately not a spinner. A skeleton that matches the shape of what is
 * coming tells someone the page is working *and* what it is about to show,
 * where a spinner in the middle of an empty screen tells them neither.
 *
 * `animate-breathe` rather than a shimmer: the project already has a slow
 * opacity pulse for "working on it" states, and it is disabled under
 * `prefers-reduced-motion` along with everything else.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Hidden from assistive technology: a screen reader should hear the
      // region's own loading message, not a row of empty boxes.
      aria-hidden
      className={cn("animate-breathe rounded-md bg-dark-200", className)}
      {...props}
    />
  );
}

/** The loading shape of one interview card, matching its real proportions. */
function InterviewCardSkeleton() {
  return (
    <div className="rounded-2xl border-gradient p-0.5">
      <div className="dark-gradient flex min-h-96 flex-col justify-between gap-10 rounded-[calc(1rem-1px)] p-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="size-[60px] rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <div className="flex gap-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export { Skeleton, InterviewCardSkeleton };
