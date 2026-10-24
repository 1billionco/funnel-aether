import { parseEnv, type Env } from "../env";
import { MockEmbeddingProvider } from "./mock";
import type { EmbeddingProvider } from "./provider";
import { VoyageEmbeddingProvider } from "./voyage";

/** Voyage when keyed, otherwise the labelled mock. Demo orgs always use the mock (§11). */
export function getEmbeddingProvider(
  opts: { forceMock?: boolean } = {},
  env: Env = parseEnv(),
): EmbeddingProvider {
  if (!opts.forceMock && env.VOYAGE_API_KEY) {
    return new VoyageEmbeddingProvider(
      env.VOYAGE_API_KEY,
      env.EMBEDDING_MODEL ?? "voyage-4-lite",
      env.EMBEDDING_DIM,
    );
  }
  return new MockEmbeddingProvider(env.EMBEDDING_DIM);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** pgvector text format. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? Number(x.toFixed(7)) : 0)).join(",")}]`;
}

export function parseVector(v: string | number[] | null | undefined): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  return JSON.parse(v) as number[];
}
