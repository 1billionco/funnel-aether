import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { parseEnv } from "@/lib/env";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route
 * Handlers. Runs as the signed-in user, so RLS applies. Prefer this over the
 * service client in request handlers (spec §9).
 *
 * Returns null when Supabase isn't configured (mock mode, §0.3).
 */
export async function createSupabaseServerClient() {
  const env = parseEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session instead (M1).
        }
      },
    },
  });
}
