import Link from "next/link";
import { Check } from "lucide-react";

import type { CoreStep } from "@/lib/core-loop";
import { cn } from "@/lib/utils";

export function CoreLoopChecklist({
  slug,
  steps,
  done,
  total,
}: {
  slug: string;
  steps: CoreStep[];
  done: number;
  total: number;
}) {
  return (
    <section
      aria-labelledby="checklist-title"
      className="rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="checklist-title" className="font-medium">
          Getting started
        </h2>
        <span className="font-mono text-sm text-muted">
          {done}/{total}
        </span>
      </div>
      <ol className="mt-3 flex flex-col">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              href={`/${slug}/${s.href}`}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-input px-1 text-sm hover:bg-ink/5",
                !s.available && "pointer-events-none opacity-60",
              )}
              aria-disabled={!s.available || undefined}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border",
                  s.done ? "border-approve bg-approve text-white" : "border-line",
                )}
              >
                {s.done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
              </span>
              <span className={cn(s.done && "text-muted line-through decoration-line")}>
                {s.label}
              </span>
              <span className="sr-only">
                {s.done ? "(done)" : s.available ? "(to do)" : "(coming soon)"}
              </span>
              {!s.available ? <span className="ml-auto text-xs text-muted">Soon</span> : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
