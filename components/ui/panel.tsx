import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The application's standard surface.
 *
 * Every panel in this product is the same two-element construction: a gradient
 * border drawn as a 2px padded wrapper, and a gradient fill inside it. That was
 * previously open-coded with `.card-border` and `.dark-gradient` at each call
 * site, which is why the corners, the border and the padding had drifted apart
 * between the dashboard, the interview room and the feedback page.
 *
 * `.card-border` is also `w-fit`, and more than one screen had already been
 * caught by a panel collapsing to zero width around absolutely positioned
 * content. This component is full-width by default for that reason.
 */
function Panel({
  className,
  innerClassName,
  interactive = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Classes for the filled surface rather than the border wrapper. */
  innerClassName?: string;
  /** Adds the hover lift. For panels that are a link or a button target. */
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "rounded-2xl border-gradient p-0.5",
        interactive && "lift-on-hover",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "dark-gradient h-full rounded-[calc(1rem-1px)] p-5",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A panel's heading row: a title, and optionally something aligned opposite. */
function PanelHeader({
  className,
  title,
  hint,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  /** One line under the title. */
  hint?: React.ReactNode;
  /** Rendered at the far end of the row, e.g. a badge or a link. */
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn("mb-4 flex items-start justify-between gap-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-primary-100">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-light-100">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Panel, PanelHeader };
