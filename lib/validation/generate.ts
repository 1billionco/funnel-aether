import { z } from "zod";

import { OUTPUT_TYPES, type OutputType } from "../ai/output-types";

export const briefSchema = z.object({
  goal: z.string().trim().min(3, "Tell us what this should achieve.").max(500),
  offer: z.string().trim().max(500).optional(),
  audience: z.string().trim().max(500).optional(),
  details: z.string().trim().max(2000).optional(),
});

export const generateSchema = z
  .object({
    org: z.string().min(1).max(60),
    brandId: z.string().uuid().optional(),
    type: z.enum(Object.keys(OUTPUT_TYPES) as [OutputType, ...OutputType[]]),
    channel: z.enum(["linkedin", "instagram", "facebook", "x", "email", "whatsapp", "web"]),
    variants: z.coerce.number().int().min(1).max(3).default(1),
    brief: briefSchema,
    regenerate: z
      .object({
        draftId: z.string().uuid(),
        feedback: z.string().trim().min(3, "Tell the AI what to change.").max(1000),
      })
      .optional(),
    continueDraftId: z.string().uuid().optional(),
  })
  .refine((v) => OUTPUT_TYPES[v.type].channels.includes(v.channel), {
    message: "That channel doesn't fit this type of content.",
    path: ["channel"],
  });

export type GenerateBody = z.infer<typeof generateSchema>;
