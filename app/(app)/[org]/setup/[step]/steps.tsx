import type { ReactNode } from "react";

import { advanceSetup } from "@/app/(app)/[org]/_actions/brand";
import { Button } from "@/components/ui/button";
import type { Org } from "@/lib/auth/session";
import type { Brand } from "@/lib/brands";
import type { SetupStepId } from "@/lib/onboarding/steps";

/** Bodies for wizard steps after the questionnaire. Filled in by M2 (samples, summary) and M3 (first draft). */
export function SetupStepBody({
  step,
  slug,
  skip,
}: {
  step: Exclude<SetupStepId, "brand">;
  slug: string;
  org: Org;
  brand: Brand;
  skip: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Coming soon</h1>
      <p className="text-muted">This step isn&apos;t ready yet.</p>
      <div className="flex gap-3">
        {skip}
        <form action={advanceSetup.bind(null, slug, step)}>
          <Button type="submit">Continue</Button>
        </form>
      </div>
    </div>
  );
}
