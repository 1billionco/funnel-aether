/**
 * Content-Security-Policy builder (spec §9).
 *
 * Baseline without nonces: Next.js App Router emits inline bootstrap scripts,
 * so script-src needs 'unsafe-inline' unless every page is dynamically rendered
 * with a per-request nonce. We start here and tighten later (DECISIONS D-006).
 * Only hosts we actually talk to from the browser are allowed.
 */
export function buildCsp({
  frameAncestors,
  isDev,
  env = process.env,
}: {
  frameAncestors: "'none'" | "*";
  isDev: boolean;
  env?: Record<string, string | undefined>;
}): string {
  const connect = new Set<string>(["'self'"]);
  const supabase = env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    const u = new URL(supabase);
    connect.add(u.origin);
    connect.add(`${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`); // Realtime
  }
  const posthog = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (env.NEXT_PUBLIC_POSTHOG_KEY && posthog) {
    const host = new URL(posthog).origin;
    connect.add(host);
    // PostHog serves assets from a sibling "-assets" host on the EU/US clouds.
    connect.add(host.replace(".i.posthog.com", "-assets.i.posthog.com"));
  }
  if (env.NEXT_PUBLIC_SENTRY_DSN) connect.add("https://*.ingest.sentry.io");
  if (env.NEXT_PUBLIC_SENTRY_DSN) connect.add("https://*.ingest.de.sentry.io");

  const img = ["'self'", "blob:", "data:"];
  if (supabase) img.push(new URL(supabase).origin); // Storage public URLs

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": img,
    "font-src": ["'self'", "data:"],
    "connect-src": [...connect],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": [frameAncestors],
  };

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
