import { describe, expect, it } from "vitest";

import { chunkText, CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/brand-voice/chunker";
import { trainingQualityScore, trainingTips } from "@/lib/brand-voice/quality";

describe("chunkText", () => {
  it("keeps short text as one chunk", () => {
    expect(chunkText("Hello there.\n\nWe sell phones.")).toEqual([
      "Hello there.\n\nWe sell phones.",
    ]);
  });

  it("returns nothing for blank input", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });

  it("splits long text into chunks no bigger than the chunk size, with overlap", () => {
    const sentence = "We help small firms in Kent file tax returns on time. ";
    const text = Array.from({ length: 120 }, (_, i) => `${i}. ${sentence}`).join("");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(CHUNK_SIZE);
    // Consecutive chunks overlap: the start of chunk 2 appears near the end of chunk 1.
    const head = chunks[1]!.slice(0, 30);
    expect(chunks[0]!.slice(-CHUNK_OVERLAP - 60)).toContain(head);
  });

  it("prefers paragraph boundaries", () => {
    const para = (n: number) => `Paragraph ${n} ` + "word ".repeat(100);
    const chunks = chunkText([para(1), para(2), para(3)].join("\n\n"));
    expect(chunks[0]!.startsWith("Paragraph 1")).toBe(true);
    expect(chunks.some((c) => c.startsWith("Paragraph 2"))).toBe(true);
  });

  it("hard-splits a single enormous word", () => {
    const chunks = chunkText("x".repeat(2000));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(CHUNK_SIZE);
  });
});

describe("trainingQualityScore (ported formula)", () => {
  it("is 0 with no documents", () => {
    expect(trainingQualityScore({ documentCount: 0, chunkCount: 0, docTypes: [] })).toBe(0);
  });

  it("matches the backend formula", () => {
    // 1 type (5) + required 1/3 (6.67) + volume 2/50*30 (1.2) + count 2 = 14.87 -> 14
    expect(
      trainingQualityScore({ documentCount: 1, chunkCount: 2, docTypes: ["past_content"] }),
    ).toBe(14);
    // 3 required types (15 + 20) + 50 chunks (30) + 5 docs (10) = 75
    expect(
      trainingQualityScore({
        documentCount: 5,
        chunkCount: 50,
        docTypes: ["guidelines", "tone_examples", "past_content"],
      }),
    ).toBe(75);
  });

  it("caps at 100", () => {
    const all = [
      "guidelines",
      "tone_examples",
      "past_content",
      "website_copy",
      "social_posts",
      "email_templates",
      "ad_copy",
      "blog_posts",
    ];
    expect(trainingQualityScore({ documentCount: 20, chunkCount: 500, docTypes: all })).toBe(100);
  });

  it("rises with each added document (regression: counts must be fresh)", () => {
    const one = trainingQualityScore({
      documentCount: 1,
      chunkCount: 3,
      docTypes: ["past_content"],
    });
    const two = trainingQualityScore({
      documentCount: 2,
      chunkCount: 6,
      docTypes: ["past_content", "tone_examples"],
    });
    expect(two).toBeGreaterThan(one);
  });
});

describe("trainingTips", () => {
  it("asks for samples first", () => {
    expect(
      trainingTips({ documentCount: 0, chunkCount: 0, docTypes: [] }, { audience: "x" })[0],
    ).toMatch(/Add 3 past posts/);
  });
  it("suggests missing required types", () => {
    const tips = trainingTips(
      { documentCount: 1, chunkCount: 40, docTypes: ["past_content"] },
      { audience: "x" },
    );
    expect(tips.join(" ")).toMatch(/brand guidelines/);
    expect(tips.length).toBeLessThanOrEqual(3);
  });
});
