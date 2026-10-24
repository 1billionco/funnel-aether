import type { User } from "@supabase/supabase-js";

import { createSupabaseServiceClient } from "../db/service";
import { founderAdminEmails } from "../env";

/** Mirrors FOUNDER_ADMIN_EMAILS into profiles.is_founder_admin so DB-side checks see it. */
export async function syncFounderFlag(user: User | null | undefined) {
  const email = user?.email?.toLowerCase();
  if (!user || !email || !founderAdminEmails().includes(email)) return;
  await createSupabaseServiceClient()
    ?.from("profiles")
    .update({ is_founder_admin: true })
    .eq("user_id", user.id);
}
