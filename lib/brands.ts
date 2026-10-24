import type { ServerSupabase } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import type { ToneSliders } from "@/lib/validation/org";

export type Brand = Database["public"]["Tables"]["brands"]["Row"] & { tone_sliders: ToneSliders };

/** The org's brands, oldest first; the first is the default ("primary") brand. */
export async function listBrands(db: ServerSupabase, orgId: string): Promise<Brand[]> {
  const { data } = await db
    .from("brands")
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at");
  return (data ?? []) as Brand[];
}

export async function getPrimaryBrand(db: ServerSupabase, orgId: string): Promise<Brand | null> {
  return (await listBrands(db, orgId))[0] ?? null;
}
