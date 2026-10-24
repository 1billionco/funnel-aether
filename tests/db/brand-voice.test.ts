import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { BRAND_DOCS_BUCKET, processDocument } from "@/lib/brand-voice/process";
import { retrieveBrandChunks } from "@/lib/brand-voice/retrieve";
import type { ServiceSupabase } from "@/lib/db/service";

import { createUserWithOrg, serviceClient } from "../support/supabase";

type Tenant = Awaited<ReturnType<typeof createUserWithOrg>>;

const ACCOUNTANT_TEXT = [
  "Hartley & Co. helps small businesses in Kent stay on top of their tax returns.",
  "We explain self assessment deadlines in plain English and never use scare tactics.",
  "Our bookkeeping service saves owners hours every month, so they can focus on clients.",
  "Book a free 20-minute call to talk through your year-end accounts.",
].join("\n\n");

const RETAIL_TEXT = [
  "Weekend promo! Samsung phones and LG fridges now in stock at Chinedu Electronics.",
  "Free delivery anywhere in Lagos mainland. Send us a WhatsApp to order.",
].join("\n\n");

async function addDocument(
  db: ServiceSupabase,
  t: Tenant,
  text: string,
  opts: { docType?: string; keep?: boolean } = {},
) {
  const id = randomUUID();
  const path = `${t.org.id}/${t.brand.id}/${id}/sample.txt`;
  const { error: upErr } = await db.storage
    .from(BRAND_DOCS_BUCKET)
    .upload(path, new Blob([text], { type: "text/plain" }), { contentType: "text/plain" });
  if (upErr) throw upErr;
  const { error } = await db.from("brand_documents").insert({
    id,
    org_id: t.org.id,
    brand_id: t.brand.id,
    title: "Sample",
    doc_type: opts.docType ?? "past_content",
    source: "upload",
    filename: "sample.txt",
    mime: "text/plain",
    size_bytes: text.length,
    storage_path: path,
    keep_original: opts.keep ?? false,
    status: "queued",
    created_by: t.id,
  });
  if (error) throw error;
  return id;
}

let db: ServiceSupabase;
let accountant: Tenant;
let retailer: Tenant;

beforeAll(async () => {
  db = serviceClient() as unknown as ServiceSupabase;
  accountant = await createUserWithOrg("hartley", "UK");
  retailer = await createUserWithOrg("chinedu", "NG");
});

