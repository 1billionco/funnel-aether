import { createSupabaseServiceClient, type ServiceSupabase } from "../db/service";
import type { Json } from "../db/types";

/** First-party product events (spec §10). Server-side only. */
export const EVENT_NAMES = [
  "signed_up",
  "onboarding_started",
  "brand_trained",
  "onboarding_completed",
  "draft_generated",
  "draft_approved",
  "draft_rejected",
  "draft_edited_before_approve",
  "form_created",
  "lead_captured",
  "campaign_activated",
  "email_sent",
  "first_value_reached",
  "upgrade_clicked",
  "checkout_started",
  "subscription_started",
  "subscription_cancelled",
  "credits_exhausted",
  "credit_pack_purchased",
  "feedback_submitted",
  // Operational events used by the founder admin.
  "budget_breached",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface TrackInput {
  name: EventName;
  orgId?: string | null;
  userId?: string | null;
  props?: Record<string, Json | undefined>;
}

/**
 * Records an event in the first-party `events` table. Never throws: analytics
 * must not break the product. In mock mode (no DB) it logs to the console.
 */
export async function track(
  input: TrackInput,
  db: ServiceSupabase | null = createSupabaseServiceClient(),
) {
  const row = {
    name: input.name,
    org_id: input.orgId ?? null,
    user_id: input.userId ?? null,
    props: (input.props ?? {}) as { [key: string]: Json | undefined },
  };
  if (!db) {
    if (process.env.NODE_ENV !== "test") console.info("[event:mock]", row.name, row.props);
    return;
  }
  const { error } = await db.from("events").insert(row);
  if (error) console.error("[event] failed to record", row.name, error.message);
}

/** True if the org has ever emitted this event (used for "first_*" milestones). */
export async function hasEvent(db: ServiceSupabase, orgId: string, name: EventName) {
  const { count } = await db
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("name", name);
  return (count ?? 0) > 0;
}
