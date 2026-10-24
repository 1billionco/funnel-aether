"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { friendlyError } from "@/lib/auth/errors";
import { requireOrg } from "@/lib/auth/session";
import { marketSchema } from "@/lib/validation/org";

export interface SettingsState {
  ok?: boolean;
  message?: string;
}

const profileSchema = z.object({ fullName: z.string().trim().min(1, "Enter your name.").max(120) });

export async function saveProfile(
  slug: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { db, user } = await requireOrg(slug);
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const [{ error }, { error: authError }] = await Promise.all([
    db.from("profiles").update({ full_name: parsed.data.fullName }).eq("user_id", user.id),
    db.auth.updateUser({ data: { full_name: parsed.data.fullName } }),
  ]);
  if (error || authError) return { message: "We couldn't save that. Please try again." };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true, message: "Saved." };
}

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

const orgSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name.").max(120),
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), "Choose a valid timezone."),
  businessAddress: z.string().trim().max(300).optional(),
  market: marketSchema,
});

export async function saveOrganization(
  slug: string,
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { db, org, role } = await requireOrg(slug);
  if (role !== "owner") return { message: "Only the owner can change business details." };
  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    businessAddress: formData.get("businessAddress") || undefined,
    market: formData.get("market") ?? org.market,
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };

  const { error } = await db
    .from("organizations")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      business_address: parsed.data.businessAddress ?? null,
    })
    .eq("id", org.id);
  if (error) return { message: "We couldn't save that. Please try again." };

  if (parsed.data.market !== org.market) {
    const { error: marketError } = await db.rpc("set_org_market", {
      p_org: org.id,
      p_market: parsed.data.market,
    });
    if (marketError) return { message: friendlyError(marketError.message) };
  }
  revalidatePath(`/${slug}`, "layout");
  return { ok: true, message: "Saved." };
}
