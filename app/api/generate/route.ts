import { NextResponse, type NextRequest } from "next/server";

import { shouldEscalate } from "@/lib/ai/router";
import { asBrand } from "@/lib/brands";
import { RESERVE_MESSAGES } from "@/lib/credits/ledger";
import { createSupabaseServerClient } from "@/lib/db/server";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { parseEnv } from "@/lib/env";
import { jobPayload, prepareGeneration, runGeneration } from "@/lib/generation/core";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { rateLimit } from "@/lib/security/rate-limit";
import { generateSchema } from "@/lib/validation/generate";

/**
 * Content generation (spec §3, §6). Short outputs stream NDJSON from here and
 * abort at GENERATION_DEADLINE_MS, saving what was produced as "partial".
 * Long outputs reserve credits, create the draft, and run as a background job.
 * Every result lands in the Review queue; nothing is published.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json(400, {
      error: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the brief and try again.",
    });
  const body = parsed.data;

  const db = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();
  if (!db || !svc)
    return json(503, {
      error: "not_configured",
      message: "Generation isn't set up on this server.",
    });
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json(401, { error: "unauthenticated", message: "Please sign in again." });

  // RLS: only members can see the org; then check the role.
  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("slug", body.org)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org) return json(404, { error: "not_found", message: "Business not found." });
  const { data: member } = await db
    .from("memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!member) return json(404, { error: "not_found", message: "Business not found." });
  if (member.role === "reviewer")
    return json(403, {
      error: "forbidden",
      message: "Reviewers can approve drafts but not create them.",
    });

  if (!(await rateLimit("generateByUser", auth.user.id, svc))) {
    return json(429, {
      error: "rate_limited",
      message: "You're going a bit fast. Wait a few seconds and try again.",
    });
  }

  const brandQuery = db.from("brands").select("*").eq("org_id", org.id).is("deleted_at", null);
  const { data: brandRow } = body.brandId
    ? await brandQuery.eq("id", body.brandId).maybeSingle()
    : await brandQuery.order("created_at").limit(1).maybeSingle();
  if (!brandRow) return json(404, { error: "not_found", message: "Set up your brand first." });
  const brand = asBrand(brandRow);

  const prep = await prepareGeneration(
    svc,
    { org, brand, userId: auth.user.id },
    {
      type: body.type,
      channel: body.channel,
      variants: body.variants,
      brief: body.brief,
      regenerate: body.regenerate,
      continueDraftId: body.continueDraftId,
    },
  );
  if (!prep.ok) {
    const status =
      prep.reason === "insufficient_credits" || prep.reason === "daily_cap"
        ? 402
        : prep.reason === "not_found"
          ? 404
          : prep.reason === "invalid"
            ? 400
            : 503;
    const message =
      prep.message ??
      (prep.reason in RESERVE_MESSAGES
        ? RESERVE_MESSAGES[prep.reason as keyof typeof RESERVE_MESSAGES]
        : "That draft can't be regenerated right now.");
    return json(status, { error: prep.reason, message });
  }
  const p = prep.prepared;

  if (p.mode === "background") {
    await dispatchJob(
      { orgId: org.id, type: "generate_draft", payload: jobPayload(p) as never },
      svc,
    );
    return json(202, {
      mode: "background",
      draftId: p.draftId,
      estimateMillicredits: p.estimateMillicredits,
      tier: p.tier,
      isMock: p.isMock,
    });
  }

  const deadlineMs = parseEnv().GENERATION_DEADLINE_MS;
  const started = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client went away: keep generating so the draft is saved.
        }
      };
      send({
        type: "start",
        draftId: p.draftId,
        estimateMillicredits: p.estimateMillicredits,
        tier: p.tier,
        model: p.request.model,
        isMock: p.isMock,
      });

      let sent = 0;
      const result = await runGeneration(svc, p, {
        deadlineMs,
        onText: (visible) => {
          if (visible.length > sent) {
            send({ type: "delta", text: visible.slice(sent) });
            sent = visible.length;
          }
        },
      });

      if (result.ok) {
        send({
          type: "done",
          draftId: result.draftId,
          status: result.status,
          variants: result.variants,
          brandMatch: { score: result.brandMatch.score, reasons: result.brandMatch.reasons },
          flags: result.flags,
          millicredits: result.millicredits,
          meta: result.meta,
        });
        // One escalation to the smart model on a low brand match, only if there's time left (spec §6.2).
        const remaining = deadlineMs - (Date.now() - started);
        if (
          result.status === "pending" &&
          remaining > 12_000 &&
          shouldEscalate({
            org,
            tier: p.tier,
            alreadyEscalated: false,
            brandMatch: result.brandMatch.score,
          })
        ) {
          const esc = await prepareGeneration(
            svc,
            { org, brand, userId: auth.user!.id },
            {
              ...p.input,
              regenerate: undefined,
              continueDraftId: undefined,
              escalateDraftId: p.draftId,
            },
          );
          if (esc.ok) {
            send({ type: "escalating" });
            const second = await runGeneration(svc, esc.prepared, {
              deadlineMs: remaining - 2_000,
            });
            if (second.ok)
              send({
                type: "done",
                draftId: second.draftId,
                status: second.status,
                variants: second.variants,
                brandMatch: { score: second.brandMatch.score, reasons: second.brandMatch.reasons },
                flags: second.flags,
                millicredits: result.millicredits + second.millicredits,
                meta: second.meta,
                escalated: true,
              });
          }
        }
      } else {
        send({ type: "error", message: result.message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
