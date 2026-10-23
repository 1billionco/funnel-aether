import { timingSafeEqual } from "node:crypto";

/**
 * Background and scheduled functions are invoked over HTTP with a shared
 * secret header (spec §3). Constant-time compare; an unset secret never matches.
 */
export const BACKGROUND_SECRET_HEADER = "x-fa-background-secret";

export function verifySharedSecret(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
