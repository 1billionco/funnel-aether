import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { LLMProvider } from "@/lib/ai/provider";
import { asBrand } from "@/lib/brands";
import {
  ensureCreditGrant,
  refundGeneration,
  reserveGeneration,
  settleGeneration,
} from "@/lib/credits/ledger";
import type { ServiceSupabase } from "@/lib/db/service";
import { prepareGeneration, runGeneration } from "@/lib/generation/core";

import { createUserWithOrg, serviceClient } from "../support/supabase";

type Tenant = Awaited<ReturnType<typeof createUserWithOrg>>;
let db: ServiceSupabase;

async function balance(orgId: string) {
  const { data } = await db
    .from("organizations")
    .select("credit_balance_milli")
    .eq("id", orgId)
    .single();
  return data!.credit_balance_milli;
}

async function ledgerSum(orgId: string) {
  const { data } = await db.from("credit_ledger").select("delta").eq("org_id", orgId);
  return (data ?? []).reduce((s, r) => s + r.delta, 0);
}

async function orgRow(t: Tenant) {
  return (await db.from("organizations").select("*").eq("id", t.org.id).single()).data!;
}

async function brandRow(t: Tenant) {
  return asBrand((await db.from("brands").select("*").eq("id", t.brand.id).single()).data!);
}

beforeAll(() => {
  db = serviceClient() as unknown as ServiceSupabase;
});

afterEach(async () => {
  await db
    .from("app_settings")
    .update({ ai_kill_switch: false, ai_daily_budget_usd: 5 })
    .eq("id", true);
});

