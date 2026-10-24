import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/primitives";

export function QualityCard({ score, tips }: { score: number; tips: string[] }) {
  const label = score >= 70 ? "Strong" : score >= 40 ? "Getting there" : "Just starting";
  return (
    <Card>
      <CardHeader>
        <CardDescription>Training quality</CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-normal" data-testid="quality-score">
            {score}
          </span>
          <span className="text-sm font-normal text-muted">/ 100 · {label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={score} aria-label="Training quality" />
        {tips.length ? (
          <ul className="flex flex-col gap-2">
            {tips.map((t) => (
              <li key={t} className="flex gap-2 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-fg" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Your brand voice is well trained.</p>
        )}
      </CardContent>
    </Card>
  );
}
