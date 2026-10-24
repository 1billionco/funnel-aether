import { describe, expect, it } from "vitest";

import { modelProfile } from "@/lib/ai/anthropic";
import { getLLMProvider, modelFor } from "@/lib/ai";
import { MockProvider } from "@/lib/ai/mock";
import { estimateCostUsd } from "@/lib/ai/telemetry";
import { parseEnv } from "@/lib/env";

describe("provider selection", () => {
  it("uses the mock without a key, and for demo orgs", () => {
    expect(getLLMProvider({}, parseEnv({})).isMock).toBe(true);
    expect(getLLMProvider({}, parseEnv({ ANTHROPIC_API_KEY: "sk-ant-x" })).name).toBe("anthropic");
    expect(
      getLLMProvider({ forceMock: true }, parseEnv({ ANTHROPIC_API_KEY: "sk-ant-x" })).isMock,
    ).toBe(true);
  });

  it("reads model IDs from env with spec defaults", () => {
    expect(modelFor("fast", parseEnv({}))).toBe("claude-haiku-5-5");
    expect(modelFor("smart", parseEnv({ LLM_MODEL_SMART: "custom-smart" }))).toBe("custom-smart");
  });
});

describe("model profiles", () => {
  it("never sends sampling params and configures thinking per model", () => {
    const fast = modelProfile("claude-haiku-5-5");
    expect(fast.thinking).toEqual({ type: "disabled" });
    expect(fast).not.toHaveProperty("temperature");
    const smart = modelProfile("claude-sonnet-5-5");
    expect(smart.thinking).toEqual({ type: "between_tools" });
    expect(smart.fallbacks).toBe("default");
  });
});

describe("mock provider", () => {
  it("streams the mock output deterministically with usage", async () => {
    const p = new MockProvider(0);
    const r = await p.complete({
      model: "x",
      tier: "fast",
      system: [{ text: "sys" }],
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
      mockOutput: () => "Hello brand world",
    });
    expect(r.text).toBe("Hello brand world");
    expect(r.isMock).toBe(true);
    expect(r.usage.outputTokens).toBeGreaterThan(0);
    expect(r.stopReason).toBe("end_turn");
  });

  it("stops early when aborted", async () => {
    const p = new MockProvider(5);
    const ctl = new AbortController();
    const chunks: string[] = [];
    let stop = "";
    setTimeout(() => ctl.abort(), 20);
    for await (const d of p.stream({
      model: "x",
      tier: "fast",
      system: [],
      messages: [],
      maxTokens: 10,
      signal: ctl.signal,
      mockOutput: () => "word ".repeat(200),
    })) {
      if (d.type === "text") chunks.push(d.text);
      else stop = d.stopReason;
    }
    expect(stop).toBe("aborted");
    expect(chunks.join("").length).toBeLessThan(1000);
  });
});

describe("estimateCostUsd", () => {
  const price = {
    model: "m",
    input_per_mtok: 1,
    output_per_mtok: 5,
    cache_read_per_mtok: 0.1,
    cache_write_per_mtok: 1.25,
  };
  it("prices each token bucket", () => {
    expect(
      estimateCostUsd(price, {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBeCloseTo(1);
    expect(
      estimateCostUsd(price, {
        inputTokens: 1000,
        outputTokens: 1000,
        cacheReadTokens: 10_000,
        cacheWriteTokens: 0,
      }),
    ).toBeCloseTo(0.001 + 0.005 + 0.001);
  });
  it("is 0 when the price is unknown", () => {
    expect(
      estimateCostUsd(undefined, {
        inputTokens: 5000,
        outputTokens: 5000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
  });
});
