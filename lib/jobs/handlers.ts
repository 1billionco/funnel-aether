import { processDocument } from "../brand-voice/process";
import { resumePrepared, runGeneration, type GenerationJobPayload } from "../generation/core";
import { refundGeneration } from "../credits/ledger";
import type { ServiceSupabase } from "../db/service";
import type { Json } from "../db/types";

/** Job types and their handlers. Payloads carry IDs only (Netlify 256 KB limit). */
export type JobType = "process_document" | "generate_draft";

/** Long-form generation in a background function (spec §3: up to 15 minutes). */
const BACKGROUND_DEADLINE_MS = 8 * 60_000;

export const JOB_HANDLERS: Record<
  JobType,
  (db: ServiceSupabase, payload: Record<string, unknown>, orgId: string) => Promise<Json>
> = {
  async process_document(db, payload) {
    const result = await processDocument(db, String(payload.documentId));
    return result as unknown as Json;
  },
  async generate_draft(db, payload, orgId) {
    const job = payload as unknown as GenerationJobPayload;
    const prepared = await resumePrepared(db, orgId, job);
    if (!prepared) {
      await refundGeneration(db, job.reservationId);
      throw new Error("draft not found");
    }
    const inline = process.env.JOB_RUNNER !== "netlify";
    const result = await runGeneration(db, prepared, {
      // Inline jobs share the route's time limit; background functions get minutes.
      deadlineMs: inline
        ? Number(process.env.GENERATION_DEADLINE_MS ?? 25_000)
        : BACKGROUND_DEADLINE_MS,
      persistProgress: true,
    });
    return { ok: result.ok, draftId: job.draftId } as Json;
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
    const result = await handler(db, (job.payload ?? {}) as Record<string, unknown>, job.org_id);
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
