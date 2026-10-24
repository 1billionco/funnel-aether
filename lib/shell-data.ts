import "server-only";

import type { ServerSupabase } from "@/lib/db/server";

/** Counts shown in the shell chrome (one round trip). */
export async function getShellCounts(db: ServerSupabase, orgId: string) {
  const { count } = await db
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["pending", "partial"]);
  return { pending: count ?? 0 };
}
