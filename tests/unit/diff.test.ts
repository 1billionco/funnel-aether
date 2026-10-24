import { describe, expect, it } from "vitest";

import { wordDiff } from "@/lib/diff";

describe("wordDiff", () => {
  it("marks added and removed words", () => {
    const parts = wordDiff("Book a free call today", "Book a quick free call");
    expect(parts.filter((p) => p.type === "add").map((p) => p.text.trim())).toContain("quick");
    expect(parts.filter((p) => p.type === "del").map((p) => p.text.trim())).toContain("today");
    expect(
      parts
        .filter((p) => p.type !== "del")
        .map((p) => p.text)
        .join(""),
    ).toBe("Book a quick free call");
  });
  it("returns a single same-part for identical text", () => {
    expect(wordDiff("same text", "same text")).toEqual([{ type: "same", text: "same text" }]);
  });
});
