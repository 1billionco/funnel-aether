import { createSupabaseServiceClient } from "../../lib/db/service";
import { parseEnv } from "../../lib/env";
import { runJob } from "../../lib/jobs/handlers";
import { BACKGROUND_SECRET_HEADER, verifySharedSecret } from "../../lib/jobs/secret";

/**
 * Runs one job from the jobs table (up to 15 minutes). The request body carries
 * only {jobId}; the job's payload holds IDs, never file contents.
 */
export default async function runJobBackground(req: Request) {
  if (
    !verifySharedSecret(
      req.headers.get(BACKGROUND_SECRET_HEADER),
      Netlify.env.get("BACKGROUND_FN_SECRET"),
    )
  ) {
    console.warn("run-job-background: rejected (bad or missing secret)");
    return;
  }
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return;
  const env = parseEnv({
    NEXT_PUBLIC_SUPABASE_URL: Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    VOYAGE_API_KEY: Netlify.env.get("VOYAGE_API_KEY"),
    EMBEDDING_MODEL: Netlify.env.get("EMBEDDING_MODEL"),
    EMBEDDING_DIM: Netlify.env.get("EMBEDDING_DIM"),
  });
  for (const [k, v] of Object.entries({
    VOYAGE_API_KEY: env.VOYAGE_API_KEY,
    EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  })) {
    if (v) process.env[k] = v;
  }
  const db = createSupabaseServiceClient(env);
  if (!db) return;
  await runJob(db, jobId);
}
