"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { friendlyError } from "@/lib/auth/errors";
import { INVITE_COOKIE, INVITE_COOKIE_OPTIONS } from "@/lib/auth/invite-cookie";
import { afterSignIn } from "@/lib/auth/post-sign-in";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/db/server";
import { parseEnv } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp, hashIp } from "@/lib/security/request";
import {
  fieldErrors,
  magicLinkSchema,
  passwordSignInSchema,
  signUpSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

export interface AuthFormState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  email?: string;
}

async function origin() {
  const env = parseEnv();
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function allowAuthAttempt(email?: string) {
  const ipKey = hashIp(clientIp(await headers()));
  if (!(await rateLimit("authByIp", ipKey))) return false;
  if (email && !(await rateLimit("authByEmail", email))) return false;
  return true;
}

/** Validates an invite code (when invite mode is on) and stores it for after the redirect. */
async function checkAndStoreInvite(
  db: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  code: string | undefined,
): Promise<string | null> {
  const { data: mode } = await db.rpc("get_signup_mode");
  if (mode === "closed") return friendlyError("signups_closed");
  if (mode === "invite") {
    if (!code) return friendlyError("invite_required");
    const { data: valid } = await db.rpc("check_invite_code", { p_code: code });
    if (!valid) return friendlyError("invite_invalid");
  }
  if (code) (await cookies()).set(INVITE_COOKIE, code, INVITE_COOKIE_OPTIONS);
  return null;
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSignInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const db = await createSupabaseServerClient();
  if (!db) return { message: friendlyError("not_configured") };
  if (!(await allowAuthAttempt(parsed.data.email))) {
    return { message: friendlyError("rate_limited"), email: parsed.data.email };
  }
  const { data, error } = await db.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user)
    return { message: friendlyError(error?.message), email: parsed.data.email };
  const home = await afterSignIn(db, data.user);
  redirect(safeNextPath(parsed.data.next, home));
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!parsed.data.password)
    return { errors: { password: "Choose a password, or use an email link instead." } };
  const db = await createSupabaseServerClient();
  if (!db) return { message: friendlyError("not_configured") };
  if (!(await allowAuthAttempt(parsed.data.email)))
    return { message: friendlyError("rate_limited") };

  const inviteError = await checkAndStoreInvite(db, parsed.data.inviteCode);
  if (inviteError) return { errors: { inviteCode: inviteError }, email: parsed.data.email };

  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding`,
      data: parsed.data.fullName ? { full_name: parsed.data.fullName } : undefined,
    },
  });
  if (error) return { message: friendlyError(error.message), email: parsed.data.email };
  if (!data.session) {
    // Email confirmation is on: they finish from the link in their inbox.
    return {
      ok: true,
      message: "Check your inbox to confirm your email, then you can set up your business.",
    };
  }
  redirect("/onboarding");
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const isSignUp = formData.get("mode") === "sign-up";
  const db = await createSupabaseServerClient();
  if (!db) return { message: friendlyError("not_configured") };
  if (!(await allowAuthAttempt(parsed.data.email)))
    return { message: friendlyError("rate_limited") };

  if (isSignUp) {
    const inviteError = await checkAndStoreInvite(db, parsed.data.inviteCode);
    if (inviteError) return { errors: { inviteCode: inviteError }, email: parsed.data.email };
  }

  const next = safeNextPath(parsed.data.next, isSignUp ? "/onboarding" : "");
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: isSignUp,
      emailRedirectTo: `${await origin()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });
  // Don't reveal whether an account exists when signing in.
  if (error && isSignUp) return { message: friendlyError(error.message), email: parsed.data.email };
  return {
    ok: true,
    email: parsed.data.email,
    message: `We've sent a sign-in link to ${parsed.data.email}. It works once, for the next hour.`,
  };
}

export async function signInWithGoogle(formData: FormData) {
  const db = await createSupabaseServerClient();
  if (!db) redirect("/sign-in?error=not_configured");
  const isSignUp = formData.get("mode") === "sign-up";
  if (isSignUp) {
    const code =
      String(formData.get("inviteCode") ?? "")
        .trim()
        .toUpperCase() || undefined;
    const inviteError = await checkAndStoreInvite(db, code);
    if (inviteError) redirect(`/sign-up?error=${encodeURIComponent(inviteError)}`);
  }
  const next = safeNextPath(String(formData.get("next") ?? ""), "");
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });
  if (error || !data.url)
    redirect(`/sign-in?error=${encodeURIComponent(friendlyError(error?.message))}`);
  redirect(data.url);
}

export async function signOut() {
  const db = await createSupabaseServerClient();
  await db?.auth.signOut();
  redirect("/sign-in");
}
