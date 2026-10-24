import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient, type ServerSupabase } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { founderAdminEmails } from "@/lib/env";

export type Org = Database["public"]["Tables"]["organizations"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

/** Verified user for this request (cached per request). Null when signed out or in mock mode. */
export const getUser = cache(async (): Promise<{ user: User; db: ServerSupabase } | null> => {
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user, db };
});

export async function requireUser(next?: string) {
  const session = await getUser();
  if (!session) {
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return session;
}

export const getMemberships = cache(async () => {
  const session = await getUser();
  if (!session) return [];
  const { data } = await session.db
    .from("memberships")
    .select(
      "role, organizations!inner(id, name, slug, market, plan, onboarding_completed_at, deleted_at)",
    )
    .eq("user_id", session.user.id)
    .order("created_at");
  return (data ?? []).filter((m) => !m.organizations.deleted_at);
});

/**
 * Loads an org by slug for the signed-in user. RLS hides orgs the user isn't
 * a member of, so a missing row and a forbidden row both become a 404, which
 * leaks nothing about other tenants.
 */
export const requireOrg = cache(async (slug: string) => {
  const session = await requireUser(`/${slug}/today`);
  const { db, user } = session;
  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org) notFound();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();
  return { ...session, org, role: membership.role as MemberRole };
});

export function canEdit(role: MemberRole) {
  return role === "owner" || role === "editor";
}

/** Where a signed-in user should land: their first org, or onboarding. */
export async function homePathFor(): Promise<string> {
  const memberships = await getMemberships();
  const first = memberships[0]?.organizations;
  if (!first) return "/onboarding";
  return first.onboarding_completed_at ? `/${first.slug}/today` : `/${first.slug}/setup`;
}

export async function isFounderAdmin(user: User, db?: ServerSupabase): Promise<boolean> {
  const email = user.email?.toLowerCase();
  if (email && founderAdminEmails().includes(email)) return true;
  if (!db) return false;
  const { data } = await db
    .from("profiles")
    .select("is_founder_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.is_founder_admin === true;
}

export async function requireFounderAdmin() {
  const session = await requireUser("/admin");
  if (!(await isFounderAdmin(session.user, session.db))) notFound();
  return session;
}
