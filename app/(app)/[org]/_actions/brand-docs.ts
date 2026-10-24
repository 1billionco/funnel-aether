"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getLLMProvider, modelFor } from "@/lib/ai";
import { brandSummaryRequest } from "@/lib/ai/prompts/brand-summary";
import { recordUsage } from "@/lib/ai/telemetry";
import { canEdit, requireOrg } from "@/lib/auth/session";
import { asBrand } from "@/lib/brands";
import {
  htmlToText,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  normaliseMime,
} from "@/lib/brand-voice/extract";
import { BRAND_DOCS_BUCKET, refreshBrandStats } from "@/lib/brand-voice/process";
import { DOC_TYPES } from "@/lib/brand-voice/quality";
import { retrieveBrandChunks } from "@/lib/brand-voice/retrieve";
import { createSupabaseServiceClient, type ServiceSupabase } from "@/lib/db/service";
import { withOrg } from "@/lib/db/with-org";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";
import { rateLimit } from "@/lib/security/rate-limit";

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

const docTypeSchema = z.enum(DOC_TYPES);

async function editorContext(slug: string) {
  const ctx = await requireOrg(slug);
  if (!canEdit(ctx.role)) throw new Error("Only owners and editors can change the brand.");
  const db = createSupabaseServiceClient();
  if (!db) throw new Error("Uploads need SUPABASE_SERVICE_ROLE_KEY on the server.");
  return { ...ctx, svc: db };
}

async function ownBrand(svc: ServiceSupabase, orgId: string, brandId: string) {
  const { data } = await withOrg(svc, orgId)
    .select("brands", "id")
    .eq("id", brandId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new Error("Brand not found.");
}

function safeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (cleaned || "document").slice(-80);
}

function fail(error: unknown): ActionResult<never> {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
  };
}

// ---------------------------------------------------------------- uploads

const uploadSchema = z.object({
  brandId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Files can be up to 10 MB."),
  docType: docTypeSchema,
  keepOriginal: z.boolean().default(false),
});

/** Step 1: create the document row and a signed upload URL. The browser uploads straight to Storage. */
export async function requestUpload(
  slug: string,
  input: z.input<typeof uploadSchema>,
): Promise<ActionResult<{ documentId: string; path: string; token: string }>> {
  try {
    const parsed = uploadSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Check the file and try again.",
      };
    const mime = normaliseMime(parsed.data.mime, parsed.data.filename);
    if (!isAllowedMime(mime))
      return { ok: false, message: "Upload a PDF, Word (.docx), text, Markdown or CSV file." };
    const { svc, org, user } = await editorContext(slug);
    await ownBrand(svc, org.id, parsed.data.brandId);

    const documentId = randomUUID();
    const path = `${org.id}/${parsed.data.brandId}/${documentId}/${safeFilename(parsed.data.filename)}`;
    const { error } = await withOrg(svc, org.id).insert("brand_documents", {
      id: documentId,
      brand_id: parsed.data.brandId,
      title: parsed.data.filename.slice(0, 200),
      doc_type: parsed.data.docType,
      source: "upload",
      filename: parsed.data.filename.slice(0, 255),
      mime,
      size_bytes: parsed.data.size,
      storage_path: path,
      keep_original: parsed.data.keepOriginal,
      status: "uploading",
      created_by: user.id,
    });
    if (error) throw new Error("We couldn't start the upload. Please try again.");
    const { data: signed, error: signError } = await svc.storage
      .from(BRAND_DOCS_BUCKET)
      .createSignedUploadUrl(path);
    if (signError || !signed) throw new Error("We couldn't start the upload. Please try again.");
    return { ok: true, data: { documentId, path, token: signed.token } };
  } catch (e) {
    return fail(e);
  }
}

