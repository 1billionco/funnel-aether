"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireFounderAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/db/service";

export interface AdminState {
  ok?: boolean;
  message?: string;
}

async function adminDb() {
  const { user } = await requireFounderAdmin();
  const db = createSupabaseServiceClient();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin actions");
  return { db, user };
}

const settingsSchema = z.object({
  signupMode: z.enum(["open", "invite", "closed"]),
  maxOrgs: z.coerce.number().int().min(0).max(100_000),
});

export async function saveSignupSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { db, user } = await adminDb();
  const parsed = settingsSchema.safeParse({
    signupMode: formData.get("signupMode"),
    maxOrgs: formData.get("maxOrgs"),
  });
  if (!parsed.success) return { message: "Check the values and try again." };
  const { error } = await db
    .from("app_settings")
    .update({
      signup_mode: parsed.data.signupMode,
      max_orgs: parsed.data.maxOrgs,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { message: error.message };
  await db
    .from("admin_audit")
    .insert({ actor: user.id, action: "signup_settings", payload: parsed.data });
  revalidatePath("/admin");
  return { ok: true, message: "Saved." };
}

const inviteSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,40}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  maxUses: z.coerce.number().int().min(1).max(10_000),
  market: z.enum(["UK", "NG", "ANY"]),
  expiresInDays: z.coerce.number().int().min(0).max(365),
  note: z.string().trim().max(200).optional(),
});

export async function createInvite(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const { db, user } = await adminDb();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { message: "Codes use letters, numbers and dashes (4–40 characters)." };
  const code = parsed.data.code ?? `BETA-${randomBytes(4).toString("hex").toUpperCase()}`;
  const { error } = await db.from("beta_invites").insert({
    code,
    max_uses: parsed.data.maxUses,
    market: parsed.data.market === "ANY" ? null : parsed.data.market,
    expires_at: parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
      : null,
    note: parsed.data.note || null,
    created_by: user.id,
  });
  if (error)
    return { message: error.code === "23505" ? "That code already exists." : error.message };
  await db
    .from("admin_audit")
    .insert({ actor: user.id, action: "invite_created", payload: { code } });
  revalidatePath("/admin");
  return { ok: true, message: `Created ${code}.` };
}

const aiSchema = z.object({
  killSwitch: z.enum(["on", "off"]),
  budget: z.coerce.number().min(0).max(10_000),
});

/** Kill switch + global daily AI budget (spec §6.6). */
export async function saveAiControls(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const { db, user } = await adminDb();
  const parsed = aiSchema.safeParse({
    killSwitch: formData.get("killSwitch") ?? "off",
    budget: formData.get("budget"),
  });
  if (!parsed.success) return { message: "Check the budget and try again." };
  const { error } = await db
    .from("app_settings")
    .update({
      ai_kill_switch: parsed.data.killSwitch === "on",
      ai_daily_budget_usd: parsed.data.budget,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { message: error.message };
  await db
    .from("admin_audit")
    .insert({ actor: user.id, action: "ai_controls", payload: parsed.data });
  revalidatePath("/admin");
  return {
    ok: true,
    message: parsed.data.killSwitch === "on" ? "AI generation is paused for everyone." : "Saved.",
  };
}
