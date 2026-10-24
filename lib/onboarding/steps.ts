/**
 * Onboarding wizard (spec §7.4 #10): ≤5 minutes, progress bar, skippable.
 * Step 1 (business + market) happens at /onboarding before the org exists;
 * the rest live at /{org}/setup/{step}.
 */
export const SETUP_STEPS = [
  { id: "brand", title: "Your brand", skippable: false },
  { id: "samples", title: "Examples of your writing", skippable: true },
  { id: "summary", title: "Your brand summary", skippable: true },
  { id: "first-draft", title: "Your first draft", skippable: true },
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number]["id"];
export const TOTAL_ONBOARDING_STEPS = SETUP_STEPS.length + 1;

export function stepIndex(id: string): number {
  return SETUP_STEPS.findIndex((s) => s.id === id);
}

export function nextStep(id: SetupStepId): SetupStepId | null {
  const i = stepIndex(id);
  return SETUP_STEPS[i + 1]?.id ?? null;
}

/** 0–100 for the progress bar; step 1 (create business) is already done here. */
export function progressFor(id: SetupStepId): number {
  return Math.round(((stepIndex(id) + 1) / TOTAL_ONBOARDING_STEPS) * 100);
}
