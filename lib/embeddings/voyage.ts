import type { EmbeddingProvider } from "./provider";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const BATCH = 64;

/** Voyage AI embeddings over REST (spec §3: voyage-4-lite, output_dimension 1024). */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly isMock = false;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[], inputType: "document" | "query") {
    const vectors: number[][] = [];
    let totalTokens = 0;
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          input: batch,
          model: this.model,
          input_type: inputType,
          output_dimension: this.dimensions,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        throw new Error(
          `Voyage embeddings failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
        );
      }
      const json = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
        usage?: { total_tokens?: number };
      };
      for (const d of [...json.data].sort((a, b) => a.index - b.index)) vectors.push(d.embedding);
      totalTokens += json.usage?.total_tokens ?? 0;
    }
    return { vectors, totalTokens };
  }
}
