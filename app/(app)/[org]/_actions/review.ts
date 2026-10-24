"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { track } from "@/lib/analytics/events";
import { requireOrg, type MemberRole } from "@/lib/auth/session";
import { createSupabaseServiceClient, type ServiceSupabase } from "@/lib/db/service";
import type { Database, Json } from "@/lib/db/types";
import { withOrg } from "@/lib/db/with-org";

type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];
type JsonDoc = NonNullable<Json>;

export interface ReviewResult {
  ok: boolean;
  message?: string;
}

/** Who may do what (spec §4 roles). Reviewers approve/reject; editors and owners also edit. */
const CAN = {
  decide: (r: MemberRole) => r === "owner" || r === "editor" || r === "reviewer",
  edit: (r: MemberRole) => r === "owner" || r === "editor",
};

const idSchema = z.string().uuid();
const UNDO_WINDOW_MS = 10 * 60_000;
const LOW_RISK_SCORE = 70;

async function ctx(slug: string, need: keyof typeof CAN) {
  const c = await requireOrg(slug);
  if (!CAN[need](c.role))
    throw new Error(
      need === "edit"
        ? "Only owners and editors can edit drafts."
        : "You can't review drafts in this business.",
    );
  const svc = createSupabaseServiceClient();
  if (!svc) throw new Error("Review needs SUPABASE_SERVICE_ROLE_KEY on the server.");
  return { ...c, svc, scoped: withOrg(svc, c.org.id) };
}

async function loadDraft(scoped: ReturnType<typeof withOrg>, id: string): Promise<DraftRow | null> {
  if (!idSchema.safeParse(id).success) return null;
  const { data } = await scoped.select("drafts", "*").eq("id", id).maybeSingle();
  return (data as DraftRow | null) ?? null;
}

async function nextVersion(scoped: ReturnType<typeof withOrg>, draftId: string) {
  const { data } = await scoped
    .select("draft_versions", "version")
    .eq("draft_id", draftId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { version: number } | null)?.version ?? 0) + 1;
}

const editSchema = z.object({
  body: z.string().trim().min(1, "The draft can't be empty.").max(40000),
  subject: z.string().trim().max(150).optional(),
  preheader: z.string().trim().max(200).optional(),
});

/** Saves a human edit as a new version (status unchanged). */
async function applyEdit(
  svc: ServiceSupabase,
  scoped: ReturnType<typeof withOrg>,
  draft: DraftRow,
  userId: string,
  edit: z.infer<typeof editSchema>,
) {
  const meta = { ...((draft.metadata as Record<string, Json>) ?? {}) };
  if (edit.subject !== undefined) meta.subject = edit.subject;
  if (edit.preheader !== undefined) meta.preheader = edit.preheader;
  const changed =
    edit.body !== draft.body ||
    meta.subject !== (draft.metadata as Record<string, Json>)?.subject ||
    meta.preheader !== (draft.metadata as Record<string, Json>)?.preheader;
  if (!changed) return false;
  await scoped.update("drafts", { body: edit.body, metadata: meta as JsonDoc }).eq("id", draft.id);
  await scoped.insert("draft_versions", {
    draft_id: draft.id,
    version: await nextVersion(scoped, draft.id),
    body: edit.body,
    metadata: meta as JsonDoc,
    source: "human_edit",
    created_by: userId,
  });
  await scoped.insert("approval_events", { draft_id: draft.id, actor: userId, action: "edit" });
  void svc;
  return true;
}

function done(slug: string, message?: string): ReviewResult {
  revalidatePath(`/${slug}`, "layout");
  return { ok: true, message };
}

function failed(e: unknown): ReviewResult {
  return {
    ok: false,
    message: e instanceof Error ? e.message : "Something went wrong. Please try again.",
  };
}

export async function saveDraftEdit(
  slug: string,
  id: string,
  input: z.input<typeof editSchema>,
): Promise<ReviewResult> {
  try {
    const { svc, scoped, user } = await ctx(slug, "edit");
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
    const draft = await loadDraft(scoped, id);
    if (!draft || !["pending", "partial", "rejected"].includes(draft.status))
      return { ok: false, message: "This draft can't be edited now." };
    await applyEdit(svc, scoped, draft, user.id, parsed.data);
    return done(slug, "Saved.");
  } catch (e) {
    return failed(e);
  }
}

