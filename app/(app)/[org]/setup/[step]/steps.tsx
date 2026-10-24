import type { ReactNode } from "react";

import { advanceSetup } from "@/app/(app)/[org]/_actions/brand";
import { DocumentList } from "@/components/brand/document-list";
import { SampleUploader } from "@/components/brand/sample-uploader";
import { SummaryCard } from "@/components/brand/summary-card";
import { Button } from "@/components/ui/button";
import type { Org } from "@/lib/auth/session";
import type { Brand } from "@/lib/brands";
import { listBrandDocuments } from "@/lib/brand-voice/queries";
import { createSupabaseServerClient } from "@/lib/db/server";
import type { SetupStepId } from "@/lib/onboarding/steps";

function Footer({
  slug,
  step,
  skip,
  label = "Continue",
}: {
  slug: string;
  step: SetupStepId;
  skip: ReactNode;
  label?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
      {skip}
      <form action={advanceSetup.bind(null, slug, step)}>
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {label}
        </Button>
      </form>
    </div>
  );
}

/** Wizard steps after the questionnaire. "first-draft" is completed in M3. */
export async function SetupStepBody({
  step,
  slug,
  brand,
  skip,
}: {
  step: Exclude<SetupStepId, "brand">;
  slug: string;
  org: Org;
  brand: Brand;
  skip: ReactNode;
}) {
  if (step === "samples") {
    const db = await createSupabaseServerClient();
    const docs = db ? await listBrandDocuments(db, brand.id) : [];
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Show us how you write</h1>
          <p className="mt-1 text-muted">
            Add 1–5 examples: past posts, emails, a flyer or your website. The more you add, the
            less you&apos;ll edit later.
          </p>
        </div>
        <SampleUploader slug={slug} brandId={brand.id} defaultTab="paste" />
        <DocumentList slug={slug} docs={docs} canEdit />
        <Footer slug={slug} step="samples" skip={skip} />
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Here&apos;s how we think you sound</h1>
          <p className="mt-1 text-muted">
            Check it, change anything that&apos;s off, then approve it. Every draft will follow it.
          </p>
        </div>
        <SummaryCard
          slug={slug}
          brandId={brand.id}
          summary={brand.summary}
          status={brand.summary_status}
          canEdit
        />
        <Footer slug={slug} step="summary" skip={skip} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Your first draft</h1>
      <p className="text-muted">Coming next.</p>
      <Footer slug={slug} step={step} skip={skip} label="Finish" />
    </div>
  );
}
