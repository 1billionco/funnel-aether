import { z } from "zod";

export const marketSchema = z.enum(["UK", "NG"], {
  message: "Choose where your business is based.",
});

export const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name.").max(120),
  market: marketSchema,
  industry: z.string().trim().max(120).optional(),
});

/** Comma or newline separated list → trimmed, de-duplicated array. */
export const listField = (max = 20, itemMax = 80) =>
  z
    .string()
    .optional()
    .transform((v) =>
      Array.from(
        new Set(
          (v ?? "")
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    )
    .pipe(
      z
        .array(z.string().max(itemMax, `Keep each item under ${itemMax} characters.`))
        .max(max, `Up to ${max} items.`),
    );

const slider = z.coerce.number().int().min(0).max(100);

export const toneSlidersSchema = z.object({
  formal_casual: slider,
  playful_serious: slider,
  concise_detailed: slider,
  bold_reassuring: slider,
});
export type ToneSliders = z.infer<typeof toneSlidersSchema>;

export const TONE_SLIDERS: { key: keyof ToneSliders; left: string; right: string }[] = [
  { key: "formal_casual", left: "Formal", right: "Casual" },
  { key: "playful_serious", left: "Playful", right: "Serious" },
  { key: "concise_detailed", left: "Concise", right: "Detailed" },
  { key: "bold_reassuring", left: "Bold", right: "Reassuring" },
];

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
  .pipe(z.string().url("Enter a web address like yourbusiness.com.").optional());

const optionalPhone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((v) => (v ? v.replace(/[^\d+]/g, "") : undefined))
  .pipe(
    z
      .string()
      .regex(/^\+?\d{7,15}$/, "Enter a phone number with country code, like +234 803 000 0000.")
      .optional(),
  );

export const brandQuestionnaireSchema = z.object({
  offer: z.string().trim().min(3, "Tell us briefly what you sell.").max(1000),
  audience: z.string().trim().min(3, "Tell us briefly who your customers are.").max(1000),
  industry: z.string().trim().max(120).optional(),
  tone: toneSlidersSchema,
  doSay: listField(),
  dontSay: listField(),
  complianceRules: listField(10, 200),
  exampleCtas: listField(10, 120),
  websiteUrl: optionalUrl,
  whatsappNumber: optionalPhone,
});
export type BrandQuestionnaire = z.infer<typeof brandQuestionnaireSchema>;

/** FormData → object for brandQuestionnaireSchema (tone sliders are flat fields). */
export function questionnaireFromForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    offer: get("offer"),
    audience: get("audience"),
    industry: get("industry") || undefined,
    tone: Object.fromEntries(TONE_SLIDERS.map((s) => [s.key, get(`tone.${s.key}`) ?? "50"])),
    doSay: get("doSay"),
    dontSay: get("dontSay"),
    complianceRules: get("complianceRules"),
    exampleCtas: get("exampleCtas"),
    websiteUrl: get("websiteUrl") || undefined,
    whatsappNumber: get("whatsappNumber") || undefined,
  };
}
