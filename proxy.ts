import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isPublicPath } from "@/lib/auth/paths";

/**
 * Next.js 16 proxy (formerly middleware). Two jobs:
 *  1. Refresh the Supabase session cookie on every request (@supabase/ssr).
 *  2. Optimistically redirect signed-out visitors away from app routes.
 * Real authorisation happens in every page, layout and Server Action
 * (lib/auth/session.ts), never here alone.
 */

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Mock mode: no auth backend. Pages render a "not configured" notice.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  const { pathname, search } = request.nextUrl;
  if (!signedIn && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(redirectUrl);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, images and Netlify function routes.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.netlify|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
