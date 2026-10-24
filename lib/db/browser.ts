"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";

/** Browser client (anon key, RLS applies). Null in mock mode. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient<Database>(url, key);
}
