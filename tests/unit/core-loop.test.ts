import { describe, expect, it } from "vitest";

import { coreLoop, type CoreLoopInput } from "@/lib/core-loop";

const base: CoreLoopInput = {
  brandProfileDone: false,
  brandTrained: false,
  draftsGenerated: 0,
  draftsApproved: 0,
  pendingDrafts: 0,
  leads: 0,
  campaignSends: 0,
};

describe("coreLoop", () => {
  it("starts with the brand", () => {
    expect(coreLoop(base).next?.id).toBe("brand");
  });

  it("puts waiting approvals first", () => {
    const r = coreLoop({ ...base, brandProfileDone: true, draftsGenerated: 2, pendingDrafts: 2 });
    expect(r.next?.id).toBe("approve");
  });

  it("skips steps that aren't available yet", () => {
    const r = coreLoop({ ...base, brandProfileDone: true }, { train: false, draft: false });
    expect(r.next?.id).toBe("approve");
  });

  it("is complete when every step is done", () => {
    const r = coreLoop({
      brandProfileDone: true,
      brandTrained: true,
      draftsGenerated: 1,
      draftsApproved: 1,
      pendingDrafts: 0,
      leads: 1,
      campaignSends: 1,
    });
    expect(r.complete).toBe(true);
    expect(r.next).toBeNull();
    expect(r.done).toBe(6);
  });
});