/** Step 2: the browser finished uploading; verify the object exists and queue processing. */
export async function finalizeUpload(slug: string, documentId: string): Promise<ActionResult> {
  try {
    const { svc, org } = await editorContext(slug);
    const scoped = withOrg(svc, org.id);
    const { data: doc } = await scoped
      .select("brand_documents", "id, storage_path, status")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc || doc.status !== "uploading" || !doc.storage_path)
      return { ok: false, message: "Upload not found." };
    const folder = doc.storage_path.split("/").slice(0, -1).join("/");
    const { data: objects } = await svc.storage.from(BRAND_DOCS_BUCKET).list(folder);
    if (!objects?.length)
      return { ok: false, message: "The upload didn't finish. Please try again." };
    await scoped.update("brand_documents", { status: "queued" }).eq("id", documentId);
    await dispatchJob({ orgId: org.id, type: "process_document", payload: { documentId } }, svc);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function storeTextDocument(
  svc: ServiceSupabase,
  ctx: { orgId: string; userId: string; slug: string },
  doc: {
    brandId: string;
    title: string;
    text: string;
    docType: (typeof DOC_TYPES)[number];
    source: "paste" | "url";
    sourceUrl?: string;
  },
) {
  const documentId = randomUUID();
  const path = `${ctx.orgId}/${doc.brandId}/${documentId}/${doc.source}.txt`;
  const { error: upError } = await svc.storage
    .from(BRAND_DOCS_BUCKET)
    .upload(path, new Blob([doc.text], { type: "text/plain" }), { contentType: "text/plain" });
  if (upError) throw new Error("We couldn't save that text. Please try again.");
  const { error } = await withOrg(svc, ctx.orgId).insert("brand_documents", {
    id: documentId,
    brand_id: doc.brandId,
    title: doc.title.slice(0, 200),
    doc_type: doc.docType,
    source: doc.source,
    source_url: doc.sourceUrl ?? null,
    mime: "text/plain",
    size_bytes: Buffer.byteLength(doc.text),
    storage_path: path,
    status: "queued",
    created_by: ctx.userId,
  });
  if (error) throw new Error("We couldn't save that text. Please try again.");
  await dispatchJob({ orgId: ctx.orgId, type: "process_document", payload: { documentId } }, svc);
  revalidatePath(`/${ctx.slug}`, "layout");
  return documentId;
}

const pasteSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  text: z
    .string()
    .trim()
    .min(40, "Paste at least a few sentences (40+ characters).")
    .max(50_000, "That's a lot of text. Split it into smaller pieces."),
  docType: docTypeSchema,
});

export async function addPastedText(
  slug: string,
  input: z.input<typeof pasteSchema>,
): Promise<ActionResult> {
  try {
    const parsed = pasteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
    const { svc, org, user } = await editorContext(slug);
    await ownBrand(svc, org.id, parsed.data.brandId);
    const title = parsed.data.title || `${parsed.data.text.split(/\s+/).slice(0, 6).join(" ")}…`;
    await storeTextDocument(
      svc,
      { orgId: org.id, userId: user.id, slug },
      { ...parsed.data, title, source: "paste" },
    );
    return { ok: true, message: "Added. We're reading it now." };
  } catch (e) {
    return fail(e);
  }
}

const urlSchema = z.object({
  brandId: z.string().uuid(),
  url: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)),
});

