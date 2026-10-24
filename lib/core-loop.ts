/**
 * The core loop validation measures (spec §1):
 * Sign up → Onboard brand → First AI draft → Approve → Capture first lead → Send first campaign.
 * Pure function so Today's "Next best step" and checklist are unit-testable.
 */
export interface CoreLoopInput {
  brandProfileDone: boolean;
  brandTrained: boolean;
  draftsGenerated: number;
  draftsApproved: number;
  pendingDrafts: number;
  leads: number;
  campaignSends: number;
}

export type CoreStepId = "brand" | "train" | "draft" | "approve" | "lead" | "campaign";

export interface CoreStep {
  id: CoreStepId;
  label: string;
  done: boolean;
  /** Path under /{org}. */
  href: string;
  cta: string;
  available: boolean;
}

export function coreLoop(
  input: CoreLoopInput,
  available: Partial<Record<CoreStepId, boolean>> = {},
) {
  const steps: CoreStep[] = [
    {
      id: "brand",
      label: "Describe your brand",
      done: input.brandProfileDone,
      href: "brand",
      cta: "Describe your brand",
      available: true,
    },
    {
      id: "train",
      label: "Add examples of your writing",
      done: input.brandTrained,
      href: "brand",
      cta: "Add writing samples",
      available: available.train ?? true,
    },
    {
      id: "draft",
      label: "Get your first AI draft",
      done: input.draftsGenerated > 0,
      href: "create",
      cta: "Create your first draft",
      available: available.draft ?? true,
    },
    {
      id: "approve",
      label: "Approve a draft",
      done: input.draftsApproved > 0,
      href: "review",
      cta: "Approve your first draft",
      available: available.approve ?? true,
    },
    {
      id: "lead",
      label: "Capture your first lead",
      done: input.leads > 0,
      href: "leads",
      cta: "Set up a lead form",
      available: available.lead ?? true,
    },
    {
      id: "campaign",
      label: "Send your first campaign",
      done: input.campaignSends > 0,
      href: "campaigns",
      cta: "Start a campaign",
      available: available.campaign ?? true,
    },
  ];
  // Waiting drafts always come first: a human decision is the most valuable next step.
  const approveStep = steps.find((s) => s.id === "approve")!;
  const next =
    input.pendingDrafts > 0 && approveStep.available
      ? approveStep
      : (steps.find((s) => !s.done && s.available) ?? null);
  const done = steps.filter((s) => s.done).length;
  return { steps, next, done, total: steps.length, complete: done === steps.length };
}
