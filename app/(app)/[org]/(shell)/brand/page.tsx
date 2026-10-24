import type { Metadata } from "next";

import { saveBrandQuestionnaire } from "@/app/(app)/[org]/_actions/brand";
import { PageHeader } from "@/components/app/coming-soon";
import { QuestionnaireForm } from "@/components/brand/questionnaire-form";
import { StateBlock } from "@/components/ui/misc";
import { canEdit, requireOrg } from "@/lib/auth/session";
import { getPrimaryBrand } from "@/lib/brands";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandPage({ params }: PageProps<"/[org]/brand">) {
  const { org: slug } = await params;
  const { org, db, role } = await requireOrg(slug);
  const brand = await getPrimaryBrand(db, org.id);
  if (!brand) return <StateBlock title="No brand yet">Create a brand to get started.</StateBlock>;

  return (
    <>
      <PageHeader
        title={brand.name}
        description="This is how the AI writes for you. Changes apply to your next draft."
      />
      <div className="max-w-2xl">
        {canEdit(role) ? (
          <QuestionnaireForm
            action={saveBrandQuestionnaire.bind(null, slug, brand.id, "stay")}
            brand={brand}
            market={org.market}
            submitLabel="Save changes"
          />
        ) : (
          <p className="text-muted">
            You have review access, so you can see but not change the brand.
          </p>
        )}
      </div>
    </>
  );
}
