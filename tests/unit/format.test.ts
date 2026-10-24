import { describe, expect, it } from "vitest";

import { formatCredits, formatMoney, greeting } from "@/lib/format";

describe("format", () => {
  it("formats org currency", () => {
    expect(formatMoney(29, "GBP")).toBe("£29");
    expect(formatMoney(15000, "NGN")).toBe("₦15,000");
  });

  it("greets in the org's timezone", () => {
    const t = new Date("2026-10-24T07:30:00Z");
    expect(greeting("Europe/London", t)).toBe("Good morning"); // 08:30 BST
    expect(greeting("Asia/Tokyo", t)).toBe("Good afternoon"); // 16:30
  });

  it("shows credits to one decimal, never rounding up", () => {
    expect(formatCredits(15000)).toBe("15.0");
    expect(formatCredits(2499)).toBe("2.4");
    expect(formatCredits(250)).toBe("0.2");
  });
});
