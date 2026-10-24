import "server-only";

import type { ServerSupabase } from "@/lib/db/server";
import type { Brand } from "@/lib/brands";
import type { CoreLoopInput } from "@/lib/core-loop";

/** Numbers for Today and the core-loop checklist. Leads and campaigns arrive in M4/M5. */
export async function getCoreLoopInput(
  db: ServerSupabase,
  orgId: string,
  brand: Brand | null,
): Promise<CoreLoopInput & { approvedThisWeek: number; postedThisWeek: number }> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [generated, approved, pending, approvedWeek, postedWeek] = await Promise.all([
    db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("status", "in", "(generating,failed)"),
    db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["approved", "scheduled", "posted", "sent"]),
    db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["pending", "partial"]),
    db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("approved_at", weekAgo),
    db
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("posted_at", weekAgo),
  ]);
  return {
    brandProfileDone: !!(brand?.offer && brand?.audience),
    brandTrained: (brand?.document_count ?? 0) > 0 || brand?.summary_status === "approved",
    draftsGenerated: generated.count ?? 0,
    draftsApproved: approved.count ?? 0,
    pendingDrafts: pending.count ?? 0,
    leads: 0,
    campaignSends: 0,
    approvedThisWeek: approvedWeek.count ?? 0,
    postedThisWeek: postedWeek.count ?? 0,
  };
}
