"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrg } from "@/lib/auth/session";
import { track } from "@/lib/analytics/events";
import { LITE_COOKIE, LITE_COOKIE_OPTIONS } from "@/lib/lite-mode";

export async function setLiteMode(on: boolean) {
  (await cookies()).set(LITE_COOKIE, on ? "1" : "0", LITE_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}

const feedbackSchema = z.object({
  kind: z.enum(["idea", "bug", "nps", "draft_rating"]),
  text: z.string().trim().max(4000).optional(),
  score: z.coerce.number().int().min(-1).max(10).optional(),
  draftId: z.string().uuid().optional(),
  page: z.string().max(300).optional(),
});

export interface FeedbackState {
  ok?: boolean;
  message?: string;
}

export async function submitFeedback(
  slug: string,
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const { db, org, user } = await requireOrg(slug);
  const parsed = feedbackSchema.safeParse({
    kind: formData.get("kind") ?? "idea",
    text: formData.get("text") || undefined,
    score: formData.get("score") || undefined,
    draftId: formData.get("draftId") || undefined,
    page: formData.get("page") || (await headers()).get("referer")?.slice(0, 300) || undefined,
  });
  if (!parsed.success) return { message: "Please check your feedback and try again." };
  if ((parsed.data.kind === "idea" || parsed.data.kind === "bug") && !parsed.data.text) {
    return { message: "Tell us a little about it first." };
  }
  const { error } = await db.from("feedback").insert({
    org_id: org.id,
    user_id: user.id,
    kind: parsed.data.kind,
    text: parsed.data.text ?? null,
    score: parsed.data.score ?? null,
    draft_id: parsed.data.draftId ?? null,
    page: parsed.data.page ?? null,
  });
  if (error) return { message: "We couldn't send that. Please try again." };
  await track({
    name: "feedback_submitted",
    orgId: org.id,
    userId: user.id,
    props: { kind: parsed.data.kind },
  });
  return { ok: true, message: "Thanks, we read every message." };
}
