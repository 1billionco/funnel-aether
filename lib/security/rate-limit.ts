import { createSupabaseServiceClient, type ServiceSupabase } from "../db/service";

/** Bucket presets (capacity, refill per second). */
export const RATE_LIMITS = {
  authByIp: { capacity: 10, perSecond: 10 / 600 }, // 10 per 10 min
  authByEmail: { capacity: 5, perSecond: 5 / 900 }, // 5 per 15 min
  inviteCheckByIp: { capacity: 20, perSecond: 20 / 600 },
  generateByUser: { capacity: 10, perSecond: 10 / 60 }, // burst 10, 1 per 6s
  formSubmitByIp: { capacity: 5, perSecond: 5 / 60 },
  urlFetchByUser: { capacity: 5, perSecond: 5 / 300 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Token-bucket check backed by Postgres (rate_limit_take). Fails open when the
 * DB is not configured (mock mode) and fails closed on DB errors.
 */
export async function rateLimit(
  name: RateLimitName,
  key: string,
  db: ServiceSupabase | null = createSupabaseServiceClient(),
): Promise<boolean> {
  if (!db || rateLimitBypassed()) return true;
  const preset = RATE_LIMITS[name];
  const { data, error } = await db.rpc("rate_limit_take", {
    p_key: `${name}:${key}`,
    p_capacity: preset.capacity,
    p_refill_per_second: preset.perSecond,
  });
  if (error) {
    console.error("[rate-limit]", name, error.message);
    return false;
  }
  return data === true;
}

/**
 * E2E runs every sign-in from one IP, so the suite sets RATE_LIMIT_BYPASS=1.
 * Ignored in production builds (NEXT_PUBLIC_APP_ENV is inlined from Netlify's CONTEXT).
 */
export function rateLimitBypassed(env: Record<string, string | undefined> = process.env) {
  return env.RATE_LIMIT_BYPASS === "1" && env.NEXT_PUBLIC_APP_ENV !== "production";
}