/** Approve, optionally with an edit first ("edit-then-approve"). Nothing is published or sent by approving. */
export async function approveDraft(
  slug: string,
  id: string,
  edit?: z.input<typeof editSchema>,
): Promise<ReviewResult> {
  try {
    const { svc, scoped, user, org, role } = await ctx(slug, "decide");
    const draft = await loadDraft(scoped, id);
    if (!draft || !["pending", "partial"].includes(draft.status))
      return { ok: false, message: "This draft isn't waiting for approval." };
    let edited = false;
    if (edit) {
      if (!CAN.edit(role))
        return { ok: false, message: "Only owners and editors can edit drafts." };
      const parsed = editSchema.safeParse(edit);
      if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
      edited = await applyEdit(svc, scoped, draft, user.id, parsed.data);
    }
    const { data: versions } = await scoped.select("draft_versions", "source").eq("draft_id", id);
    const humanEdited =
      edited ||
      ((versions as { source: string }[] | null) ?? []).some((v) => v.source === "human_edit");
    await scoped
      .update("drafts", {
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", id);
    await scoped.insert("approval_events", { draft_id: id, actor: user.id, action: "approve" });
    await track(
      {
        name: "draft_approved",
        orgId: org.id,
        userId: user.id,
        props: {
          type: draft.type,
          channel: draft.channel,
          edited: humanEdited,
          score: draft.brand_match_score,
          is_mock: draft.is_mock,
        },
      },
      svc,
    );
    if (humanEdited)
      await track(
        {
          name: "draft_edited_before_approve",
          orgId: org.id,
          userId: user.id,
          props: { type: draft.type },
        },
        svc,
      );
    return done(slug, "Approved.");
  } catch (e) {
    return failed(e);
  }
}

export async function rejectDraft(
  slug: string,
  id: string,
  reason?: string,
): Promise<ReviewResult> {
  try {
    const { svc, scoped, user, org } = await ctx(slug, "decide");
    const draft = await loadDraft(scoped, id);
    if (!draft || !["pending", "partial"].includes(draft.status))
      return { ok: false, message: "This draft isn't waiting for a decision." };
    const note = reason?.trim().slice(0, 1000) || null;
    await scoped.update("drafts", { status: "rejected", rejected_reason: note }).eq("id", id);
    await scoped.insert("approval_events", {
      draft_id: id,
      actor: user.id,
      action: "reject",
      note,
    });
    await track(
      {
        name: "draft_rejected",
        orgId: org.id,
        userId: user.id,
        props: { type: draft.type, has_reason: !!note, score: draft.brand_match_score },
      },
      svc,
    );
    return done(slug, "Rejected.");
  } catch (e) {
    return failed(e);
  }
}

/** Reverts a recent approve/reject (the undo toast). */
export async function undoDecision(slug: string, id: string): Promise<ReviewResult> {
  try {
    const { scoped, user } = await ctx(slug, "decide");
    const draft = await loadDraft(scoped, id);
    if (!draft || !["approved", "rejected"].includes(draft.status))
      return { ok: false, message: "Nothing to undo." };
    const { data: last } = await scoped
      .select("approval_events", "action, actor, at")
      .eq("draft_id", id)
      .in("action", ["approve", "reject"])
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ev = last as { actor: string; at: string } | null;
    if (!ev || ev.actor !== user.id || Date.now() - new Date(ev.at).getTime() > UNDO_WINDOW_MS)
      return { ok: false, message: "It's too late to undo that." };
    await scoped
      .update("drafts", {
        status: "pending",
        approved_by: null,
        approved_at: null,
        rejected_reason: null,
      })
      .eq("id", id);
    await scoped.insert("approval_events", { draft_id: id, actor: user.id, action: "undo" });
    return done(slug, "Undone.");
  } catch (e) {
    return failed(e);
  }
}

export async function chooseVariant(
  slug: string,
  id: string,
  index: number,
): Promise<ReviewResult> {
  try {
    const { scoped, user } = await ctx(slug, "edit");
    const draft = await loadDraft(scoped, id);
    const variants =
      ((draft?.metadata as Record<string, Json>)?.variants as string[] | undefined) ?? [];
    if (!draft || !variants[index] || !["pending", "partial"].includes(draft.status))
      return { ok: false, message: "That version isn't available." };
    const meta = { ...((draft.metadata as Record<string, Json>) ?? {}), selected_variant: index };
    await scoped
      .update("drafts", { body: variants[index]!, metadata: meta as JsonDoc })
      .eq("id", id);
    await scoped.insert("approval_events", {
      draft_id: id,
      actor: user.id,
      action: "edit",
      note: `Chose version ${index + 1}`,
    });
    return done(slug);
  } catch (e) {
    return failed(e);
  }
}

const scheduleSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/));

