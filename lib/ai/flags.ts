import type { DraftFlag } from "./output-parser";

/**
 * Rule-based safety net for the model's own flags (spec §6.5): fabricated
 * testimonials, fake scarcity, regulated claims, and the brand's banned words.
 * Flags are shown before approval; they never block the human from deciding.
 */
const RULES: { type: DraftFlag["type"]; pattern: RegExp; message: string }[] = [
  {
    type: "fake_scarcity",
    pattern:
      /\bonly \d+ (?:left|remaining|spots?|places?)\b|\b(?:ends|ending) (?:tonight|today|at midnight)\b|\blast chance\b|\bwhile stocks? last\b/i,
    message: "Mentions limited stock or a deadline. Check it's true before approving.",
  },
  {
    type: "fabricated_testimonial",
    pattern:
      /[“"][^”"]{10,}[”"]\s*[—–-]\s*[A-Z][a-z]+|\b\d(?:\.\d)?\s*(?:stars?|★)|\brated \d|\btestimonial\b|\bour customers say\b/i,
    message: "Looks like a quote or review. Only use real customer words, with permission.",
  },
  {
    type: "regulated_claim",
    pattern:
      /\bguaranteed? (?:returns?|profit|income|savings?|results?)\b|\brisk[- ]free\b|\bdouble your money\b|\b(?:cures?|treats?|heals?) (?:\w+ )?(?:disease|diabetes|cancer|pain)\b|\blose \d+\s?(?:kg|lbs?|pounds)\b|\b100% (?:safe|guaranteed)\b/i,
    message: "Makes a financial or health promise. These are regulated, so check the wording.",
  },
];

export function detectFlags(text: string, dontSay: string[]): DraftFlag[] {
  const flags: DraftFlag[] = [];
  for (const r of RULES) if (r.pattern.test(text)) flags.push({ type: r.type, message: r.message });
  for (const word of dontSay) {
    const w = word.trim();
    if (
      w &&
      new RegExp(
        `(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`,
        "iu",
      ).test(text)
    ) {
      flags.push({ type: "dont_say", message: `Uses "${w}", which is on your avoid list.` });
    }
  }
  return flags;
}

export function mergeFlags(...lists: (DraftFlag[] | undefined)[]): DraftFlag[] {
  const seen = new Set<string>();
  const out: DraftFlag[] = [];
  for (const f of lists.flat()) {
    if (!f) continue;
    const key = f.type === "other" ? f.message : f.type === "dont_say" ? f.message : f.type;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out.slice(0, 6);
}
