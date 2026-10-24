"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { friendlyError } from "@/lib/auth/errors";
import { INVITE_COOKIE } from "@/lib/auth/invite-cookie";
import { requireUser } from "@/lib/auth/session";
import { setLiteDefaultIfUnset } from "@/lib/lite-mode.server";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { createOrgSchema } from "@/lib/validation/org";

export interface CreateOrgState {
  message?: string;
  errors?: FieldErrors;
}

export async function createOrganization(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const { db, user } = await requireUser("/onboarding");
  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    market: formData.get("market"),
    industry: formData.get("industry") || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const cookieStore = await cookies();
  const formCode = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();
  const inviteCode = formCode || cookieStore.get(INVITE_COOKIE)?.value;

  const { data: org, error } = await db.rpc("create_organization", {
    p_name: parsed.data.name,
    p_market: parsed.data.market,
    p_invite_code: inviteCode,
  });
  if (error || !org) {
    const message = friendlyError(error?.message);
    if (error?.message.includes("invite")) return { errors: { inviteCode: message } };
    return { message };
  }

  const { error: brandError } = await db.from("brands").insert({
    org_id: org.id,
    name: parsed.data.name,
    industry: parsed.data.industry ?? null,
    primary_language: parsed.data.market === "NG" ? "en-NG" : "en-GB",
  });
  if (brandError) console.error("[onboarding] brand insert failed", brandError.message);

  await db
    .from("profiles")
    .update({ onboarding_state: { org_id: org.id, step: "brand" } })
    .eq("user_id", user.id);

  cookieStore.delete(INVITE_COOKIE);
  await setLiteDefaultIfUnset(org.lite_mode_default);
  redirect(`/${org.slug}/setup`);
}
