import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { advanceSetup, saveBrandQuestionnaire } from "@/app/(app)/[org]/_actions/brand";
import { Wordmark } from "@/components/app/wordmark";
import { QuestionnaireForm } from "@/components/brand/questionnaire-form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { getPrimaryBrand } from "@/lib/brands";
import { requireOrg } from "@/lib/auth/session";
import {
  progressFor,
  SETUP_STEPS,
  stepIndex,
  TOTAL_ONBOARDING_STEPS,
  type SetupStepId,
} from "@/lib/onboarding/steps";

import { SetupStepBody } from "./steps";

export const metadata: Metadata = { title: "Set up your brand" };

export default async function SetupStepPage({ params }: PageProps<"/[org]/setup/[step]">) {
  const { org: slug, step } = await params;
  const index = stepIndex(step);
  if (index < 0) notFound();
  const current = SETUP_STEPS[index]!;
  const { org, db } = await requireOrg(slug);
  if (org.onboarding_completed_at) redirect(`/${slug}/today`);
  const brand = await getPrimaryBrand(db, org.id);
  if (!brand) notFound();

  const skip = current.skippable ? (
    <form action={advanceSetup.bind(null, slug, current.id as SetupStepId)}>
      <Button type="submit" variant="ghost" className="w-full sm:w-auto">
        Skip for now
      </Button>
    </form>
  ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-5 md:px-8">
        <Wordmark href={`/${slug}/setup`} />
        <span className="text-sm text-muted">{org.name}</span>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            Step {index + 2} of {TOTAL_ONBOARDING_STEPS} · {current.title}
          </p>
          <Progress value={progressFor(current.id)} aria-label="Onboarding progress" />
        </div>

        {current.id === "brand" ? (
          <>
            <div>
              <h1 className="font-display text-2xl">How does {brand.name} talk to customers?</h1>
              <p className="mt-1 text-muted">
                Short answers are fine. The AI uses this for every draft, and you can change it any
                time.
              </p>
            </div>
            <QuestionnaireForm
              action={saveBrandQuestionnaire.bind(null, slug, brand.id, "setup")}
              brand={brand}
              market={org.market}
              submitLabel="Continue"
            />
          </>
        ) : (
          <SetupStepBody
            step={current.id as Exclude<SetupStepId, "brand">}
            slug={slug}
            org={org}
            brand={brand}
            skip={skip}
          />
        )}
      </main>
    </div>
  );
}
