import { can, type PlanSubject } from "../credits/plans";
import { OUTPUT_TYPES, type OutputType } from "./output-types";
import type { ModelTier } from "./provider";

/**
 * Model router: a financial control, not a feature (spec §6.2).
 * Free plan → fast, always. Paid → fast by default; smart only for long-form
 * output, or a regenerate-with-feedback after a fast attempt, or (one
 * escalation, background path only) a low brand-match score.
 */
export type RouterReason =
  | "free_plan"
  | "plan_no_smart"
  | "default_fast"
  | "long_form"
  | "regen_after_fast"
  | "low_brand_match"
  | "demo_mock";

export interface RouteInput {
  org: PlanSubject;
  outputType: OutputType;
  /** Regenerate-with-feedback where the previous attempt used the fast model. */
  regenerateAfterFast?: boolean;
}

export function chooseTier(input: RouteInput): { tier: ModelTier; reason: RouterReason } {
  if (input.org.plan === "free") return { tier: "fast", reason: "free_plan" };
  if (!can(input.org, "smart_model")) return { tier: "fast", reason: "plan_no_smart" };
  if (OUTPUT_TYPES[input.outputType].longForm) return { tier: "smart", reason: "long_form" };
  if (input.regenerateAfterFast) return { tier: "smart", reason: "regen_after_fast" };
  return { tier: "fast", reason: "default_fast" };
}

export const BRAND_MATCH_ESCALATION_THRESHOLD = 60;

/** Max one escalation per request; never for free/plans without the smart model. */
export function shouldEscalate(input: {
  org: PlanSubject;
  tier: ModelTier;
  alreadyEscalated: boolean;
  brandMatch: number | null;
}): boolean {
  return (
    input.org.plan !== "free" &&
    can(input.org, "smart_model") &&
    input.tier === "fast" &&
    !input.alreadyEscalated &&
    input.brandMatch !== null &&
    input.brandMatch < BRAND_MATCH_ESCALATION_THRESHOLD
  );
}
