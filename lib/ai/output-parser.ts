/**
 * Output contract for generation (spec §6.3): the model streams the body
 * (variants separated by VARIANT_MARK), then META_MARK and a JSON object with
 * the structured fields. Only text before META_MARK is streamed to the user.
 */
export const VARIANT_MARK = "===VARIANT===";
export const META_MARK = "===META===";

export interface DraftFlag {
  type: "fabricated_testimonial" | "fake_scarcity" | "regulated_claim" | "dont_say" | "other";
  message: string;
}

export interface ParsedMeta {
  title?: string;
  subject?: string;
  preheader?: string;
  hashtags?: string[];
  cta?: string;
  flags?: DraftFlag[];
}

export interface ParsedOutput {
  variants: string[];
  meta: ParsedMeta;
  metaValid: boolean;
}

/** The visible part of a partial stream (everything before META), for live display. */
export function visibleText(raw: string): string {
  const i = raw.indexOf(META_MARK);
  let text = i >= 0 ? raw.slice(0, i) : raw;
  // Hide a META marker that is still arriving ("===ME").
  const partial = META_MARK.split("").findIndex((_, n) =>
    text.endsWith(META_MARK.slice(0, META_MARK.length - n)),
  );
  if (partial >= 0 && partial < META_MARK.length - 2)
    text = text.slice(0, text.length - (META_MARK.length - partial));
  return text;
}

export function splitVariants(text: string): string[] {
  return text
    .split(VARIANT_MARK)
    .map((v) => v.trim())
    .filter(Boolean);
}

const FLAG_TYPES = new Set([
  "fabricated_testimonial",
  "fake_scarcity",
  "regulated_claim",
  "dont_say",
  "other",
]);

export function parseOutput(raw: string): ParsedOutput {
  const i = raw.indexOf(META_MARK);
  const body = i >= 0 ? raw.slice(0, i) : raw;
  const variants = splitVariants(body);
  let meta: ParsedMeta = {};
  let metaValid = false;
  if (i >= 0) {
    const json = raw
      .slice(i + META_MARK.length)
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const start = json.indexOf("{");
    const end = json.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const obj = JSON.parse(json.slice(start, end + 1)) as Record<string, unknown>;
        const str = (v: unknown, max = 300) =>
          typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
        meta = {
          title: str(obj.title, 200),
          subject: str(obj.subject, 150),
          preheader: str(obj.preheader, 200),
          cta: str(obj.cta, 200),
          hashtags: Array.isArray(obj.hashtags)
            ? obj.hashtags
                .filter((h): h is string => typeof h === "string")
                .map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""))
                .slice(0, 15)
            : undefined,
          flags: Array.isArray(obj.flags)
            ? obj.flags
                .map((f) => {
                  if (typeof f === "string")
                    return { type: "other" as const, message: f.slice(0, 300) };
                  const o = f as Record<string, unknown>;
                  const type = FLAG_TYPES.has(String(o.type))
                    ? (String(o.type) as DraftFlag["type"])
                    : "other";
                  return typeof o.message === "string"
                    ? { type, message: o.message.slice(0, 300) }
                    : null;
                })
                .filter((f): f is DraftFlag => !!f)
                .slice(0, 5)
            : undefined,
        };
        metaValid = true;
      } catch {
        metaValid = false;
      }
    }
  }
  return { variants: variants.length ? variants : [body.trim()].filter(Boolean), meta, metaValid };
}
