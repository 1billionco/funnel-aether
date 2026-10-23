import type { Config } from "@netlify/functions";

import { BACKGROUND_SECRET_HEADER, verifySharedSecret } from "../../lib/jobs/secret";

/**
 * M0 probe: confirms Background Functions are available on this Netlify plan
 * (spec §3). Invoke with:
 *   curl -X POST -H "x-fa-background-secret: $BACKGROUND_FN_SECRET" \
 *     https://<site>/.netlify/functions/probe-background
 * A 202 plus a "probe-background ok" line in the function log means it works.
 * Remove once real background jobs exist (M2).
 */
export default async function probeBackground(req: Request) {
  if (
    !verifySharedSecret(
      req.headers.get(BACKGROUND_SECRET_HEADER),
      Netlify.env.get("BACKGROUND_FN_SECRET"),
    )
  ) {
    console.warn("probe-background: rejected (bad or missing secret)");
    return;
  }
  const started = Date.now();
  await new Promise((r) => setTimeout(r, 35_000)); // longer than the sync limit on purpose
  console.log(`probe-background ok after ${Date.now() - started}ms`);
}

export const config: Config = {};
