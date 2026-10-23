import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("keeps custom colour tokens distinct from font sizes", () => {
    expect(cn("text-sm text-ink", "text-muted")).toBe("text-sm text-muted");
  });
});
