import "server-only";

import { createClient } from "@supabase/supabase-js";

import { parseEnv, type Env } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS. Server code and background functions
 * only. Never import from client components.
 *
 * Every tenant query made with it must be scoped by org_id. Use the withOrg()
 * helper (added with the tenancy schema in M1) instead of calling .from()
 * directly.
 */
export function createSupabaseServiceClient(env: Env = parseEnv()) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
