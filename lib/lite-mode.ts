/**
 * Lite mode is decided on the server so there is no flash or hydration
 * mismatch (spec §7.3). Precedence:
 *   1. the user's explicit choice (cookie "1"/"0")
 *   2. the request's Save-Data: on header
 *   3. otherwise off. NG orgs get the cookie set to "1" on first sign-in or
 *      onboarding when no explicit choice exists (see setLiteDefaultIfUnset).
 */
export const LITE_COOKIE = "fa_lite";

export function decideLiteMode(input: {
  cookie?: string | null;
  saveData?: string | null;
}): boolean {
  if (input.cookie === "1") return true;
  if (input.cookie === "0") return false;
  return input.saveData?.toLowerCase() === "on";
}

export const LITE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: false,
};

export const LITE_PAGE_SIZE = 10;
export const FULL_PAGE_SIZE = 25;
