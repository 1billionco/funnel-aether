import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../lib/db/types";
import { localSupabaseEnv } from "./local-env";

export type TestClient = SupabaseClient<Database>;

export function serviceClient(): TestClient {
  const env = localSupabaseEnv();
  return createClient<Database>(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): TestClient {
  const env = localSupabaseEnv();
  return createClient<Database>(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const uniqueEmail = (tag = "user") => `${tag}-${randomUUID().slice(0, 8)}@example.test`;
export const TEST_PASSWORD = "correct-horse-battery-1";

/** Creates a confirmed user and returns a client signed in as them. */
export async function createUser(tag = "user", fullName?: string) {
  const admin = serviceClient();
  const email = uniqueEmail(tag);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function createInvite(
  opts: { maxUses?: number; market?: "UK" | "NG" | null; expiresAt?: string | null } = {},
) {
  const code = `T-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { error } = await serviceClient()
    .from("beta_invites")
    .insert({
      code,
      max_uses: opts.maxUses ?? 1,
      market: opts.market ?? null,
      expires_at: opts.expiresAt ?? null,
    });
  if (error) throw error;
  return code;
}

/** Signs up a user and creates their org via the real RPC (with a fresh invite). */
export async function createUserWithOrg(tag: string, market: "UK" | "NG" = "UK") {
  const user = await createUser(tag);
  const code = await createInvite();
  const { data: org, error } = await user.client.rpc("create_organization", {
    p_name: `${tag} business`,
    p_market: market,
    p_invite_code: code,
  });
  if (error || !org) throw error ?? new Error("create_organization failed");
  const { data: brand, error: brandError } = await user.client
    .from("brands")
    .insert({ org_id: org.id, name: `${tag} brand` })
    .select()
    .single();
  if (brandError) throw brandError;
  return { ...user, org, brand };
}
