import "server-only";

import { createSupabaseServerClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";

export type SignupMode = Database["public"]["Enums"]["signup_mode"];

/** Null when the database isn't configured. */
export async function getSignupMode(): Promise<SignupMode | null> {
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data } = await db.rpc("get_signup_mode");
  return data ?? "invite";
}
