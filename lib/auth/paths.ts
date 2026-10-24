/** Paths anyone may visit. Everything else needs a session (checked in proxy.ts). */
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/auth",
  "/f",
  "/api/public",
  "/api/webhooks",
  "/dev",
  "/pricing",
  "/privacy",
  "/terms",
  "/waitlist",
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
