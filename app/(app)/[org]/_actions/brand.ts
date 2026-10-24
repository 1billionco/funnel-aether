"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canEdit, requireOrg } from "@/lib/auth/session";
import { nextStep, type SetupStepId } from "@/lib/onboarding/steps";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { brandQuestionnaireSchema, questionnaireFromForm } from "@/lib/validation/org";

export interface BrandFormState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
}

export async function saveBrandQuestionnaire(
  slug: string,
  brandId: string,
  continueTo: "setup" | "stay",
  _prev: BrandFormState,
  formData: FormData,
): Promise<BrandFormState> {
  const { db, org, role, user } = await requireOrg(slug);
  if (!canEdit(role)) return { message: "Only owners and editors can change the brand." };

  const parsed = brandQuestionnaireSchema.safeParse(questionnaireFromForm(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { errors, message: "Check the highlighted fields." };
  }
  const b = parsed.data;
  const { error } = await db
    .from("brands")
    .update({
      offer: b.offer,
      audience: b.audience,
      industry: b.industry ?? null,
      tone_sliders: b.tone,
      do_say: b.doSay,
      dont_say: b.dontSay,
      compliance_rules: b.complianceRules,
      example_ctas: b.exampleCtas,
      website_url: b.websiteUrl ?? null,
      whatsapp_number: b.whatsappNumber ?? null,
    })
    .eq("id", brandId)
    .eq("org_id", org.id);
  if (error) return { message: "We couldn't save your brand. Please try again." };

  revalidatePath(`/${slug}`, "layout");
  if (continueTo === "setup") {
    const next = nextStep("brand");
    await db
      .from("profiles")
      .update({ onboarding_state: { org_id: org.id, step: next ?? "brand" } })
      .eq("user_id", user.id);
    redirect(next ? `/${slug}/setup/${next}` : `/${slug}/today`);
  }
  return { ok: true, message: "Saved." };
}

/** Moves the wizard forward (Skip / Continue), or finishes onboarding after the last step. */
export async function advanceSetup(slug: string, from: SetupStepId) {
  const { db, org, user } = await requireOrg(slug);
  const next = nextStep(from);
  if (next) {
    await db
      .from("profiles")
      .update({ onboarding_state: { org_id: org.id, step: next } })
      .eq("user_id", user.id);
    redirect(`/${slug}/setup/${next}`);
  }
  await finishOnboarding(slug);
}

export async function finishOnboarding(slug: string, landOn: "today" | "review" = "today") {
  const { db, org } = await requireOrg(slug);
  await db.rpc("complete_onboarding", { p_org: org.id });
  revalidatePath(`/${slug}`, "layout");
  redirect(`/${slug}/${landOn}${landOn === "review" ? "?welcome=1" : ""}`);
}
