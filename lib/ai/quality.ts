import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";
import { cosine, getEmbeddingProvider, parseVector, toVectorLiteral } from "../embeddings";
import { CHANNEL_LIMITS, type Channel } from "./output-types";

/**
 * Brand-match score (spec §6.4): semantic similarity of the draft to the
 * brand's samples (centroid + nearest chunks) plus rule checks (avoided
 * words, length for the channel, call to action). 0–100 with 2–3 reasons.
 * The original backend's alignment scorer wasn't in the repo (D-012), so the
 * weights here are documented in DECISIONS D-026 and tunable.
 */
export interface BrandMatchInput {
  /** 0–1 similarity, or null when the brand has no samples yet. */
  semantic: number | null;
  text: string;
  channel: Channel;
  market: "UK" | "NG";
  brand: {
    dont_say: string[];
    do_say: string[];
    example_ctas: string[];
    whatsapp_number?: string | null;
  };
}

export interface BrandMatch {
  score: number;
  reasons: { positive: boolean; text: string }[];
}

const CTA =
  /\b(book|call|contact|message|whatsapp|reply|order|buy|shop|visit|sign up|register|download|get in touch|learn more|find out|dm|send us|chat|enquire|subscribe|join|claim|reserve)\b/i;
const US_SPELLING = /\b(color|organize|organization|favorite|center|analyze|realize|behavior)\b/i;

export function scoreBrandMatch(i: BrandMatchInput): BrandMatch {
  const reasons: { positive: boolean; text: string; weight: number }[] = [];
  let score = 0;

  if (i.semantic === null) {
    score += 40;
    reasons.push({ positive: false, text: "Add writing samples for a sharper match", weight: 1 });
  } else {
    const s = Math.max(0, Math.min(1, i.semantic));
    score += Math.round(s * 70);
    if (s >= 0.6)
      reasons.push({ positive: true, text: "Sounds like your past writing", weight: 3 });
    else if (s < 0.35)
      reasons.push({ positive: false, text: "Reads differently from your samples", weight: 3 });
  }

  const hasCta =
    CTA.test(i.text) ||
    i.brand.example_ctas.some((c) => c && i.text.toLowerCase().includes(c.toLowerCase()));
  if (hasCta) {
    score += 15;
    reasons.push({ positive: true, text: "Has a clear call to action", weight: 2 });
  } else reasons.push({ positive: false, text: "No clear call to action", weight: 2 });

  const limit = CHANNEL_LIMITS[i.channel];
  if (i.text.length <= limit) score += 10;
  else
    reasons.push({
      positive: false,
      text: `Too long for ${i.channel === "x" ? "X" : i.channel} (${i.text.length}/${limit} characters)`,
      weight: 4,
    });

  const lower = i.text.toLowerCase();
  if (i.brand.do_say.some((w) => w && lower.includes(w.toLowerCase()))) {
    score += 5;
    reasons.push({ positive: true, text: "Uses your favourite phrases", weight: 1 });
  }

  const banned = i.brand.dont_say.filter(
    (w) =>
      w &&
      new RegExp(
        `(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`,
        "iu",
      ).test(i.text),
  );
  if (banned.length) {
    score -= Math.min(30, banned.length * 15);
    reasons.push({
      positive: false,
      text: `Uses ${banned.map((w) => `"${w}"`).join(", ")}, which you avoid`,
      weight: 5,
    });
  }

  if (i.market === "UK" && US_SPELLING.test(i.text)) {
    score -= 5;
    reasons.push({ positive: false, text: "Uses American spelling", weight: 2 });
  }

  // Most important first: problems, then strengths.
  const top = reasons.sort((a, b) => b.weight - a.weight).slice(0, 3);
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: top.map(({ positive, text }) => ({ positive, text })),
  };
}

/** Maps raw cosine similarity onto 0–1 per embedder (mock vectors are sparser). */
export function normaliseSimilarity(raw: number, isMock: boolean): number {
  const [lo, hi] = isMock ? [0.02, 0.4] : [0.3, 0.8];
  return Math.max(0, Math.min(1, (raw - lo) / (hi - lo)));
}

export async function computeBrandMatch(
  db: SupabaseClient<Database>,
  input: Omit<BrandMatchInput, "semantic"> & {
    brandId: string;
    documentCount: number;
    forceMock?: boolean;
  },
): Promise<BrandMatch & { embedTokens: number; model: string; isMock: boolean }> {
  const embedder = getEmbeddingProvider({ forceMock: input.forceMock });
  if (input.documentCount === 0 || !input.text.trim()) {
    return {
      ...scoreBrandMatch({ ...input, semantic: null }),
      embedTokens: 0,
      model: embedder.model,
      isMock: embedder.isMock,
    };
  }
  const { vectors, totalTokens } = await embedder.embed([input.text.slice(0, 8000)], "document");
  const v = vectors[0]!;
  const [{ data: centroidRaw }, { data: nearest }] = await Promise.all([
    db.rpc("brand_centroid", { p_brand: input.brandId, p_model: embedder.model }),
    db.rpc("match_brand_chunks", {
      p_brand: input.brandId,
      p_query: toVectorLiteral(v),
      p_model: embedder.model,
      p_k: 3,
    }),
  ]);
  const centroid = parseVector(centroidRaw as string | null);
  if (!centroid || !nearest?.length) {
    return {
      ...scoreBrandMatch({ ...input, semantic: null }),
      embedTokens: totalTokens,
      model: embedder.model,
      isMock: embedder.isMock,
    };
  }
  const raw = 0.5 * cosine(v, centroid) + 0.5 * Math.max(...nearest.map((n) => n.similarity));
  return {
    ...scoreBrandMatch({ ...input, semantic: normaliseSimilarity(raw, embedder.isMock) }),
    embedTokens: totalTokens,
    model: embedder.model,
    isMock: embedder.isMock,
  };
}
