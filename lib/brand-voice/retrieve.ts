import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";
import { getEmbeddingProvider, toVectorLiteral } from "../embeddings";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
}

const words = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9£₦']{3,}/g) ?? []);

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Maximal marginal relevance over the candidates (spec §6.3: k=6, MMR to
 * diversify). Relevance is the DB cosine similarity; redundancy is word
 * overlap between chunks, which avoids shipping 20×1024 floats back from
 * Postgres just to de-duplicate (DECISIONS D-022).
 */
export function mmr(candidates: RetrievedChunk[], k = 6, lambda = 0.7): RetrievedChunk[] {
  const pool = candidates.map((c) => ({ c, w: words(c.content) }));
  const picked: typeof pool = [];
  while (picked.length < k && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((p, i) => {
      const redundancy = picked.length ? Math.max(...picked.map((q) => jaccard(p.w, q.w))) : 0;
      const score = lambda * p.c.similarity - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    picked.push(pool.splice(best, 1)[0]!);
  }
  return picked.map((p) => p.c);
}

/** Top brand chunks for a query, filtered to the current embedding model. */
export async function retrieveBrandChunks(
  db: SupabaseClient<Database>,
  opts: { brandId: string; query: string; k?: number; forceMock?: boolean },
): Promise<{ chunks: RetrievedChunk[]; model: string; queryTokens: number; isMock: boolean }> {
  const embedder = getEmbeddingProvider({ forceMock: opts.forceMock });
  const { vectors, totalTokens } = await embedder.embed([opts.query], "query");
  const { data, error } = await db.rpc("match_brand_chunks", {
    p_brand: opts.brandId,
    p_query: toVectorLiteral(vectors[0]!),
    p_model: embedder.model,
    p_k: 20,
  });
  if (error) throw error;
  const candidates = (data ?? []).map((r) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    similarity: r.similarity,
  }));
  return {
    chunks: mmr(candidates, opts.k ?? 6),
    model: embedder.model,
    queryTokens: totalTokens,
    isMock: embedder.isMock,
  };
}
