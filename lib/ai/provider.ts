/**
 * LLM provider abstraction (spec §6.1). Implementations: anthropic, gemini, mock (M3).
 * Model IDs come from env (LLM_MODEL_FAST / LLM_MODEL_SMART), never hard-coded.
 */
export type ModelTier = "fast" | "smart";

export interface GenMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenRequest {
  model: string;
  tier: ModelTier;
  /** Stable layers (role/safety + brand block) — cacheable when long enough (§6.6). */
  system: { text: string; cacheable?: boolean }[];
  messages: GenMessage[];
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface GenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type Delta =
  { type: "text"; text: string } | { type: "done"; usage: GenUsage; stopReason: string };

export interface GenResult {
  text: string;
  usage: GenUsage;
  stopReason: string;
  model: string;
  isMock: boolean;
}

export interface LLMProvider {
  readonly name: "anthropic" | "gemini" | "mock";
  readonly isMock: boolean;
  stream(req: GenRequest): AsyncIterable<Delta>;
  complete(req: GenRequest): Promise<GenResult>;
}
