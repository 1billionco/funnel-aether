/**
 * The invite code survives the magic-link / Google OAuth round trip in a
 * cookie, then create_organization() enforces it server-side (spec §12 M1).
 */
export const INVITE_COOKIE = "fa_invite";
export const INVITE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
