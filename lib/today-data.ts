import "server-only";

import type { ServerSupabase } from "@/lib/db/server";
import type { Brand } from "@/lib/brands";
import type { CoreLoopInput } from "@/lib/core-loop";

/** Gathers the numbers Today needs in as few round trips as possible. Extended per milestone. */
export async function getCoreLoopInput(
  _db: ServerSupabase,
  _orgId: string,
  brand: Brand | null,
): Promise<CoreLoopInput> {
  return {
    brandProfileDone: !!(brand?.offer && brand?.audience),
    brandTrained: (brand?.document_count ?? 0) > 0,
    draftsGenerated: 0,
    draftsApproved: 0,
    pendingDrafts: 0,
    leads: 0,
    campaignSends: 0,
  };
}
