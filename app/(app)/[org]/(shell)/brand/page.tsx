import type { Metadata } from "next";

import { saveBrandQuestionnaire } from "@/app/(app)/[org]/_actions/brand";
import { PageHeader } from "@/components/app/coming-soon";
import { DocumentList } from "@/components/brand/document-list";
import { QualityCard } from "@/components/brand/quality-card";
import { QuestionnaireForm } from "@/components/brand/questionnaire-form";
import { SampleUploader } from "@/components/brand/sample-uploader";
import { SummaryCard } from "@/components/brand/summary-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBlock } from "@/components/ui/misc";
import { canEdit, requireOrg } from "@/lib/auth/session";
import { getPrimaryBrand } from "@/lib/brands";
import { listBrandDocuments } from "@/lib/brand-voice/queries";
import { trainingTips } from "@/lib/brand-voice/quality";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandPage({ params }: PageProps<"/[org]/brand">) {
  const { org: slug } = await params;
  const { org, db, role } = await requireOrg(slug);
  const brand = await getPrimaryBrand(db, org.id);
  if (!brand) return <StateBlock title="No brand yet">Create a brand to get started.</StateBlock>;
  const docs = await listBrandDocuments(db, brand.id);
  const readyTypes = Array.from(
    new Set(docs.filter((d) => d.status === "ready").map((d) => d.doc_type)),
  );
  const tips = trainingTips(
    { documentCount: brand.document_count, chunkCount: brand.chunk_count, docTypes: readyTypes },
    brand,
  );
  const editable = canEdit(role);

  return (
    <>
      <PageHeader
        title={brand.name}
        description="This is how the AI writes for you. Changes apply to your next draft."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand summary</CardTitle>
              <CardDescription>
                How you sound, in a paragraph. AI drafts it; you approve it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SummaryCard
                slug={slug}
                brandId={brand.id}
                summary={brand.summary}
                status={brand.summary_status}
                canEdit={editable}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Writing samples</CardTitle>
              <CardDescription>
                Past posts, emails, adverts or your website. We use them as examples of your voice.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {editable ? <SampleUploader slug={slug} brandId={brand.id} /> : null}
              <DocumentList slug={slug} docs={docs} canEdit={editable} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand profile</CardTitle>
              <CardDescription>Your answers from setup.</CardDescription>
            </CardHeader>
            <CardContent>
              {editable ? (
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
            </CardContent>
          </Card>
        </div>
        <aside className="flex flex-col gap-6">
          <QualityCard score={brand.training_quality_score} tips={tips} />
        </aside>
      </div>
    </>
  );
}
