import type { EmbeddingProvider } from "./provider";

/**
 * Deterministic hashed bag-of-words embeddings for local dev and tests.
 * Clearly labelled: stored with embedding_model = "mock" and never compared
 * with real vectors. Texts sharing words get similar vectors, so retrieval
 * and brand-match scoring behave sensibly offline.
 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "are",
  "we",
  "you",
  "our",
  "your",
  "it",
  "with",
  "at",
  "be",
  "this",
  "that",
]);

export function mockEmbed(text: string, dimensions = 1024): number[] {
  const v = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9£₦']+/g) ?? [];
  const tokens = words.filter((w) => !STOP.has(w));
  const features = [...tokens, ...tokens.slice(1).map((w, i) => `${tokens[i]}_${w}`)];
  for (const f of features) {
    const h = fnv1a(f);
    v[h % dimensions]! += (h & 0x80000000 ? -1 : 1) * (f.includes("_") ? 0.5 : 1);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) {
    v[0] = 1;
    return v;
  }
  return v.map((x) => x / norm);
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly model = "mock";
  readonly isMock = true;
  constructor(readonly dimensions = 1024) {}
  async embed(texts: string[]) {
    return {
      vectors: texts.map((t) => mockEmbed(t, this.dimensions)),
      totalTokens: texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
    };
  }
}
