/**
 * Embedding provider abstraction. Live: Voyage (EMBEDDING_MODEL, EMBEDDING_DIM=1024).
 * Mock: deterministic hash embeddings, stored with embedding_model = "mock" so
 * they are never compared with real vectors (spec §4 brand_chunks).
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  readonly isMock: boolean;
  embed(
    texts: string[],
    inputType: "document" | "query",
  ): Promise<{
    vectors: number[][];
    totalTokens: number;
  }>;
}
