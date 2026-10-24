import { track } from "../analytics/events";
import type { ServiceSupabase } from "../db/service";
import { limit, type PlanSubject } from "./plans";

export type ReserveFailure = "ai_paused" | "budget_exceeded" | "daily_cap" | "insufficient_credits";

export const RESERVE_MESSAGES: Record<ReserveFailure, string> = {
  ai_paused: "AI drafting is paused for today while we check capacity. Please try again tomorrow.",
  budget_exceeded:
    "AI drafting is paused for today while we check capacity. Please try again tomorrow.",
  daily_cap:
    "You've reached today's limit of free drafts. Upgrade for unlimited daily drafts, or come back tomorrow.",
  insufficient_credits:
    "You don't have enough credits for this draft. Top up or upgrade to keep going.",
};

export async function ensureCreditGrant(db: ServiceSupabase, org: PlanSubject & { id: string }) {
  const { data } = await db.rpc("ensure_credit_grant", {
    p_org: org.id,
    p_allowance: limit(org, "monthly_credits_milli"),
  });
  return data ?? 0;
}

export async function reserveGeneration(
  db: ServiceSupabase,
  input: {
    org: PlanSubject & { id: string };
    userId: string | null;
    draftId: string;
    millicredits: number;
    costUsd: number;
  },
): Promise<
  | { ok: true; reservationId: string; balance: number }
  | { ok: false; reason: ReserveFailure; balance?: number }
> {
  const cap = limit(input.org, "daily_generations");
  const { data, error } = await db.rpc("reserve_generation", {
    p_org: input.org.id,
    p_user: input.userId as string,
    p_draft: input.draftId,
    p_est_millicredits: input.millicredits,
    p_est_cost_usd: input.costUsd,
    p_daily_cap: Number.isFinite(cap) ? cap : (null as unknown as number),
    p_allowance: limit(input.org, "monthly_credits_milli"),
  });
  if (error) throw error;
  const r = data as {
    ok: boolean;
    reason?: ReserveFailure;
    reservation_id?: string;
    balance?: number;
  };
  if (!r.ok) {
    if (r.reason === "insufficient_credits") {
      await track(
        {
          name: "credits_exhausted",
          orgId: input.org.id,
          userId: input.userId,
          props: { balance: r.balance ?? 0 },
        },
        db,
      );
    }
    if (r.reason === "budget_exceeded")
      console.error("[budget] global daily AI budget reached; generation paused for today");
    return { ok: false, reason: r.reason ?? "ai_paused", balance: r.balance };
  }
  return { ok: true, reservationId: r.reservation_id!, balance: r.balance ?? 0 };
}

export async function settleGeneration(
  db: ServiceSupabase,
  reservationId: string,
  millicredits: number,
  costUsd: number,
) {
  const { data, error } = await db.rpc("settle_generation", {
    p_reservation: reservationId,
    p_actual_millicredits: millicredits,
    p_actual_cost_usd: Number(costUsd.toFixed(6)),
  });
  if (error) throw error;
  return data;
}

export async function refundGeneration(db: ServiceSupabase, reservationId: string, costUsd = 0) {
  const { data, error } = await db.rpc("refund_generation", {
    p_reservation: reservationId,
    p_actual_cost_usd: Number(costUsd.toFixed(6)),
  });
  if (error) throw error;
  return data;
}
