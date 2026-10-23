import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chips. `pending` (amber) is reserved for "a human needs to act" — never decorative.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-ink/5 text-ink",
        primary: "bg-primary-tint text-primary-fg",
        pending: "bg-amber-tint text-amber-ink",
        pendingSolid: "bg-amber text-on-amber",
        approve: "bg-approve/10 text-approve-fg",
        danger: "bg-danger/10 text-danger-fg",
        info: "bg-info/10 text-info-fg",
        outline: "border border-line text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
