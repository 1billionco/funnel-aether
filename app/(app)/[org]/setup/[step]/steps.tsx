import type { ReactNode } from "react";

import { advanceSetup, finishOnboarding } from "@/app/(app)/[org]/_actions/brand";
import { CreateStudio } from "@/components/create/create-studio";
import { typicalEstimates } from "@/lib/credits/estimates";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { templatesFor } from "@/lib/templates";
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
  org,
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

  // first-draft: one preset template for the market, then land in Review.
  const estimates = await typicalEstimates(createSupabaseServiceClient(), org);
  const templateId = org.market === "NG" ? "ng-weekend-whatsapp" : "uk-linkedin-insight";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Let&apos;s write your first draft</h1>
        <p className="mt-1 text-muted">
          We&apos;ve picked a starter. Change anything, then press Generate. You&apos;ll approve it
          next.
        </p>
      </div>
      <CreateStudio
        slug={slug}
        brandName={brand.name}
        defaults={{ offer: brand.offer ?? "", audience: brand.audience ?? "" }}
        templates={templatesFor(org.market)}
        estimates={estimates}
        balance={org.credit_balance_milli}
        canGenerate
        compact
        initialTemplateId={templateId}
        onDone={
          <form
            action={finishOnboarding.bind(null, slug, "review")}
            className="flex flex-col gap-2 rounded-card border border-amber/40 bg-amber-tint p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm">Your draft is waiting for your approval.</p>
            <Button type="submit">Review and approve it</Button>
          </form>
        }
      />
      <div className="flex justify-end border-t border-line pt-6">{skip}</div>
    </div>
  );
}