describe("credit ledger", () => {
  it("grants the monthly allowance once per period", async () => {
    const t = await createUserWithOrg("grant", "NG");
    expect(await balance(t.org.id)).toBe(10_000);
    await ensureCreditGrant(db, { id: t.org.id, plan: "free", market: "NG" });
    expect(await balance(t.org.id)).toBe(10_000);
    expect(await ledgerSum(t.org.id)).toBe(10_000);
  });

  it("reserves, settles to actual and keeps the ledger reconciled", async () => {
    const t = await createUserWithOrg("settle", "UK");
    const org = { id: t.org.id, plan: "free" as const, market: "UK" as const };
    const r = await reserveGeneration(db, {
      org,
      userId: t.id,
      draftId: randomUUID(),
      millicredits: 3000,
      costUsd: 0.006,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await balance(t.org.id)).toBe(12_000);
    await settleGeneration(db, r.reservationId, 1200, 0.0024);
    expect(await balance(t.org.id)).toBe(13_800);
    expect(await ledgerSum(t.org.id)).toBe(await balance(t.org.id));
    // Settling twice does nothing.
    expect(await settleGeneration(db, r.reservationId, 0, 0)).toBeNull();
    expect(await balance(t.org.id)).toBe(13_800);
  });

  it("refunds a failed generation in full", async () => {
    const t = await createUserWithOrg("refund", "UK");
    const org = { id: t.org.id, plan: "free" as const, market: "UK" as const };
    const r = await reserveGeneration(db, {
      org,
      userId: t.id,
      draftId: randomUUID(),
      millicredits: 2000,
      costUsd: 0.004,
    });
    if (!r.ok) throw new Error("reserve failed");
    await refundGeneration(db, r.reservationId);
    expect(await balance(t.org.id)).toBe(15_000);
    const { data } = await db
      .from("credit_ledger")
      .select("reason")
      .eq("org_id", t.org.id)
      .order("id");
    expect(data!.map((d) => d.reason)).toEqual(["monthly_grant", "generation", "refund"]);
  });

  it("blocks when the balance can't cover the estimate", async () => {
    const t = await createUserWithOrg("broke", "NG");
    const r = await reserveGeneration(db, {
      org: { id: t.org.id, plan: "free", market: "NG" },
      userId: t.id,
      draftId: randomUUID(),
      millicredits: 10_001,
      costUsd: 0.02,
    });
    expect(r).toMatchObject({ ok: false, reason: "insufficient_credits" });
    expect(await balance(t.org.id)).toBe(10_000);
    const { data: ev } = await db
      .from("events")
      .select("name")
      .eq("org_id", t.org.id)
      .eq("name", "credits_exhausted");
    expect(ev).toHaveLength(1);
  });

  it("caps free orgs at 5 generations a day", async () => {
    const t = await createUserWithOrg("cap", "UK");
    const org = { id: t.org.id, plan: "free" as const, market: "UK" as const };
    const results = [];
    for (let i = 0; i < 6; i++)
      results.push(
        (
          await reserveGeneration(db, {
            org,
            userId: t.id,
            draftId: randomUUID(),
            millicredits: 250,
            costUsd: 0,
          })
        ).ok,
      );
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("the kill switch blocks every generation", async () => {
    const t = await createUserWithOrg("kill", "UK");
    await db.from("app_settings").update({ ai_kill_switch: true }).eq("id", true);
    const r = await reserveGeneration(db, {
      org: { id: t.org.id, plan: "free", market: "UK" },
      userId: t.id,
      draftId: randomUUID(),
      millicredits: 250,
      costUsd: 0,
    });
    expect(r).toMatchObject({ ok: false, reason: "ai_paused" });
  });

  it("the global daily budget holds under concurrent requests", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const { data: spend } = await db
      .from("ai_daily_spend")
      .select("reserved_usd, actual_usd")
      .eq("day", day)
      .maybeSingle();
    const used = Number(spend?.reserved_usd ?? 0) + Number(spend?.actual_usd ?? 0);
    // Room for exactly 4 requests at $0.01.
    await db
      .from("app_settings")
      .update({ ai_daily_budget_usd: Number((used + 0.045).toFixed(2)) })
      .eq("id", true);
    const tenants = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createUserWithOrg(`budget${i}`, "UK")),
    );
    const attempts = await Promise.all(
      tenants.flatMap((t) =>
        [0, 1].map(() =>
          reserveGeneration(db, {
            org: { id: t.org.id, plan: "growth", market: "UK" },
            userId: t.id,
            draftId: randomUUID(),
            millicredits: 250,
            costUsd: 0.01,
          }),
        ),
      ),
    );
    const ok = attempts.filter((a) => a.ok).length;
    expect(ok).toBeLessThanOrEqual(4);
    expect(attempts.some((a) => !a.ok && a.reason === "budget_exceeded")).toBe(true);
    const { data: after } = await db
      .from("ai_daily_spend")
      .select("reserved_usd, actual_usd, breached_at")
      .eq("day", day)
      .single();
    const { data: settings } = await db
      .from("app_settings")
      .select("ai_daily_budget_usd")
      .eq("id", true)
      .single();
    expect(Number(after!.reserved_usd) + Number(after!.actual_usd)).toBeLessThanOrEqual(
      Number(settings!.ai_daily_budget_usd) + 1e-9,
    );
    expect(after!.breached_at).not.toBeNull();
    // Release the in-flight reservations so other tests have headroom.
    for (const a of attempts) if (a.ok) await refundGeneration(db, a.reservationId);
  });

  it("users can read their own ledger but not reserve credits themselves", async () => {
    const t = await createUserWithOrg("rlsledger", "UK");
    const other = await createUserWithOrg("rlsother", "UK");
    expect(
      (await t.client.from("credit_ledger").select("id").eq("org_id", t.org.id)).data!.length,
    ).toBeGreaterThan(0);
    expect(
      (await t.client.from("credit_ledger").select("id").eq("org_id", other.org.id)).data,
    ).toEqual([]);
    const { error } = await t.client.rpc("reserve_generation", {
      p_org: t.org.id,
      p_user: t.id,
      p_draft: randomUUID(),
      p_est_millicredits: -5000,
      p_est_cost_usd: 0,
      p_daily_cap: 5,
      p_allowance: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe("generation (mock provider)", () => {
  let t: Tenant;
  beforeAll(async () => {
    t = await createUserWithOrg("gen", "UK");
    await db
      .from("brands")
      .update({
        offer: "Bookkeeping",
        audience: "Small firms in Kent",
        dont_say: ["cheap"],
        example_ctas: ["Book a free call"],
      })
      .eq("id", t.brand.id);
  });

  it("creates a pending draft with version, score, telemetry and settled credits", async () => {
    const before = await balance(t.org.id);
    const prep = await prepareGeneration(
      db,
      { org: await orgRow(t), brand: await brandRow(t), userId: t.id },
      {
        type: "social_post",
        channel: "linkedin",
        variants: 2,
        brief: { goal: "Share a receipts tip" },
      },
    );
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    expect(prep.prepared.tier).toBe("fast");
    expect(prep.prepared.routerReason).toBe("free_plan");
    const { data: generating } = await db
      .from("drafts")
      .select("status")
      .eq("id", prep.prepared.draftId)
      .single();
    expect(generating!.status).toBe("generating"); // row exists before the model is called

    const deltas: string[] = [];
    const result = await runGeneration(db, prep.prepared, {
      deadlineMs: 20_000,
      onText: (v) => deltas.push(v),
    });
    expect(result.ok).toBe(true);
    expect(deltas.length).toBeGreaterThan(3);
    expect(deltas.at(-1)).not.toContain("===META===");

    const { data: draft } = await db
      .from("drafts")
      .select("*")
      .eq("id", prep.prepared.draftId)
      .single();
    expect(draft!.status).toBe("pending");
    expect(draft!.is_mock).toBe(true);
    expect((draft!.metadata as { variants: string[] }).variants).toHaveLength(2);
    expect(draft!.brand_match_score).toBeGreaterThan(0);
    expect(draft!.credits_used).toBe(250);
    expect(await balance(t.org.id)).toBe(before - 250);
    expect(await ledgerSum(t.org.id)).toBe(await balance(t.org.id));

    const { data: versions } = await db
      .from("draft_versions")
      .select("version, source")
      .eq("draft_id", draft!.id);
    expect(versions).toEqual([{ version: 1, source: "ai" }]);
    const { data: usage } = await db
      .from("usage_events")
      .select("feature, router_reason, is_mock")
      .eq("ref_id", draft!.id);
    expect(usage!.map((u) => u.feature)).toContain("generate_social_post");
    const { data: ev } = await db
      .from("events")
      .select("name")
      .eq("org_id", t.org.id)
      .eq("name", "draft_generated");
    expect(ev!.length).toBeGreaterThan(0);
  });

  it("regenerates with feedback as a new version and audits it", async () => {
    const { data: draft } = await db
      .from("drafts")
      .select("id")
      .eq("org_id", t.org.id)
      .eq("status", "pending")
      .limit(1)
      .single();
    const prep = await prepareGeneration(
      db,
      { org: await orgRow(t), brand: await brandRow(t), userId: t.id },
      {
        type: "social_post",
        channel: "linkedin",
        variants: 1,
        brief: { goal: "Share a receipts tip" },
        regenerate: { draftId: draft!.id, feedback: "Make it shorter" },
      },
    );
    if (!prep.ok) throw new Error(prep.reason);
    await runGeneration(db, prep.prepared, { deadlineMs: 20_000 });
    const { data: versions } = await db
      .from("draft_versions")
      .select("version, source, feedback_text")
      .eq("draft_id", draft!.id)
      .order("version");
    expect(versions!.map((v) => v.source)).toEqual(["ai", "ai_regen"]);
    expect(versions![1]!.feedback_text).toBe("Make it shorter");
    const { data: audit } = await db
      .from("approval_events")
      .select("action")
      .eq("draft_id", draft!.id);
    expect(audit!.map((a) => a.action)).toContain("regenerate");
  });

  it("saves a partial draft when the deadline hits", async () => {
    process.env.MOCK_STREAM_DELAY_MS = "40";
    const prep = await prepareGeneration(
      db,
      { org: await orgRow(t), brand: await brandRow(t), userId: t.id },
      {
        type: "email",
        channel: "email",
        variants: 1,
        brief: { goal: "Remind clients about the deadline" },
      },
    );
    if (!prep.ok) throw new Error(prep.reason);
    const result = await runGeneration(db, prep.prepared, { deadlineMs: 300 });
    process.env.MOCK_STREAM_DELAY_MS = "12";
    expect(result.ok && result.status).toBe("partial");
    const { data } = await db
      .from("drafts")
      .select("status, body")
      .eq("id", prep.prepared.draftId)
      .single();
    expect(data!.status).toBe("partial");
    expect(data!.body.length).toBeGreaterThan(0);
  });

  it("marks the draft failed and refunds when the provider errors", async () => {
    const before = await balance(t.org.id);
    const prep = await prepareGeneration(
      db,
      { org: await orgRow(t), brand: await brandRow(t), userId: t.id },
      { type: "whatsapp", channel: "whatsapp", variants: 1, brief: { goal: "Weekend promo" } },
    );
    if (!prep.ok) throw new Error(prep.reason);
    const broken: LLMProvider = {
      name: "anthropic",
      isMock: false,
      async *stream() {
        throw new Error("upstream 529");
      },
      complete: () => Promise.reject(new Error("x")),
    };
    const result = await runGeneration(
      db,
      { ...prep.prepared, provider: broken },
      { deadlineMs: 5_000 },
    );
    expect(result.ok).toBe(false);
    const { data } = await db
      .from("drafts")
      .select("status, error")
      .eq("id", prep.prepared.draftId)
      .single();
    expect(data!.status).toBe("failed");
    expect(await balance(t.org.id)).toBe(before);
  });

  it("the sweeper fails stuck drafts and refunds them", async () => {
    const before = await balance(t.org.id);
    const prep = await prepareGeneration(
      db,
      { org: await orgRow(t), brand: await brandRow(t), userId: t.id },
      { type: "whatsapp", channel: "whatsapp", variants: 1, brief: { goal: "Frozen function" } },
    );
    if (!prep.ok) throw new Error(prep.reason);
    expect(await balance(t.org.id)).toBeLessThan(before);
    await db
      .from("drafts")
      .update({ generation_started_at: new Date(Date.now() - 5 * 60_000).toISOString() })
      .eq("id", prep.prepared.draftId);
    const { data: swept } = await db.rpc("sweep_stuck_drafts", {});
    expect(swept).toBeGreaterThanOrEqual(1);
    const { data } = await db
      .from("drafts")
      .select("status")
      .eq("id", prep.prepared.draftId)
      .single();
    expect(data!.status).toBe("failed");
    expect(await balance(t.org.id)).toBe(before);
  });

  it("other tenants can't see drafts", async () => {
    const other = await createUserWithOrg("peek", "UK");
    const { data } = await other.client.from("drafts").select("id").eq("org_id", t.org.id);
    expect(data).toEqual([]);
    const { error } = await t.client
      .from("drafts")
      .update({ status: "approved" })
      .eq("org_id", t.org.id);
    expect(error).not.toBeNull();
  });
});
