/**
 * Training-quality score (0–100) and recommendations, ported from the
 * original backend's BrandVoiceService._calculate_quality_score:
 *   type diversity  min(40, types × 5)
 *   required types  (present / 3) × 20      guidelines, tone_examples, past_content
 *   content volume  min(30, chunks / 50 × 30)
 *   document count  min(10, docs × 2)
 * Inputs must be fresh counts from the database (brand_document_stats), which
 * is what fixes the old stale-count bug.
 */
export const DOC_TYPES = [
  "guidelines",
  "tone_examples",
  "past_content",
  "website_copy",
  "social_posts",
  "email_templates",
  "ad_copy",
  "blog_posts",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const REQUIRED_DOC_TYPES: DocType[] = ["guidelines", "tone_examples", "past_content"];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  guidelines: "Brand guidelines",
  tone_examples: "Examples of your tone",
  past_content: "Past posts or messages",
  website_copy: "Website text",
  social_posts: "Social media posts",
  email_templates: "Emails",
  ad_copy: "Adverts",
  blog_posts: "Blog posts",
};

export interface BrandStats {
  documentCount: number;
  chunkCount: number;
  docTypes: string[];
}

export function trainingQualityScore(stats: BrandStats): number {
  if (stats.documentCount === 0) return 0;
  const types = new Set(stats.docTypes);
  const diversity = Math.min(40, types.size * 5);
  const required =
    (REQUIRED_DOC_TYPES.filter((t) => types.has(t)).length / REQUIRED_DOC_TYPES.length) * 20;
  const volume = Math.min(30, (stats.chunkCount / 50) * 30);
  const count = Math.min(10, stats.documentCount * 2);
  return Math.min(100, Math.floor(diversity + required + volume + count));
}

/** Up to three plain-English tips, required types first (backend _get_training_recommendations). */
export function trainingTips(
  stats: BrandStats,
  brand: { audience?: string | null; offer?: string | null },
): string[] {
  const types = new Set(stats.docTypes);
  const tips: string[] = [];
  if (stats.documentCount === 0)
    tips.push("Add 3 past posts, emails or messages so drafts sound like you.");
  const missing = [
    ...REQUIRED_DOC_TYPES,
    ...DOC_TYPES.filter((t) => !REQUIRED_DOC_TYPES.includes(t)),
  ].filter((t) => !types.has(t));
  for (const t of missing.slice(0, stats.documentCount === 0 ? 1 : 2)) {
    tips.push(`Add ${DOC_TYPE_LABELS[t].toLowerCase()} to lift your score.`);
  }
  if (stats.documentCount > 0 && stats.chunkCount < 30)
    tips.push("Upload a little more writing; longer samples help the AI.");
  if (!brand.audience) tips.push("Describe who your customers are.");
  return Array.from(new Set(tips)).slice(0, 3);
}
