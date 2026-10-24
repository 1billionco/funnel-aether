import "server-only";

import type { DocRow } from "@/components/brand/document-list";
import type { ServerSupabase } from "@/lib/db/server";

export async function listBrandDocuments(db: ServerSupabase, brandId: string): Promise<DocRow[]> {
  const { data } = await db
    .from("brand_documents")
    .select("id, title, doc_type, source, status, error, chunk_count, created_at")
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as DocRow[];
}
