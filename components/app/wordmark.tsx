import Link from "next/link";

import { cn } from "@/lib/utils";

/** Text wordmark (no image, so it costs nothing in Lite mode). */
export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-input", className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full bg-primary text-on-primary"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" />
        </svg>
      </span>
      <span className="font-display text-lg leading-none">Funnel Aether</span>
    </Link>
  );
}