describe("document processing", () => {
  it("makes an uploaded document retrievable and scores the brand", async () => {
    const docId = await addDocument(db, accountant, ACCOUNTANT_TEXT, { docType: "past_content" });
    const result = await processDocument(db, docId);
    expect(result.chunks).toBeGreaterThan(0);

    const { data: doc } = await db
      .from("brand_documents")
      .select("status, chunk_count, char_count, storage_path")
      .eq("id", docId)
      .single();
    expect(doc?.status).toBe("ready");
    expect(doc?.chunk_count).toBe(result.chunks);
    expect(doc?.storage_path).toBeNull(); // original deleted (data minimisation)

    const { chunks, model } = await retrieveBrandChunks(db, {
      brandId: accountant.brand.id,
      query: "tax return deadline help",
    });
    expect(model).toBe("mock");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.content).toMatch(/tax|self assessment/i);
  });

  it("updates counts and score correctly after each upload (stale-count regression)", async () => {
    const before = (
      await db
        .from("brands")
        .select("document_count, chunk_count, training_quality_score")
        .eq("id", accountant.brand.id)
        .single()
    ).data!;
    expect(before.document_count).toBe(1);

    const second = await addDocument(
      db,
      accountant,
      "Our tone: warm, calm, never pushy.\n\nWe say 'you' and avoid jargon.",
      { docType: "tone_examples" },
    );
    await processDocument(db, second);
    const after2 = (
      await db
        .from("brands")
        .select("document_count, chunk_count, training_quality_score")
        .eq("id", accountant.brand.id)
        .single()
    ).data!;
    expect(after2.document_count).toBe(2);
    expect(after2.chunk_count).toBeGreaterThan(before.chunk_count);
    expect(after2.training_quality_score).toBeGreaterThan(before.training_quality_score);

    const third = await addDocument(
      db,
      accountant,
      "Brand guidelines: always include a clear call to action.",
      { docType: "guidelines" },
    );
    await processDocument(db, third);
    const after3 = (
      await db
        .from("brands")
        .select("document_count, training_quality_score")
        .eq("id", accountant.brand.id)
        .single()
    ).data!;
    expect(after3.document_count).toBe(3);
    expect(after3.training_quality_score).toBeGreaterThan(after2.training_quality_score);
  });

  it("keeps the original only when asked", async () => {
    const id = await addDocument(db, retailer, RETAIL_TEXT, { keep: true });
    await processDocument(db, id);
    const { data } = await db.from("brand_documents").select("storage_path").eq("id", id).single();
    expect(data?.storage_path).toContain(retailer.org.id);
  });

  it("marks empty documents as failed with a friendly message", async () => {
    const id = await addDocument(db, retailer, "   \n\n  ");
    await expect(processDocument(db, id)).rejects.toThrow();
    const { data } = await db.from("brand_documents").select("status, error").eq("id", id).single();
    expect(data?.status).toBe("failed");
    expect(data?.error).toMatch(/couldn't find any text/);
  });

  it("returns k results when the brand has enough chunks (HNSW + filter)", async () => {
    const long = Array.from(
      { length: 40 },
      (_, i) =>
        `Tip ${i}: keep receipts for expense ${i} and claim allowable costs on your tax return.`,
    ).join("\n\n");
    const id = await addDocument(db, accountant, long.repeat(3), { docType: "blog_posts" });
    await processDocument(db, id);
    const { chunks } = await retrieveBrandChunks(db, {
      brandId: accountant.brand.id,
      query: "claim expenses",
      k: 6,
    });
    expect(chunks).toHaveLength(6);
  });

  it("records brand_trained once and usage for every embedding call", async () => {
    const { data: events } = await db
      .from("events")
      .select("name")
      .eq("org_id", accountant.org.id)
      .eq("name", "brand_trained");
    expect(events).toHaveLength(1);
    const { data: usage } = await db
      .from("usage_events")
      .select("feature, is_mock, est_cost_usd")
      .eq("org_id", accountant.org.id);
    expect(usage!.length).toBeGreaterThanOrEqual(4);
    expect(
      usage!.every(
        (u) => u.feature === "embed_document" && u.is_mock && Number(u.est_cost_usd) === 0,
      ),
    ).toBe(true);
  });
});

describe("brand voice isolation", () => {
  it("a member of another org cannot retrieve or read the chunks", async () => {
    const { chunks } = await retrieveBrandChunks(retailer.client, {
      brandId: accountant.brand.id,
      query: "tax return",
    });
    expect(chunks).toEqual([]);
    const { data } = await retailer.client
      .from("brand_chunks")
      .select("id")
      .eq("brand_id", accountant.brand.id);
    expect(data).toEqual([]);
    const { data: docs } = await retailer.client
      .from("brand_documents")
      .select("id")
      .eq("brand_id", accountant.brand.id);
    expect(docs).toEqual([]);
  });

  it("members can read their own documents but not insert chunks directly", async () => {
    const { data } = await accountant.client
      .from("brand_documents")
      .select("id")
      .eq("brand_id", accountant.brand.id);
    expect(data!.length).toBeGreaterThan(0);
    const { error } = await accountant.client.from("brand_chunks").insert({
      org_id: accountant.org.id,
      brand_id: accountant.brand.id,
      document_id: data![0]!.id,
      chunk_index: 99,
      content: "x",
      embedding: `[${Array(1024).fill(0).join(",")}]`,
      embedding_model: "mock",
    });
    expect(error).not.toBeNull();
  });

  it("other orgs cannot download stored originals", async () => {
    const { data: doc } = await db
      .from("brand_documents")
      .select("storage_path")
      .eq("org_id", retailer.org.id)
      .not("storage_path", "is", null)
      .limit(1)
      .single();
    const { data, error } = await accountant.client.storage
      .from(BRAND_DOCS_BUCKET)
      .download(doc!.storage_path!);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    const own = await retailer.client.storage.from(BRAND_DOCS_BUCKET).download(doc!.storage_path!);
    expect(own.error).toBeNull();
  });
});
