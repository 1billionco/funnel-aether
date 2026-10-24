import { track, hasEvent } from "../analytics/events";
import { recordUsage } from "../ai/telemetry";
import type { ServiceSupabase } from "../db/service";
import { withOrg } from "../db/with-org";
import { getEmbeddingProvider, toVectorLiteral } from "../embeddings";
import { chunkText, estimateTokens } from "./chunker";
import { extractText } from "./extract";
import { trainingQualityScore } from "./quality";

export const BRAND_DOCS_BUCKET = "brand-docs";
const INSERT_BATCH = 100;

export class DocumentProcessingError extends Error {}

/**
 * Recomputes a brand's counts and training-quality score from the database
 * *after* writes are committed. The old backend read counts before its new
 * rows were flushed and showed stale numbers; reading fresh stats via
 * brand_document_stats() avoids that.
 */
export async function refreshBrandStats(db: ServiceSupabase, orgId: string, brandId: string) {
  const { data, error } = await db.rpc("brand_document_stats", { p_brand: brandId });
  if (error) throw error;
  const row = data?.[0] ?? { document_count: 0, chunk_count: 0, doc_types: [] };
  const stats = {
    documentCount: row.document_count,
    chunkCount: row.chunk_count,
    docTypes: row.doc_types ?? [],
  };
  const score = trainingQualityScore(stats);
  await withOrg(db, orgId)
    .update("brands", {
      training_quality_score: score,
      document_count: stats.documentCount,
      chunk_count: stats.chunkCount,
    })
    .eq("id", brandId);
  return { ...stats, score };
}

/** Extract → chunk → embed → store. Called by the job runner with an ID, never file contents. */
export async function processDocument(db: ServiceSupabase, documentId: string) {
  const { data: doc } = await db
    .from("brand_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) throw new DocumentProcessingError("document not found");
  const scoped = withOrg(db, doc.org_id);
  const { data: org } = await db
    .from("organizations")
    .select("id, is_demo")
    .eq("id", doc.org_id)
    .single();

  await scoped.update("brand_documents", { status: "processing", error: null }).eq("id", doc.id);
  try {
    if (!doc.storage_path || !doc.mime)
      throw new DocumentProcessingError(
        "We couldn't find the uploaded file. Please upload it again.",
      );
    const { data: file, error: dlError } = await db.storage
      .from(BRAND_DOCS_BUCKET)
      .download(doc.storage_path);
    if (dlError || !file)
      throw new DocumentProcessingError(
        "We couldn't find the uploaded file. Please upload it again.",
      );

    let text: string;
    try {
      text = await extractText(new Uint8Array(await file.arrayBuffer()), doc.mime);
    } catch {
      throw new DocumentProcessingError(
        "We couldn't read that file. Try saving it as a PDF or plain text.",
      );
    }
    const chunks = chunkText(text);
    if (chunks.length === 0)
      throw new DocumentProcessingError("We couldn't find any text in that file.");

    const embedder = getEmbeddingProvider({ forceMock: org?.is_demo === true });
    const started = Date.now();
    const { vectors, totalTokens } = await embedder.embed(chunks, "document");
    await recordUsage(db, {
      orgId: doc.org_id,
      userId: doc.created_by,
      feature: "embed_document",
      provider: embedder.isMock ? "mock" : "voyage",
      model: embedder.model,
      usage: { inputTokens: totalTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      latencyMs: Date.now() - started,
      isMock: embedder.isMock,
      refId: doc.id,
    });

    // Re-processing replaces any earlier chunks for this document.
    await scoped.delete("brand_chunks").eq("document_id", doc.id);
    const rows = chunks.map((content, i) => ({
      brand_id: doc.brand_id,
      document_id: doc.id,
      chunk_index: i,
      content,
      token_count: estimateTokens(content),
      embedding: toVectorLiteral(vectors[i]!),
      embedding_model: embedder.model,
    }));
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error } = await scoped.insert("brand_chunks", rows.slice(i, i + INSERT_BATCH));
      if (error) throw error;
    }

    // Data minimisation: drop the original once extracted unless the owner chose to keep it.
    let storagePath: string | null = doc.storage_path;
    if (!doc.keep_original) {
      await db.storage.from(BRAND_DOCS_BUCKET).remove([doc.storage_path]);
      storagePath = null;
    }
    await scoped
      .update("brand_documents", {
        status: "ready",
        char_count: text.length,
        chunk_count: chunks.length,
        processed_at: new Date().toISOString(),
        storage_path: storagePath,
      })
      .eq("id", doc.id);

    const stats = await refreshBrandStats(db, doc.org_id, doc.brand_id);
    if (!(await hasEvent(db, doc.org_id, "brand_trained"))) {
      await track(
        {
          name: "brand_trained",
          orgId: doc.org_id,
          userId: doc.created_by,
          props: { documents: stats.documentCount, score: stats.score },
        },
        db,
      );
    }
    return { chunks: chunks.length, ...stats };
  } catch (error) {
    const message =
      error instanceof DocumentProcessingError
        ? error.message
        : "Something went wrong reading that document. Please try again.";
    await scoped.update("brand_documents", { status: "failed", error: message }).eq("id", doc.id);
    await refreshBrandStats(db, doc.org_id, doc.brand_id);
    throw error;
  }
}

/** Re-embeds a brand's chunks with the current model (admin job when EMBEDDING_MODEL changes). */
export async function reembedBrand(db: ServiceSupabase, orgId: string, brandId: string) {
  const embedder = getEmbeddingProvider();
  const scoped = withOrg(db, orgId);
  const { data: stale } = await scoped
    .select("brand_chunks", "id, content")
    .eq("brand_id", brandId)
    .neq("embedding_model", embedder.model);
  const rows = (stale ?? []) as { id: string; content: string }[];
  for (let i = 0; i < rows.length; i += 64) {
    const batch = rows.slice(i, i + 64);
    const { vectors, totalTokens } = await embedder.embed(
      batch.map((r) => r.content),
      "document",
    );
    for (let j = 0; j < batch.length; j++) {
      await scoped
        .update("brand_chunks", {
          embedding: toVectorLiteral(vectors[j]!),
          embedding_model: embedder.model,
        })
        .eq("id", batch[j]!.id);
    }
    await recordUsage(db, {
      orgId,
      feature: "reembed_brand",
      provider: embedder.isMock ? "mock" : "voyage",
      model: embedder.model,
      usage: { inputTokens: totalTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      isMock: embedder.isMock,
      refId: brandId,
    });
  }
  return { reembedded: rows.length };
}