/** For ready-to-post assets: sets a reminder time. Nothing is posted automatically (spec §2). */
export async function scheduleDraft(slug: string, id: string, when: string): Promise<ReviewResult> {
  try {
    const { scoped, user } = await ctx(slug, "decide");
    if (!scheduleSchema.safeParse(when).success)
      return { ok: false, message: "Pick a date and time." };
    const at = new Date(when);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000)
      return { ok: false, message: "Pick a time in the future." };
    const draft = await loadDraft(scoped, id);
    if (!draft || !["approved", "scheduled"].includes(draft.status))
      return { ok: false, message: "Approve the draft before scheduling it." };
    await scoped
      .update("drafts", { status: "scheduled", scheduled_for: at.toISOString() })
      .eq("id", id);
    await scoped.insert("approval_events", {
      draft_id: id,
      actor: user.id,
      action: "schedule",
      note: at.toISOString(),
    });
    return done(slug, "Reminder set.");
  } catch (e) {
    return failed(e);
  }
}

/** The owner published a social/WhatsApp asset themselves (spec §4: `posted`). */
export async function markPosted(slug: string, id: string): Promise<ReviewResult> {
  try {
    const { scoped, user } = await ctx(slug, "decide");
    const draft = await loadDraft(scoped, id);
    if (!draft || !["approved", "scheduled"].includes(draft.status) || draft.type === "email")
      return { ok: false, message: "Only approved posts and messages can be marked as posted." };
    await scoped
      .update("drafts", { status: "posted", posted_at: new Date().toISOString() })
      .eq("id", id);
    await scoped.insert("approval_events", { draft_id: id, actor: user.id, action: "post" });
    return done(slug, "Marked as posted.");
  } catch (e) {
    return failed(e);
  }
}

export async function archiveDraft(slug: string, id: string): Promise<ReviewResult> {
  try {
    const { scoped, user } = await ctx(slug, "edit");
    const draft = await loadDraft(scoped, id);
    if (!draft || draft.status === "generating")
      return { ok: false, message: "This draft can't be archived now." };
    await scoped.update("drafts", { status: "archived" }).eq("id", id);
    await scoped.insert("approval_events", { draft_id: id, actor: user.id, action: "archive" });
    return done(slug, "Archived.");
  } catch (e) {
    return failed(e);
  }
}

/** Bulk approve only low-risk drafts: no flags and a strong brand match. */
export async function bulkApprove(
  slug: string,
  ids: string[],
): Promise<ReviewResult & { approved?: number; skipped?: number }> {
  try {
    const { svc, scoped, user, org } = await ctx(slug, "decide");
    const valid = ids.filter((i) => idSchema.safeParse(i).success).slice(0, 50);
    const { data } = await scoped.select("drafts", "*").in("id", valid).eq("status", "pending");
    const drafts = (data as DraftRow[] | null) ?? [];
    const lowRisk = drafts.filter(
      (d) => (d.flags as unknown[]).length === 0 && (d.brand_match_score ?? 0) >= LOW_RISK_SCORE,
    );
    const now = new Date().toISOString();
    for (const d of lowRisk) {
      await scoped
        .update("drafts", { status: "approved", approved_by: user.id, approved_at: now })
        .eq("id", d.id);
      await scoped.insert("approval_events", {
        draft_id: d.id,
        actor: user.id,
        action: "approve",
        note: "Bulk approve",
      });
      await track(
        {
          name: "draft_approved",
          orgId: org.id,
          userId: user.id,
          props: { type: d.type, bulk: true, score: d.brand_match_score },
        },
        svc,
      );
    }
    revalidatePath(`/${slug}`, "layout");
    return {
      ok: true,
      approved: lowRisk.length,
      skipped: valid.length - lowRisk.length,
      message:
        `Approved ${lowRisk.length}. ${valid.length - lowRisk.length ? `${valid.length - lowRisk.length} need a closer look.` : ""}`.trim(),
    };
  } catch (e) {
    return failed(e);
  }
}

export async function rateDraft(slug: string, id: string, rating: 1 | -1): Promise<ReviewResult> {
  try {
    const { db, org, user } = await requireOrg(slug);
    if (!idSchema.safeParse(id).success) return { ok: false };
    const { error } = await db.from("feedback").insert({
      org_id: org.id,
      user_id: user.id,
      kind: "draft_rating",
      score: rating === 1 ? 1 : -1,
      draft_id: id,
    });
    if (error) return { ok: false, message: "Couldn't save that." };
    await track({
      name: "feedback_submitted",
      orgId: org.id,
      userId: user.id,
      props: { kind: "draft_rating", score: rating },
    });
    return { ok: true, message: "Thanks for the feedback." };
  } catch (e) {
    return failed(e);
  }
}

/** Lightweight poll for background drafts (Create page and Review). */
export async function getDraftStatus(slug: string, id: string) {
  const { db, org } = await requireOrg(slug);
  if (!idSchema.safeParse(id).success) return null;
  const { data } = await db
    .from("drafts")
    .select("id, status, body, error, brand_match_score, metadata")
    .eq("org_id", org.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}
