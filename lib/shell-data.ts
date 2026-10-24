import "server-only";

import type { ServerSupabase } from "@/lib/db/server";

/** Counts shown in the shell chrome. Extended as features land. */
export async function getShellCounts(_db: ServerSupabase, _orgId: string) {
  return { pending: 0 };
}
