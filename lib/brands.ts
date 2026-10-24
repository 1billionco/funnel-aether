import type { ServerSupabase } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { toneSlidersSchema, type ToneSliders } from "@/lib/validation/org";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
export type Brand = Omit<BrandRow, "tone_sliders"> & { tone_sliders: ToneSliders };

const NEUTRAL_TONE: ToneSliders = {
  formal_casual: 50,
  playful_serious: 50,
  concise_detailed: 50,
  bold_reassuring: 50,
};

/** Validates the JSON tone sliders (falls back to neutral if malformed). */
export function asBrand(row: BrandRow): Brand {
  const tone = toneSlidersSchema.safeParse(row.tone_sliders);
  return { ...row, tone_sliders: tone.success ? tone.data : NEUTRAL_TONE };
}

/** The org's brands, oldest first; the first is the default ("primary") brand. */
export async function listBrands(db: ServerSupabase, orgId: string): Promise<Brand[]> {
  const { data } = await db
    .from("brands")
    .select("*")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at");
  return (data ?? []).map(asBrand);
}

export async function getPrimaryBrand(db: ServerSupabase, orgId: string): Promise<Brand | null> {
  return (await listBrands(db, orgId))[0] ?? null;
}
