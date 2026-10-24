import { after } from "next/server";

import { createSupabaseServiceClient, type ServiceSupabase } from "../db/service";
import type { Json } from "../db/types";
import { parseEnv } from "../env";
import { BACKGROUND_SECRET_HEADER } from "./secret";
import { runJob, type JobType } from "./handlers";

/**
 * Creates a jobs row and starts it (spec §3):
 *  - JOB_RUNNER=netlify: POST the job ID to the run-job background function
 *    (up to 15 min, shared-secret header).
 *  - otherwise (local, CI, or a Netlify plan without background functions):
 *    run it with next/server after(), within the route's time limit.
 */
export async function dispatchJob(
  input: { orgId: string; type: JobType; payload: Record<string, Json> },
  db: ServiceSupabase | null = createSupabaseServiceClient(),
) {
  if (!db) throw new Error("Jobs need SUPABASE_SERVICE_ROLE_KEY");
  const { data: job, error } = await db
    .from("jobs")
    .insert({ org_id: input.orgId, type: input.type, payload: input.payload })
    .select("id")
    .single();
  if (error || !job) throw error ?? new Error("could not create job");

  const env = parseEnv();
  if (
    process.env.JOB_RUNNER === "netlify" &&
    env.NEXT_PUBLIC_SITE_URL &&
    env.BACKGROUND_FN_SECRET
  ) {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/.netlify/functions/run-job-background`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [BACKGROUND_SECRET_HEADER]: env.BACKGROUND_FN_SECRET,
        },
        body: JSON.stringify({ jobId: job.id }),
      },
    );
    if (res.status !== 202 && !res.ok) {
      after(() => runJob(db, job.id));
    }
  } else {
    after(() => runJob(db, job.id));
  }
  return job.id;
}
