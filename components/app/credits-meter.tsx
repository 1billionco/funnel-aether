import Link from "next/link";

import { Metric } from "@/components/ui/misc";
import { formatCredits } from "@/lib/format";

/** Credits remaining this period (sidebar footer and Today). */
export function CreditsMeter({
  slug,
  balance,
  allowance,
  planName,
}: {
  slug: string;
  balance: number;
  allowance: number;
  planName: string;
}) {
  const pct = allowance > 0 ? Math.max(0, Math.min(100, (balance / allowance) * 100)) : 0;
  return (
    <Link
      href={`/${slug}/billing`}
      className="block rounded-card border border-line p-3 hover:bg-paper"
      aria-label={`${formatCredits(balance)} credits left on the ${planName} plan`}
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Credits</span>
        <span>
          <Metric className="font-medium">{formatCredits(balance)}</Metric>
          <span className="text-xs text-muted"> / {formatCredits(allowance)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div
          className={pct < 15 ? "h-full bg-danger" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">{planName} plan</p>
    </Link>
  );
}

export function CreditsRing({ balance, allowance }: { balance: number; allowance: number }) {
  const pct = allowance > 0 ? Math.max(0, Math.min(1, balance / allowance)) : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="size-20 -rotate-90" aria-hidden>
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-ink/10"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={pct < 0.15 ? "text-danger" : "text-primary"}
        />
      </svg>
      <div>
        <p className="font-display text-2xl" data-testid="credits-remaining">
          {formatCredits(balance)}
        </p>
        <p className="text-sm text-muted">of {formatCredits(allowance)} credits left this month</p>
      </div>
    </div>
  );
}
