/**
 * LLM provider abstraction (spec §6.1). Implementations: anthropic, mock
 * (gemini is an optional fallback, added when GEMINI_API_KEY is configured).
 * Model IDs come from env (LLM_MODEL_FAST / LLM_MODEL_SMART), never hard-coded.
 */
export type ModelTier = "fast" | "smart";

export interface GenMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SystemBlock {
  text: string;
  /** Stable per brand: marked for prompt caching when long enough (§6.6). */
  cacheable?: boolean;
}

export interface GenRequest {
  model: string;
  tier: ModelTier;
  system: SystemBlock[];
  messages: GenMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  /** Text the mock provider returns (deterministic). Ignored by real providers. */
  mockOutput?: () => string;
}

export interface GenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type StopReason = "end_turn" | "max_tokens" | "refusal" | "aborted" | "other";

export type Delta =
  | { type: "text"; text: string }
  | { type: "done"; usage: GenUsage; stopReason: StopReason; model: string };

export interface GenResult {
  text: string;
  usage: GenUsage;
  stopReason: StopReason;
  model: string;
  isMock: boolean;
}

export interface LLMProvider {
  readonly name: "anthropic" | "gemini" | "mock";
  readonly isMock: boolean;
  stream(req: GenRequest): AsyncIterable<Delta>;
  complete(req: GenRequest): Promise<GenResult>;
}

export const EMPTY_USAGE: GenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/** Collects a stream into a result (shared by providers' complete()). */
export async function collect(
  stream: AsyncIterable<Delta>,
  isMock: boolean,
  model: string,
): Promise<GenResult> {
  let text = "";
  let usage = EMPTY_USAGE;
  let stopReason: StopReason = "other";
  let servedBy = model;
  for await (const d of stream) {
    if (d.type === "text") text += d.text;
    else {
      usage = d.usage;
      stopReason = d.stopReason;
      servedBy = d.model;
    }
  }
  return { text, usage, stopReason, model: servedBy, isMock };
}
