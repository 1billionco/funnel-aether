import "server-only";

import type { ServiceSupabase } from "@/lib/db/service";

/** Today's global AI spend and the 7-day router blend (founder admin, spec §6.2/§6.6). */
export async function aiStats(db: ServiceSupabase, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [{ data: spend }, { data: routes }] = await Promise.all([
    db.from("ai_daily_spend").select("*").eq("day", today).maybeSingle(),
    db.from("drafts").select("tier").gte("created_at", weekAgo).not("tier", "is", null).limit(5000),
  ]);
  const fast = (routes ?? []).filter((r) => r.tier === "fast").length;
  const smart = (routes ?? []).filter((r) => r.tier === "smart").length;
  return {
    spentUsd: Number(spend?.actual_usd ?? 0) + Number(spend?.reserved_usd ?? 0),
    breached: !!spend?.breached_at,
    fastPct: fast + smart ? Math.round((fast / (fast + smart)) * 100) : null,
  };
}
