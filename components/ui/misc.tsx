import * as React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-input bg-ink/[0.06]", className)}
      {...props}
    />
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line bg-paper px-1 font-mono text-[11px] text-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Credits and other metrics are always set in Geist Mono (§7.2). */
export function Metric({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono tabular-nums", className)} {...props} />;
}

/** Empty / error / success state block used on every screen (§7.4). */
export function StateBlock({
  icon,
  title,
  children,
  action,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "danger" | "approve";
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-1 grid size-10 place-items-center rounded-full [&_svg]:size-5",
            tone === "danger" && "bg-danger/10 text-danger-fg",
            tone === "approve" && "bg-approve/10 text-approve-fg",
            tone === "neutral" && "bg-primary-tint text-primary-fg",
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className="font-medium">{title}</p>
      {children ? <div className="max-w-sm text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
