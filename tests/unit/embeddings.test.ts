import { describe, expect, it } from "vitest";

import { cosine, getEmbeddingProvider, toVectorLiteral } from "@/lib/embeddings";
import { mockEmbed } from "@/lib/embeddings/mock";
import { parseEnv } from "@/lib/env";

describe("mock embeddings", () => {
  it("are deterministic, unit length and 1024-d", () => {
    const a = mockEmbed("Phones and TVs delivered across Lagos");
    expect(a).toHaveLength(1024);
    expect(a).toEqual(mockEmbed("Phones and TVs delivered across Lagos"));
    expect(Math.sqrt(a.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 6);
  });

  it("rank related text above unrelated text", () => {
    const q = mockEmbed("tax return deadline for small business");
    const related = mockEmbed(
      "Don't miss the self assessment tax return deadline, small business owners",
    );
    const unrelated = mockEmbed("Weekend promo on Samsung phones and fridges in Lagos");
    expect(cosine(q, related)).toBeGreaterThan(cosine(q, unrelated));
  });
});

describe("provider selection", () => {
  it("uses the mock without a Voyage key and Voyage with one", () => {
    expect(getEmbeddingProvider({}, parseEnv({})).model).toBe("mock");
    const live = getEmbeddingProvider({}, parseEnv({ VOYAGE_API_KEY: "k" }));
    expect(live.model).toBe("voyage-4-lite");
    expect(live.isMock).toBe(false);
    expect(
      getEmbeddingProvider({ forceMock: true }, parseEnv({ VOYAGE_API_KEY: "k" })).isMock,
    ).toBe(true);
  });
});

describe("toVectorLiteral", () => {
  it("formats pgvector text", () => {
    expect(toVectorLiteral([0.5, -1, NaN])).toBe("[0.5,-1,0]");
  });
});
