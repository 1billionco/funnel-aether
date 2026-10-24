import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a full email address, like name@business.com.")
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use 128 characters or fewer.");

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,40}$/, "That invite code doesn't look right. Check it and try again.");

export const nextSchema = z.string().max(500).optional();

export const passwordSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
  next: nextSchema,
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema.optional().or(z.literal("").transform(() => undefined)),
  fullName: z.string().trim().max(120).optional(),
  inviteCode: inviteCodeSchema.optional().or(z.literal("").transform(() => undefined)),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
  next: nextSchema,
  inviteCode: inviteCodeSchema.optional().or(z.literal("").transform(() => undefined)),
});

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
