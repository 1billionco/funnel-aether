import { createClient } from "@supabase/supabase-js";

import { parseEnv, type Env } from "../env";
import type { Database } from "./types";

/**
 * Service-role client. BYPASSES RLS. Server code and background functions
 * only (never import from a client component).
 *
 * No `server-only` import here because standalone Netlify functions use it
 * too, and that package throws outside a React Server environment.
 *
 * Tenant data must be accessed through withOrg() (lib/db/with-org.ts), which
 * scopes every query by org_id.
 */
export function createSupabaseServiceClient(env: Env = parseEnv()) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
