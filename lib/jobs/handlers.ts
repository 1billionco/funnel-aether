import { processDocument } from "../brand-voice/process";
import type { ServiceSupabase } from "../db/service";
import type { Json } from "../db/types";

/** Job types and their handlers. Payloads carry IDs only (Netlify 256 KB limit). */
export type JobType = "process_document";

export const JOB_HANDLERS: Record<
  JobType,
  (db: ServiceSupabase, payload: Record<string, unknown>) => Promise<Json>
> = {
  async process_document(db, payload) {
    const result = await processDocument(db, String(payload.documentId));
    return result as unknown as Json;
  },
};

/** Runs one job by ID, recording status/progress in the jobs table. */
export async function runJob(db: ServiceSupabase, jobId: string) {
  const { data: job } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || job.status === "succeeded" || job.status === "running") return;
  const handler = JOB_HANDLERS[job.type as JobType];
  await db
    .from("jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
      progress: 5,
    })
    .eq("id", jobId)
    .eq("org_id", job.org_id);
  try {
    if (!handler) throw new Error(`Unknown job type ${job.type}`);
    const result = await handler(db, (job.payload ?? {}) as Record<string, unknown>);
    await db
      .from("jobs")
      .update({ status: "succeeded", progress: 100, result, finished_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("org_id", job.org_id);
  } catch (error) {
    await db
      .from("jobs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("org_id", job.org_id);
  }
}
