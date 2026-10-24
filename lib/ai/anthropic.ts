import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import {
  collect,
  EMPTY_USAGE,
  type Delta,
  type GenRequest,
  type LLMProvider,
  type StopReason,
} from "./provider";

/** Prompt caching only applies above the model's minimum prefix (512 tokens on current models). */
const MIN_CACHEABLE_CHARS = 512 * 4;

/**
 * Per-model request shape. Short marketing copy doesn't benefit from extended
 * thinking, so we turn it off where the model allows and keep effort low;
 * the router decides which tier runs (spec §6.2).
 */
export function modelProfile(model: string): Pick<
  BetaMessageStreamParams,
  "thinking" | "output_config"
> & {
  fallbacks?: BetaMessageStreamParams["fallbacks"];
  betas?: string[];
} {
  if (/haiku-5/.test(model)) {
    // Haiku 5.5: thinking can be disabled at effort high or below.
    return { thinking: { type: "disabled" }, output_config: { effort: "low" } };
  }
  if (/sonnet-5-5/.test(model)) {
    // Sonnet 5.5: "disabled" is rejected; between_tools turns thinking off (effort ≤ high).
    // Server-side refusal fallback is on by default for this model on the Claude API.
    return {
      thinking: { type: "between_tools" },
      output_config: { effort: "medium" },
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    };
  }
  // Unknown/other models: let the API defaults apply, with modest effort.
  return { output_config: { effort: "medium" } };
}

function mapStop(reason: string | null | undefined): StopReason {
  if (reason === "end_turn" || reason === "stop_sequence") return "end_turn";
  if (reason === "max_tokens") return "max_tokens";
  if (reason === "refusal") return "refusal";
  return "other";
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly isMock = false;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  }

  async *stream(req: GenRequest): AsyncIterable<Delta> {
    const profile = modelProfile(req.model);
    const system = req.system.map((b) => ({
      type: "text" as const,
      text: b.text,
      ...(b.cacheable && b.text.length >= MIN_CACHEABLE_CHARS
        ? { cache_control: { type: "ephemeral" as const } }
        : {}),
    }));

    const stream = this.client.beta.messages.stream(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        system,
        messages: req.messages,
        ...profile,
      },
      { signal: req.signal },
    );

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      yield {
        type: "done",
        model: final.model,
        stopReason: mapStop(final.stop_reason),
        usage: {
          inputTokens: final.usage.input_tokens ?? 0,
          outputTokens: final.usage.output_tokens ?? 0,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (error) {
      if (req.signal?.aborted) {
        // Deadline hit: report what we know so the caller can save a partial draft.
        const snapshot = stream.currentMessage;
        yield {
          type: "done",
          model: req.model,
          stopReason: "aborted",
          usage: snapshot
            ? {
                inputTokens: snapshot.usage.input_tokens ?? 0,
                outputTokens: snapshot.usage.output_tokens ?? 0,
                cacheReadTokens: snapshot.usage.cache_read_input_tokens ?? 0,
                cacheWriteTokens: snapshot.usage.cache_creation_input_tokens ?? 0,
              }
            : EMPTY_USAGE,
        };
        return;
      }
      throw error;
    }
  }

  complete(req: GenRequest) {
    return collect(this.stream(req), false, req.model);
  }
}
