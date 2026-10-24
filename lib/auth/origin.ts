/**
 * The origin the browser actually used. Behind Netlify (and `next start`),
 * `request.url` can carry an internal or deploy-specific host, and redirecting
 * there loses the session cookie that was just set on the public host.
 */
export function requestOrigin(h: Headers, fallback = "http://localhost:3000"): string {
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  if (!host) return fallback.replace(/\/$/, "");
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}
