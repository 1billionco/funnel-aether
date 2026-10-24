import { createHash } from "node:crypto";

/** Best-effort client IP. Netlify sets x-nf-client-connection-ip. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Salted hash so raw IPs are never stored (consent records, rate-limit keys). */
export function hashIp(ip: string, salt = process.env.CRON_SECRET ?? "fa-local-salt"): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
