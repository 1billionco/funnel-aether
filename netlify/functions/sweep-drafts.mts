import type { Config } from "@netlify/functions";

import { createSupabaseServiceClient } from "../../lib/db/service";
import { parseEnv } from "../../lib/env";

/**
 * Every 5 minutes: drafts stuck in "generating" for over 2 minutes become
 * failed (or partial) and their credits are refunded (spec §3). One SQL call,
 * well inside the scheduled-function limit.
 */
export default async function sweepDrafts() {
  const db = createSupabaseServiceClient(
    parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    }),
  );
  if (!db) return;
  const { data, error } = await db.rpc("sweep_stuck_drafts", {});
  if (error) console.error("sweep-drafts failed", error.message);
  else if (data) console.log(`sweep-drafts: recovered ${data} draft(s)`);
}

export const config: Config = { schedule: "*/5 * * * *" };
