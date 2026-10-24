import { collect, type Delta, type GenRequest, type LLMProvider } from "./provider";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic template generator used when no API key is configured and
 * for demo orgs (spec §3, §11). Output comes from the request's mockOutput()
 * builder; responses are flagged is_mock and cost nothing.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock" as const;
  readonly isMock = true;
  constructor(private readonly delayMs = Number(process.env.MOCK_STREAM_DELAY_MS ?? 12)) {}

  async *stream(req: GenRequest): AsyncIterable<Delta> {
    const text =
      req.mockOutput?.() ??
      "This is a mock response. Add ANTHROPIC_API_KEY to generate real drafts.";
    const words = text.split(/(\s+)/);
    let emitted = 0;
    for (const w of words) {
      if (req.signal?.aborted) {
        yield { type: "done", model: "mock", stopReason: "aborted", usage: usageFor(req, emitted) };
        return;
      }
      emitted += w.length;
      yield { type: "text", text: w };
      if (this.delayMs > 0 && w.trim()) await sleep(this.delayMs);
    }
    yield {
      type: "done",
      model: "mock",
      stopReason: "end_turn",
      usage: usageFor(req, text.length),
    };
  }

  complete(req: GenRequest) {
    return collect(this.stream(req), true, "mock");
  }
}

function usageFor(req: GenRequest, outputChars: number) {
  const inputChars =
    req.system.reduce((s, b) => s + b.text.length, 0) +
    req.messages.reduce((s, m) => s + m.content.length, 0);
  return {
    inputTokens: Math.ceil(inputChars / 4),
    outputTokens: Math.ceil(outputChars / 4),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}
