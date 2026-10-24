import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeNextPath } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/db/server";
import { afterSignIn } from "@/lib/auth/post-sign-in";

/**
 * Lands magic links (PKCE code or token_hash) and Google OAuth. After the
 * session exists, founder admins listed in FOUNDER_ADMIN_EMAILS get the
 * profile flag (so DB-side checks such as invite exemption see it).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const requestedNext = url.searchParams.get("next");
  const fail = (reason: string, detail?: string) => {
    // Shows in the Netlify function log; the visitor only sees a mapped message.
    console.error("[auth/callback]", reason, detail ?? "");
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(reason)}`, request.url),
    );
  };

  const db = await createSupabaseServerClient();
  if (!db) return fail("not_configured");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return fail("link_expired", `exchange: ${error.message}`);
  } else if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link_expired", `verify: ${error.message}`);
  } else {
    // Supabase reports link errors as error_code (e.g. otp_expired) plus a description.
    return fail(
      "link_expired",
      `${url.searchParams.get("error_code") ?? "no_code"}: ${url.searchParams.get("error_description") ?? ""}`,
    );
  }

  const { data } = await db.auth.getUser();
  if (!data.user) return fail("link_expired");
  const home = await afterSignIn(db, data.user);
  const next = safeNextPath(requestedNext, home);

  return NextResponse.redirect(new URL(next, request.url));
}
