import { describe, expect, it } from "vitest";

import { detectFlags, mergeFlags } from "@/lib/ai/flags";
import { META_MARK, parseOutput, VARIANT_MARK, visibleText } from "@/lib/ai/output-parser";
import { OUTPUT_TYPES, type OutputType } from "@/lib/ai/output-types";
import { chooseTier, shouldEscalate } from "@/lib/ai/router";
import { costToMillicredits, estimateGeneration } from "@/lib/credits/meter";
import type { Market, PlanId } from "@/lib/credits/plans";

const PLANS: PlanId[] = ["free", "growth", "advanced"];
const MARKETS: Market[] = ["UK", "NG"];
const TYPES = Object.keys(OUTPUT_TYPES) as OutputType[];

describe("router", () => {
  it("never sends a free-plan org to the smart model (every combination)", () => {
    for (const market of MARKETS)
      for (const outputType of TYPES)
        for (const regenerateAfterFast of [false, true]) {
          expect(
            chooseTier({ org: { plan: "free", market }, outputType, regenerateAfterFast }).tier,
          ).toBe("fast");
          expect(
            shouldEscalate({
              org: { plan: "free", market },
              tier: "fast",
              alreadyEscalated: false,
              brandMatch: 0,
            }),
          ).toBe(false);
        }
  });

  it("defaults paid plans to fast and escalates only by rule", () => {
    const org = { plan: "growth" as const, market: "UK" as const };
    expect(chooseTier({ org, outputType: "social_post" })).toEqual({
      tier: "fast",
      reason: "default_fast",
    });
    expect(chooseTier({ org, outputType: "landing_copy" })).toEqual({
      tier: "smart",
      reason: "long_form",
    });
    expect(chooseTier({ org, outputType: "email", regenerateAfterFast: true })).toEqual({
      tier: "smart",
      reason: "regen_after_fast",
    });
  });

  it("escalates at most once on a low brand match", () => {
    const org = { plan: "advanced" as const, market: "NG" as const };
    expect(shouldEscalate({ org, tier: "fast", alreadyEscalated: false, brandMatch: 55 })).toBe(
      true,
    );
    expect(shouldEscalate({ org, tier: "fast", alreadyEscalated: true, brandMatch: 10 })).toBe(
      false,
    );
    expect(shouldEscalate({ org, tier: "smart", alreadyEscalated: false, brandMatch: 10 })).toBe(
      false,
    );
    expect(shouldEscalate({ org, tier: "fast", alreadyEscalated: false, brandMatch: 75 })).toBe(
      false,
    );
  });

  it("keeps the expected plan mix mostly fast", () => {
    const routes = PLANS.flatMap((plan) =>
      TYPES.map((outputType) => chooseTier({ org: { plan, market: "UK" }, outputType })),
    );
    expect(routes.filter((r) => r.tier === "fast").length).toBeGreaterThan(routes.length / 2);
  });
});

describe("credit metering", () => {
  it("converts cost to milli-credits with a ¼-credit minimum", () => {
    expect(costToMillicredits(0, 0.002)).toBe(250);
    expect(costToMillicredits(0.002, 0.002)).toBe(1000);
    expect(costToMillicredits(0.0061, 0.002)).toBe(3050);
    expect(costToMillicredits(0.00200001, 0.002)).toBe(1001); // always rounds up
  });

  it("reserves the worst case and shows a typical estimate", () => {
    const price = {
      model: "m",
      input_per_mtok: 1,
      output_per_mtok: 5,
      cache_read_per_mtok: 0.1,
      cache_write_per_mtok: 1.25,
    };
    const e = estimateGeneration({
      price,
      inputTokens: 2000,
      maxOutputTokens: 1000,
      typicalOutputTokens: 400,
      creditValueUsd: 0.002,
    });
    expect(e.reserveCostUsd).toBeCloseTo(0.007);
    expect(e.reserveMillicredits).toBe(3500);
    expect(e.typicalMillicredits).toBe(2000);
    expect(e.typicalMillicredits).toBeLessThanOrEqual(e.reserveMillicredits);
  });

  it("charges the minimum when the price is unknown (mock)", () => {
    const e = estimateGeneration({
      price: undefined,
      inputTokens: 2000,
      maxOutputTokens: 1000,
      typicalOutputTokens: 400,
      creditValueUsd: 0.002,
    });
    expect(e.reserveMillicredits).toBe(250);
  });
});

describe("output parser", () => {
  const raw = `First version here.\n${VARIANT_MARK}\nSecond version.\n${META_MARK}\n\`\`\`json\n{"title":"Promo","hashtags":["sale","#Lagos"],"cta":"WhatsApp us","flags":[{"type":"fake_scarcity","message":"Check stock claim"},"note"]}\n\`\`\``;

  it("splits variants and parses meta (even in a code fence)", () => {
    const r = parseOutput(raw);
    expect(r.variants).toEqual(["First version here.", "Second version."]);
    expect(r.metaValid).toBe(true);
    expect(r.meta.hashtags).toEqual(["#sale", "#Lagos"]);
    expect(r.meta.flags).toEqual([
      { type: "fake_scarcity", message: "Check stock claim" },
      { type: "other", message: "note" },
    ]);
  });

  it("survives missing or broken meta", () => {
    expect(parseOutput("Just a body").variants).toEqual(["Just a body"]);
    expect(parseOutput(`Body\n${META_MARK}\n{not json`).metaValid).toBe(false);
  });

  it("never shows the meta block or a half-received marker while streaming", () => {
    expect(visibleText(`Hello${META_MARK}{"a":1}`)).toBe("Hello");
    expect(visibleText("Hello\n===ME")).toBe("Hello\n");
    expect(visibleText("Hello")).toBe("Hello");
  });
});

describe("safety flags", () => {
  it("catches scarcity, testimonials, regulated claims and banned words", () => {
    const flags = detectFlags(
      'Only 3 left! "Best accountant ever" — Sarah. Guaranteed savings. Cheap prices.',
      ["cheap"],
    );
    expect(flags.map((f) => f.type).sort()).toEqual([
      "dont_say",
      "fabricated_testimonial",
      "fake_scarcity",
      "regulated_claim",
    ]);
  });

  it("doesn't flag ordinary copy or partial words", () => {
    expect(
      detectFlags("Book a free call to talk through your year-end accounts.", ["cheap"]),
    ).toEqual([]);
    expect(detectFlags("Our cheapest option", ["cheap"])).toEqual([]);
  });

  it("de-duplicates merged flags", () => {
    const a = [{ type: "fake_scarcity" as const, message: "x" }];
    expect(mergeFlags(a, a)).toHaveLength(1);
  });
});
