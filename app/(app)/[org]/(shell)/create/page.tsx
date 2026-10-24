import type { Metadata } from "next";

import { PageHeader } from "@/components/app/coming-soon";
import { CreateStudio } from "@/components/create/create-studio";
import { StateBlock } from "@/components/ui/misc";
import { canEdit, requireOrg } from "@/lib/auth/session";
import { getPrimaryBrand } from "@/lib/brands";
import { typicalEstimates } from "@/lib/credits/estimates";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { templatesFor } from "@/lib/templates";

export const metadata: Metadata = { title: "Create" };

export default async function CreatePage({ params, searchParams }: PageProps<"/[org]/create">) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, db, role } = await requireOrg(slug);
  const brand = await getPrimaryBrand(db, org.id);
  if (!brand)
    return (
      <StateBlock title="Set up your brand first">The AI needs to know how you sound.</StateBlock>
    );
  const estimates = await typicalEstimates(createSupabaseServiceClient(), org);

  return (
    <>
      <PageHeader
        title="Create"
        description="Describe what you need. The AI drafts it in your voice; you approve it in Review."
      />
      <CreateStudio
        slug={slug}
        brandName={brand.name}
        defaults={{ offer: brand.offer ?? "", audience: brand.audience ?? "" }}
        templates={templatesFor(org.market)}
        estimates={estimates}
        balance={org.credit_balance_milli}
        canGenerate={canEdit(role)}
        initialTemplateId={typeof sp.template === "string" ? sp.template : undefined}
      />
    </>
  );
}
