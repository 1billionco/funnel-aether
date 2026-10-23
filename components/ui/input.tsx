import * as React from "react";

import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-input border border-line bg-surface px-3 text-base text-ink placeholder:text-muted transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input type={type} data-slot="input" className={cn(fieldBase, "h-11", className)} {...props} />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "min-h-24 py-2.5", className)}
      {...props}
    />
  );
}

export { Input, Textarea };
