import { parseEnv, type Env } from "../env";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LLMProvider, ModelTier } from "./provider";

/** Mock when no key (or demo org); otherwise Anthropic (spec §6.1). */
export function getLLMProvider(
  opts: { forceMock?: boolean } = {},
  env: Env = parseEnv(),
): LLMProvider {
  if (!opts.forceMock && env.ANTHROPIC_API_KEY) return new AnthropicProvider(env.ANTHROPIC_API_KEY);
  return new MockProvider();
}

/** Model IDs live in env; defaults are the spec's suggestions (verified Oct 2026). */
export function modelFor(tier: ModelTier, env: Env = parseEnv()): string {
  return tier === "smart"
    ? (env.LLM_MODEL_SMART ?? "claude-sonnet-5-5")
    : (env.LLM_MODEL_FAST ?? "claude-haiku-5-5");
}
