import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withOrg } from "@/lib/db/with-org";

import {
  anonClient,
  createInvite,
  createUser,
  createUserWithOrg,
  serviceClient,
} from "../support/supabase";

type Tenant = Awaited<ReturnType<typeof createUserWithOrg>>;

let a: Tenant;
let b: Tenant;

beforeAll(async () => {
  await serviceClient().from("app_settings").update({ signup_mode: "invite" }).eq("id", true);
  a = await createUserWithOrg("alpha", "UK");
  b = await createUserWithOrg("bravo", "NG");
});

afterAll(async () => {
  await serviceClient().from("app_settings").update({ signup_mode: "invite" }).eq("id", true);
});

describe("row level security: cross-tenant isolation", () => {
  it("a user sees only their own organisation", async () => {
    const { data } = await a.client.from("organizations").select("id");
    expect(data?.map((o) => o.id)).toEqual([a.org.id]);
  });

  it("cannot read another org's brands, memberships or jobs", async () => {
    for (const table of ["brands", "memberships", "jobs"] as const) {
      const { data, error } = await a.client.from(table).select("org_id").eq("org_id", b.org.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("cannot update another org or its brand", async () => {
    await a.client.from("organizations").update({ name: "hijacked" }).eq("id", b.org.id);
    await a.client.from("brands").update({ name: "hijacked" }).eq("id", b.brand.id);
    const { data: org } = await serviceClient()
      .from("organizations")
      .select("name")
      .eq("id", b.org.id)
      .single();
    const { data: brand } = await serviceClient()
      .from("brands")
      .select("name")
      .eq("id", b.brand.id)
      .single();
    expect(org?.name).toBe("bravo business");
    expect(brand?.name).toBe("bravo brand");
  });

  it("cannot insert a brand into another org", async () => {
    const { error } = await a.client.from("brands").insert({ org_id: b.org.id, name: "intruder" });
    expect(error).not.toBeNull();
  });

  it("cannot write server-owned columns on their own rows", async () => {
    const plan = await a.client
      .from("organizations")
      .update({ plan: "advanced" } as never)
      .eq("id", a.org.id);
    expect(plan.error).not.toBeNull();
    const score = await a.client
      .from("brands")
      .update({ training_quality_score: 100 } as never)
      .eq("id", a.brand.id);
    expect(score.error).not.toBeNull();
    const founder = await a.client
      .from("profiles")
      .update({ is_founder_admin: true } as never)
      .eq("user_id", a.id);
    expect(founder.error).not.toBeNull();
  });

  it("cannot add themselves to another org", async () => {
    const { error } = await a.client
      .from("memberships")
      .insert({ org_id: b.org.id, user_id: a.id, role: "owner" });
    expect(error).not.toBeNull();
  });

  it("cannot see another tenant's profile", async () => {
    const { data } = await a.client.from("profiles").select("user_id").eq("user_id", b.id);
    expect(data).toEqual([]);
  });

  it("anonymous visitors see nothing", async () => {
    const anon = anonClient();
    for (const table of [
      "organizations",
      "brands",
      "profiles",
      "events",
      "beta_invites",
      "app_settings",
    ] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
  });

  it("users cannot read events, invites or app settings", async () => {
    for (const table of ["events", "beta_invites", "app_settings", "admin_audit"] as const) {
      const { data } = await a.client.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
  });

  it("cannot call server-only RPCs", async () => {
    const { error } = await a.client.rpc("rate_limit_take", {
      p_key: "x",
      p_capacity: 1,
      p_refill_per_second: 1,
    });
    expect(error).not.toBeNull();
  });
});

describe("invite gating (create_organization)", () => {
  it("requires an invite code in invite mode", async () => {
    const u = await createUser("noinvite");
    const { error } = await u.client.rpc("create_organization", {
      p_name: "No invite",
      p_market: "UK",
    });
    expect(error?.message).toContain("invite_required");
  });

  it("rejects unknown, used-up, expired and wrong-market codes", async () => {
    const u = await createUser("badinvite");
    const used = await createInvite({ maxUses: 1 });
    const first = await createUser("firstuse");
    expect(
      (
        await first.client.rpc("create_organization", {
          p_name: "First",
          p_market: "UK",
          p_invite_code: used,
        })
      ).error,
    ).toBeNull();

    const expired = await createInvite({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const ngOnly = await createInvite({ market: "NG" });
    for (const [code, expected] of [
      ["NOPE-NOPE", "invite_invalid"],
      [used, "invite_invalid"],
      [expired, "invite_invalid"],
      [ngOnly, "invite_wrong_market"],
    ] as const) {
      const { error } = await u.client.rpc("create_organization", {
        p_name: "Bad",
        p_market: "UK",
        p_invite_code: code,
      });
      expect(error?.message, code).toContain(expected);
    }
  });

  it("redeems a code once and records the redemption", async () => {
    const code = await createInvite({ maxUses: 2 });
    const u = await createUser("redeem");
    const { data: org, error } = await u.client.rpc("create_organization", {
      p_name: "Redeemer",
      p_market: "NG",
      p_invite_code: code.toLowerCase(),
    });
    expect(error).toBeNull();
    expect(org?.currency).toBe("NGN");
    expect(org?.lite_mode_default).toBe(true);
    const svc = serviceClient();
    const { data: invite } = await svc
      .from("beta_invites")
      .select("used_count")
      .eq("code", code)
      .single();
    expect(invite?.used_count).toBe(1);
    const { data: events } = await svc.from("events").select("name").eq("org_id", org!.id);
    expect(events?.map((e) => e.name)).toContain("onboarding_started");
  });

  it("allows one owned org per user", async () => {
    const { error } = await a.client.rpc("create_organization", {
      p_name: "Second",
      p_market: "UK",
      p_invite_code: await createInvite(),
    });
    expect(error?.message).toContain("already_owns_org");
  });

  it("blocks sign-ups when closed and allows them without a code when open", async () => {
    const svc = serviceClient();
    await svc.from("app_settings").update({ signup_mode: "closed" }).eq("id", true);
    const closed = await createUser("closed");
    expect(
      (
        await closed.client.rpc("create_organization", {
          p_name: "Closed",
          p_market: "UK",
          p_invite_code: await createInvite(),
        })
      ).error?.message,
    ).toContain("signups_closed");

    await svc.from("app_settings").update({ signup_mode: "open" }).eq("id", true);
    const open = await createUser("open");
    expect(
      (await open.client.rpc("create_organization", { p_name: "Open", p_market: "UK" })).error,
    ).toBeNull();
    await svc.from("app_settings").update({ signup_mode: "invite" }).eq("id", true);
  });

  it("generates a URL-safe, non-reserved slug", async () => {
    const u = await createUser("slug");
    const { data: org } = await u.client.rpc("create_organization", {
      p_name: "Admin",
      p_market: "UK",
      p_invite_code: await createInvite(),
    });
    expect(org?.slug).toMatch(/^org-admin(-[a-f0-9]{4})?$/);
  });

  it("records signed_up for new users", async () => {
    const u = await createUser("signedup");
    const { data } = await serviceClient().from("events").select("name").eq("user_id", u.id);
    expect(data?.map((e) => e.name)).toContain("signed_up");
  });
});

describe("market changes", () => {
  it("are allowed for the owner until locked", async () => {
    const t = await createUserWithOrg("market", "UK");
    const { data, error } = await t.client.rpc("set_org_market", {
      p_org: t.org.id,
      p_market: "NG",
    });
    expect(error).toBeNull();
    expect(data?.currency).toBe("NGN");
    await serviceClient().from("organizations").update({ market_locked: true }).eq("id", t.org.id);
    const locked = await t.client.rpc("set_org_market", { p_org: t.org.id, p_market: "UK" });
    expect(locked.error?.message).toContain("market_locked");
  });

  it("cannot be changed by a non-member", async () => {
    const { error } = await a.client.rpc("set_org_market", { p_org: b.org.id, p_market: "UK" });
    expect(error?.message).toContain("forbidden");
  });
});

describe("withOrg (service role scoping)", () => {
  it("only reads and updates rows in the given org", async () => {
    const scoped = withOrg(serviceClient(), a.org.id);
    const { data } = await scoped.select("brands", "id, org_id");
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r: { org_id: string }) => r.org_id === a.org.id)).toBe(true);

    await scoped.update("brands", { name: "scoped" }).eq("id", b.brand.id);
    const { data: bBrand } = await serviceClient()
      .from("brands")
      .select("name")
      .eq("id", b.brand.id)
      .single();
    expect(bBrand?.name).toBe("bravo brand");
  });

  it("forces org_id on insert even if another is supplied", async () => {
    const scoped = withOrg(serviceClient(), a.org.id);
    await scoped.insert("jobs", { type: "test", org_id: b.org.id } as never);
    const { data } = await serviceClient().from("jobs").select("org_id").eq("type", "test");
    expect(data?.every((j) => j.org_id === a.org.id)).toBe(true);
  });

  it("refuses an empty org id", () => {
    expect(() => withOrg(serviceClient(), "")).toThrow();
  });
});

describe("rate limiting", () => {
  it("allows up to capacity then blocks", async () => {
    const svc = serviceClient();
    const key = `test:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await svc.rpc("rate_limit_take", {
        p_key: key,
        p_capacity: 3,
        p_refill_per_second: 0.0001,
      });
      results.push(data);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
