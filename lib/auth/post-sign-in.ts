import "server-only";

import type { User } from "@supabase/supabase-js";

import type { ServerSupabase } from "@/lib/db/server";
import { setLiteDefaultIfUnset } from "@/lib/lite-mode.server";

import { syncFounderFlag } from "./founder";

/**
 * Runs right after a session is created (password action, email link, OAuth).
 * Must be called where cookies are writable (Server Action / Route Handler).
 * Returns where the user should land.
 */
export async function afterSignIn(db: ServerSupabase, user: User): Promise<string> {
  await syncFounderFlag(user);
  const { data } = await db
    .from("memberships")
    .select("organizations!inner(slug, lite_mode_default, onboarding_completed_at, deleted_at)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(5);
  const org = (data ?? []).map((m) => m.organizations).find((o) => !o.deleted_at);
  if (!org) return "/onboarding";
  await setLiteDefaultIfUnset(org.lite_mode_default);
  return org.onboarding_completed_at ? `/${org.slug}/today` : `/${org.slug}/setup`;
}