export async function importFromUrl(
  slug: string,
  input: z.input<typeof urlSchema>,
): Promise<ActionResult> {
  try {
    const parsed = urlSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, message: "Enter a web address like yourbusiness.com." };
    const { svc, org, user } = await editorContext(slug);
    await ownBrand(svc, org.id, parsed.data.brandId);
    if (!(await rateLimit("urlFetchByUser", user.id, svc)))
      return { ok: false, message: "Too many imports. Wait a few minutes and try again." };

    let page;
    try {
      page = await safeFetch(parsed.data.url);
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof UnsafeUrlError
            ? e.message
            : "We couldn't open that page. Check the address and try again.",
      };
    }
    const raw = new TextDecoder().decode(page.body);
    const text = page.contentType.includes("html") ? htmlToText(raw) : raw;
    if (text.length < 200)
      return {
        ok: false,
        message:
          "We couldn't find much text on that page. Try your About page or paste the text instead.",
      };
    const host = new URL(page.url).hostname;
    await storeTextDocument(
      svc,
      { orgId: org.id, userId: user.id, slug },
      {
        brandId: parsed.data.brandId,
        title: `${host}${new URL(page.url).pathname === "/" ? "" : new URL(page.url).pathname}`,
        text: text.slice(0, 50_000),
        docType: "website_copy",
        source: "url",
        sourceUrl: page.url,
      },
    );
    return { ok: true, message: `Imported text from ${host}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocument(slug: string, documentId: string): Promise<ActionResult> {
  try {
    const { svc, org } = await editorContext(slug);
    const scoped = withOrg(svc, org.id);
    const { data: doc } = await scoped
      .select("brand_documents", "id, brand_id, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) return { ok: false, message: "Document not found." };
    await scoped.delete("brand_chunks").eq("document_id", documentId);
    if (doc.storage_path) await svc.storage.from(BRAND_DOCS_BUCKET).remove([doc.storage_path]);
    await scoped
      .update("brand_documents", { deleted_at: new Date().toISOString(), storage_path: null })
      .eq("id", documentId);
    await refreshBrandStats(svc, org.id, doc.brand_id);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function retryDocument(slug: string, documentId: string): Promise<ActionResult> {
  try {
    const { svc, org } = await editorContext(slug);
    const scoped = withOrg(svc, org.id);
    const { data: doc } = await scoped
      .select("brand_documents", "id, status, storage_path")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc || doc.status !== "failed" || !doc.storage_path)
      return { ok: false, message: "Upload the file again instead." };
    await scoped.update("brand_documents", { status: "queued", error: null }).eq("id", documentId);
    await dispatchJob({ orgId: org.id, type: "process_document", payload: { documentId } }, svc);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- brand summary

/**
 * AI drafts a brand summary; the owner edits and approves it. Onboarding
 * summaries are logged in usage_events but not charged as credits
 * (DECISIONS D-023). The summary is never used until approved.
 */
export async function generateBrandSummary(
  slug: string,
  brandId: string,
): Promise<ActionResult<{ summary: string; isMock: boolean }>> {
  try {
    const { svc, org, user, db } = await editorContext(slug);
    if (!(await rateLimit("generateByUser", user.id, svc)))
      return { ok: false, message: "Please wait a moment before trying again." };
    const { data: brand } = await db
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .eq("org_id", org.id)
      .single();
    if (!brand) return { ok: false, message: "Brand not found." };

    const forceMock = org.is_demo;
    const { chunks } = await retrieveBrandChunks(svc, {
      brandId,
      query:
        `${brand.offer ?? ""} ${brand.audience ?? ""} tone of voice call to action`.trim() ||
        brand.name,
      forceMock,
    });
    const provider = getLLMProvider({ forceMock });
    const req = brandSummaryRequest({
      model: modelFor("fast"),
      brand: asBrand(brand),
      org,
      chunks,
    });
    const started = Date.now();
    const result = await provider.complete({ ...req, signal: AbortSignal.timeout(20_000) });
    await recordUsage(svc, {
      orgId: org.id,
      userId: user.id,
      feature: "brand_summary",
      provider: provider.name,
      model: result.isMock ? "mock" : result.model,
      usage: result.usage,
      latencyMs: Date.now() - started,
      isMock: result.isMock,
      routerReason: "onboarding_fast",
      refId: brandId,
    });
    if (result.stopReason === "refusal" || !result.text.trim()) {
      return {
        ok: false,
        message: "We couldn't write a summary this time. You can write your own below.",
      };
    }
    const summary = result.text.trim().slice(0, 4000);
    await db
      .from("brands")
      .update({ summary, summary_status: "draft" })
      .eq("id", brandId)
      .eq("org_id", org.id);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true, data: { summary, isMock: result.isMock } };
  } catch (e) {
    return fail(e);
  }
}

const approveSchema = z.object({
  summary: z.string().trim().min(20, "Write at least a sentence or two.").max(4000),
});

export async function approveBrandSummary(
  slug: string,
  brandId: string,
  summary: string,
): Promise<ActionResult> {
  const parsed = approveSchema.safeParse({ summary });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };
  const { db, org, user, role } = await requireOrg(slug);
  if (!canEdit(role))
    return { ok: false, message: "Only owners and editors can approve the summary." };
  const { error } = await db
    .from("brands")
    .update({
      summary: parsed.data.summary,
      summary_status: "approved",
      summary_approved_by: user.id,
      summary_approved_at: new Date().toISOString(),
    })
    .eq("id", brandId)
    .eq("org_id", org.id);
  if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  revalidatePath(`/${slug}`, "layout");
  return { ok: true, message: "Approved. Every draft now uses this summary." };
}
