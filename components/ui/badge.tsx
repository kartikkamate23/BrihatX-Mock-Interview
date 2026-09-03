import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The one badge in the product.
 *
 * The interview card, the setup wizard and the feedback header had each grown
 * their own pill with slightly different padding, radius and type size. The
 * variants below cover every case those three needed.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-dark-200 text-light-100",
        accent: "bg-primary-200/15 text-primary-200",
        success: "bg-success-100/15 text-success-100",
        warning: "bg-warning-100/15 text-warning-100",
        danger: "bg-destructive-100/15 text-destructive-100",
        /** High-contrast, for the one badge that should read as a label. */
        solid: "bg-primary-200 text-dark-100",
      },
      size: {
        sm: "px-2.5 py-0.5 text-[11px]",
        md: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  }
);

function Badge({
  className,
  variant,
  size,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** A leading status dot, inheriting the variant's colour. */
    dot?: boolean;
  }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
