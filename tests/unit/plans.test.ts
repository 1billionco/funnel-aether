import { describe, expect, it } from "vitest";

import { can, limit, PLANS, planPrice } from "@/lib/credits/plans";

describe("plans", () => {
  it("matches the spec prices", () => {
    expect(PLANS.growth.price).toEqual({ UK: 29, NG: 15_000 });
    expect(PLANS.advanced.price).toEqual({ UK: 79, NG: 25_000 });
    expect(planPrice({ plan: "free", market: "NG" })).toBe(0);
  });

  it("gives free orgs market-specific credits and the fast model only", () => {
    expect(limit({ plan: "free", market: "UK" }, "monthly_credits_milli")).toBe(15_000);
    expect(limit({ plan: "free", market: "NG" }, "monthly_credits_milli")).toBe(10_000);
    expect(can({ plan: "free", market: "UK" }, "smart_model")).toBe(false);
    expect(can({ plan: "growth", market: "UK" }, "smart_model")).toBe(true);
  });

  it("caps free generations per day and leaves paid unlimited", () => {
    expect(limit({ plan: "free", market: "UK" }, "daily_generations")).toBe(5);
    expect(limit({ plan: "growth", market: "NG" }, "daily_generations")).toBe(Infinity);
  });

  it("encodes brands, contacts and seats per the spec table", () => {
    const o = (plan: "free" | "growth" | "advanced") => ({ plan, market: "UK" as const });
    expect([
      limit(o("free"), "brands"),
      limit(o("growth"), "brands"),
      limit(o("advanced"), "brands"),
    ]).toEqual([1, 3, 10]);
    expect([
      limit(o("free"), "contacts"),
      limit(o("growth"), "contacts"),
      limit(o("advanced"), "contacts"),
    ]).toEqual([100, 2500, 10000]);
    expect([
      limit(o("free"), "seats"),
      limit(o("growth"), "seats"),
      limit(o("advanced"), "seats"),
    ]).toEqual([1, 1, 3]);
  });
});
