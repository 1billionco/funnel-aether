import Link from "next/link";

import { Button } from "@/components/ui/button";

// Placeholder until the marketing site lands in M8.
export default function HomePage() {
  const showDevLinks = process.env.NEXT_PUBLIC_APP_ENV !== "production";
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="font-mono text-xs tracking-wide text-muted uppercase">Funnel Aether</p>
      <h1 className="font-display text-2xl md:text-3xl">
        Your whole marketing funnel in one place — AI drafts, you decide.
      </h1>
      <p className="text-muted">
        We&apos;re building in the open with a small group of UK and Nigerian businesses. You
        approve everything before it goes out.
      </p>
      {showDevLinks ? (
        <div>
          <Button asChild variant="outline">
            <Link href="/dev/ui">View the design system</Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}
