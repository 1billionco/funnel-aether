import { AlertTriangle, CheckCircle2, MinusCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/primitives";

export interface MatchReason {
  positive: boolean;
  text: string;
}

export function BrandMatchChip({
  score,
  reasons,
}: {
  score: number | null;
  reasons: MatchReason[];
}) {
  if (score === null) return null;
  const tone = score >= 70 ? "approve" : score >= 45 ? "info" : "danger";
  return (
    <Tooltip
      content={
        reasons.length ? (
          <ul className="flex flex-col gap-1">
            {reasons.map((r) => (
              <li key={r.text}>
                {r.positive ? "✓" : "•"} {r.text}
              </li>
            ))}
          </ul>
        ) : (
          "How closely this matches your brand voice"
        )
      }
    >
      <button
        type="button"
        className="rounded-full"
        aria-label={`Brand match ${score} out of 100. ${reasons.map((r) => r.text).join(". ")}`}
      >
        <Badge tone={tone}>Brand match {score}</Badge>
      </button>
    </Tooltip>
  );
}

export function MatchReasons({ reasons }: { reasons: MatchReason[] }) {
  if (!reasons.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {reasons.map((r) => (
        <li key={r.text} className="flex items-center gap-1.5">
          {r.positive ? (
            <CheckCircle2 className="size-4 text-approve-fg" aria-hidden />
          ) : (
            <MinusCircle className="size-4 text-muted" aria-hidden />
          )}
          {r.text}
        </li>
      ))}
    </ul>
  );
}

/** Flags need a human decision, so they use amber (§7.2). */
export function FlagsList({ flags }: { flags: { type: string; message: string }[] }) {
  if (!flags.length) return null;
  return (
    <div role="note" className="rounded-card border border-amber/40 bg-amber-tint p-3 text-sm">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-ink">
        <AlertTriangle className="size-4" aria-hidden /> Check before approving
      </p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {flags.map((f) => (
          <li key={f.message}>{f.message}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiLabel({ isMock }: { isMock?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone="primary">
        <Sparkles /> Drafted by AI
      </Badge>
      {isMock ? <Badge tone="info">Mock output</Badge> : null}
    </span>
  );
}
