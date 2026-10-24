import { randomUUID } from "node:crypto";

import { track } from "../analytics/events";
import { getLLMProvider, modelFor } from "../ai";
import { detectFlags, mergeFlags } from "../ai/flags";
import { parseOutput, visibleText } from "../ai/output-parser";
import { OUTPUT_TYPES, tokensFor, type Channel, type OutputType } from "../ai/output-types";
import { PROMPT_VERSION } from "../ai/prompts/brand";
import { contentRequest, type Brief } from "../ai/prompts/content";
import type { GenRequest, GenUsage, LLMProvider, ModelTier, StopReason } from "../ai/provider";
import { computeBrandMatch } from "../ai/quality";
import { chooseTier, type RouterReason } from "../ai/router";
import { getModelPrices, recordUsage } from "../ai/telemetry";
import { retrieveBrandChunks } from "../brand-voice/retrieve";
import { asBrand, type Brand } from "../brands";
import { costToMillicredits, estimateGeneration } from "../credits/meter";
import {
  refundGeneration,
  reserveGeneration,
  settleGeneration,
  type ReserveFailure,
} from "../credits/ledger";
import type { ServiceSupabase } from "../db/service";
import type { Database, Json } from "../db/types";
import { withOrg } from "../db/with-org";
import { parseEnv } from "../env";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];
/** Non-null JSON for jsonb NOT NULL columns. */
type JsonDoc = NonNullable<Json>;

export interface GenerationInput {
  type: OutputType;
  channel: Channel;
  variants: number;
  brief: Brief;
  /** Regenerate an existing draft with the owner's feedback. */
  regenerate?: { draftId: string; feedback: string };
  /** Continue a draft that stopped early ("partial"). */
  continueDraftId?: string;
  /** Internal: one-time escalation to the smart model after a low brand match. */
  escalateDraftId?: string;
}

export interface PreparedGeneration {
  draftId: string;
  reservationId: string;
  orgId: string;
  userId: string | null;
  brand: Brand;
  org: OrgRow;
  input: GenerationInput;
  request: Omit<GenRequest, "signal">;
  provider: LLMProvider;
  tier: ModelTier;
  routerReason: RouterReason;
  mode: "stream" | "background";
  estimateMillicredits: number;
  reservedMillicredits: number;
  /** Body to prepend when continuing a partial draft. */
  prefix: string;
  previousStatus: DraftRow["status"] | null;
  isMock: boolean;
}

export type PrepareResult =
  | { ok: true; prepared: PreparedGeneration }
  | { ok: false; reason: ReserveFailure | "not_found" | "invalid"; message?: string };

/** Spec §6.3: query for retrieval = what the draft is about. */
function retrievalQuery(input: GenerationInput, brand: Brand) {
  return [input.brief.goal, input.brief.offer, input.brief.details, brand.offer]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);
}

/** Retrieval + prompt assembly (shared by the streaming route and background jobs). */
async function assembleRequest(
  db: ServiceSupabase,
  ctx: { org: OrgRow; brand: Brand; userId: string | null },
  input: GenerationInput,
  tier: ModelTier,
  existing: DraftRow | null,
) {
  const forceMock = ctx.org.is_demo;
  const provider = getLLMProvider({ forceMock });
  const model = provider.isMock ? "mock" : modelFor(tier);
  const {
    chunks,
    queryTokens,
    model: embedModel,
    isMock: embedMock,
  } = await retrieveBrandChunks(db, {
    brandId: ctx.brand.id,
    query: retrievalQuery(input, ctx.brand),
    forceMock,
  });
  await recordUsage(db, {
    orgId: ctx.org.id,
    userId: ctx.userId,
    feature: "retrieve_query",
    provider: embedMock ? "mock" : "voyage",
    model: embedModel,
    usage: { inputTokens: queryTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    isMock: embedMock,
  });
  const request = contentRequest({
    model,
    tier,
    type: input.type,
    channel: input.channel,
    variants: input.variants,
    brief: input.brief,
    brand: ctx.brand,
    org: ctx.org,
    chunks,
    previous:
      input.regenerate && existing
        ? { body: existing.body, feedback: input.regenerate.feedback }
        : undefined,
    continueFrom: input.continueDraftId && existing ? existing.body : undefined,
  });
  return { request, provider };
}

/** Payload for the generate_draft background job (IDs and a small brief only). */
export interface GenerationJobPayload {
  draftId: string;
  reservationId: string;
  userId: string | null;
  input: GenerationInput;
  tier: ModelTier;
  routerReason: RouterReason;
  estimateMillicredits: number;
  reservedMillicredits: number;
}

export function jobPayload(p: PreparedGeneration): GenerationJobPayload {
  return {
    draftId: p.draftId,
    reservationId: p.reservationId,
    userId: p.userId,
    input: p.input,
    tier: p.tier,
    routerReason: p.routerReason,
    estimateMillicredits: p.estimateMillicredits,
    reservedMillicredits: p.reservedMillicredits,
  };
}

/** Rebuilds a prepared generation inside a background job from its payload. */
export async function resumePrepared(
  db: ServiceSupabase,
  orgId: string,
  j: GenerationJobPayload,
): Promise<PreparedGeneration | null> {
  const scoped = withOrg(db, orgId);
  const [{ data: org }, { data: draft }] = await Promise.all([
    db.from("organizations").select("*").eq("id", orgId).single(),
    scoped.select("drafts", "*").eq("id", j.draftId).maybeSingle(),
  ]);
  const d = draft as DraftRow | null;
  if (!org || !d) return null;
  const { data: brandRow } = await scoped.select("brands", "*").eq("id", d.brand_id).single();
  if (!brandRow) return null;
  const brand = asBrand(brandRow as Database["public"]["Tables"]["brands"]["Row"]);
  const previousStatus =
    ((d.metadata as Record<string, unknown>)?.previous_status as DraftRow["status"] | undefined) ??
    null;
  const ctx = { org, brand, userId: j.userId };
  const { request, provider } = await assembleRequest(
    db,
    ctx,
    j.input,
    j.tier,
    previousStatus ? d : null,
  );
  return {
    draftId: j.draftId,
    reservationId: j.reservationId,
    orgId,
    userId: j.userId,
    brand,
    org,
    input: j.input,
    request,
    provider,
    tier: j.tier,
    routerReason: j.routerReason,
    mode: "background",
    estimateMillicredits: j.estimateMillicredits,
    reservedMillicredits: j.reservedMillicredits,
    prefix: j.input.continueDraftId ? d.body : "",
    previousStatus,
    isMock: provider.isMock,
  };
}

/**
 * Reserves credits, creates (or claims) the draft row as `generating` BEFORE
 * any model call (spec §3), and assembles the prompt.
 */
export async function prepareGeneration(
  db: ServiceSupabase,
  ctx: { org: OrgRow; brand: Brand; userId: string | null },
  input: GenerationInput,
): Promise<PrepareResult> {
  const spec = OUTPUT_TYPES[input.type];
  if (!spec.channels.includes(input.channel))
    return {
      ok: false,
      reason: "invalid",
      message: "That channel doesn't fit this type of content.",
    };
  const variants = Math.max(1, Math.min(spec.maxVariants, input.variants || spec.defaultVariants));
  const scoped = withOrg(db, ctx.org.id);

  let existing: DraftRow | null = null;
  const existingId = input.regenerate?.draftId ?? input.continueDraftId ?? input.escalateDraftId;
  if (existingId) {
    const { data } = await scoped.select("drafts", "*").eq("id", existingId).maybeSingle();
    existing = (data as DraftRow | null) ?? null;
    if (!existing || existing.status === "generating") return { ok: false, reason: "not_found" };
    if (input.continueDraftId && existing.status !== "partial")
      return { ok: false, reason: "invalid" };
  }

  const route = input.escalateDraftId
    ? { tier: "smart" as const, reason: "low_brand_match" as const }
    : chooseTier({
        org: ctx.org,
        outputType: input.type,
        regenerateAfterFast: !!input.regenerate && existing?.tier === "fast",
      });
  const { request, provider } = await assembleRequest(
    db,
    ctx,
    { ...input, variants },
    route.tier,
    existing,
  );
  const model = request.model;

  const env = parseEnv();
  const prices = await getModelPrices(db);
  const inputChars =
    request.system.reduce((s, b) => s + b.text.length, 0) +
    request.messages.reduce((s, m) => s + m.content.length, 0);
  const estimate = estimateGeneration({
    price: provider.isMock ? undefined : prices.get(model),
    inputTokens: Math.ceil(inputChars / 4),
    maxOutputTokens: request.maxTokens,
    typicalOutputTokens: tokensFor(spec, variants).typical,
    creditValueUsd: env.CREDIT_VALUE_USD,
  });

  const draftId = existing?.id ?? randomUUID();
  const reservation = await reserveGeneration(db, {
    org: ctx.org,
    userId: ctx.userId,
    draftId,
    millicredits: estimate.reserveMillicredits,
    costUsd: estimate.reserveCostUsd,
  });
  if (!reservation.ok) return { ok: false, reason: reservation.reason };

  const now = new Date().toISOString();
  const common = {
    status: "generating" as const,
    generation_started_at: now,
    tier: route.tier,
    router_reason: route.reason,
    model_used: model,
    prompt_version: PROMPT_VERSION,
    is_mock: provider.isMock,
    error: null,
  };
  const { error } = existing
    ? await scoped
        .update("drafts", {
          ...common,
          metadata: {
            ...((existing.metadata as Record<string, Json>) ?? {}),
            previous_status: existing.status,
          } as JsonDoc,
        })
        .eq("id", existing.id)
    : await scoped.insert("drafts", {
        id: draftId,
        brand_id: ctx.brand.id,
        type: input.type,
        channel: input.channel,
        body: "",
        metadata: { brief: input.brief as unknown as Json, variants_requested: variants },
        created_by: ctx.userId,
        ...common,
      });
  if (error) {
    await refundGeneration(db, reservation.reservationId);
    throw error;
  }
  if (input.regenerate && existing) {
    await scoped.insert("approval_events", {
      draft_id: existing.id,
      actor: ctx.userId,
      action: "regenerate",
      note: input.regenerate.feedback.slice(0, 2000),
    });
  }

  return {
    ok: true,
    prepared: {
      draftId,
      reservationId: reservation.reservationId,
      orgId: ctx.org.id,
      userId: ctx.userId,
      brand: ctx.brand,
      org: ctx.org,
      input: { ...input, variants },
      request,
      provider,
      tier: route.tier,
      routerReason: route.reason,
      mode: spec.mode,
      estimateMillicredits: estimate.typicalMillicredits,
      reservedMillicredits: estimate.reserveMillicredits,
      prefix: input.continueDraftId && existing ? existing.body : "",
      previousStatus: existing?.status ?? null,
      isMock: provider.isMock,
    },
  };
}

export interface RunOptions {
  deadlineMs: number;
  /** Called with the visible text so far (streaming to the client). */
  onText?: (visible: string) => void;
  /** Background mode: write progressive text to the draft row. */
  persistProgress?: boolean;
  signal?: AbortSignal;
}

/** Calls the model, then finalises. Never throws for model errors: the draft is marked failed and credits refunded. */
export async function runGeneration(db: ServiceSupabase, p: PreparedGeneration, opts: RunOptions) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.deadlineMs);
  opts.signal?.addEventListener("abort", () => controller.abort());
  const started = Date.now();
  let raw = "";
  let usage: GenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  let stopReason: StopReason = "other";
  let servedModel = p.request.model;
  let lastPersist = 0;

  try {
    for await (const d of p.provider.stream({ ...p.request, signal: controller.signal })) {
      if (d.type === "text") {
        raw += d.text;
        const visible = visibleText(raw);
        opts.onText?.(visible);
        if (opts.persistProgress && Date.now() - lastPersist > 1200) {
          lastPersist = Date.now();
          await withOrg(db, p.orgId)
            .update("drafts", { body: (p.prefix + visible).slice(0, 40000) })
            .eq("id", p.draftId);
        }
      } else {
        usage = d.usage;
        stopReason = d.stopReason;
        servedModel = d.model;
      }
    }
  } catch (error) {
    clearTimeout(timer);
    console.error("[generation] provider error", error instanceof Error ? error.message : error);
    await failGeneration(
      db,
      p,
      "We couldn't reach the AI service. Your credits were refunded. Please try again.",
      usage,
      Date.now() - started,
    );
    return {
      ok: false as const,
      message: "We couldn't reach the AI service. Your credits were refunded. Please try again.",
    };
  }
  clearTimeout(timer);
  return finalizeGeneration(db, p, {
    raw,
    usage,
    stopReason,
    servedModel,
    latencyMs: Date.now() - started,
  });
}

async function failGeneration(
  db: ServiceSupabase,
  p: PreparedGeneration,
  message: string,
  usage: GenUsage,
  latencyMs: number,
) {
  const cost = await recordUsage(db, {
    orgId: p.orgId,
    userId: p.userId,
    feature: `generate_${p.input.type}`,
    provider: p.provider.name,
    model: p.request.model,
    usage,
    latencyMs,
    isMock: p.isMock,
    routerReason: p.routerReason,
    refId: p.draftId,
  });
  await refundGeneration(db, p.reservationId, cost);
  const scoped = withOrg(db, p.orgId);
  if (p.previousStatus) {
    // Regenerate/continue/escalate failed: keep the existing draft as it was.
    await scoped.update("drafts", { status: p.previousStatus, error: message }).eq("id", p.draftId);
  } else {
    await scoped.update("drafts", { status: "failed", error: message }).eq("id", p.draftId);
  }
}

export async function finalizeGeneration(
  db: ServiceSupabase,
  p: PreparedGeneration,
  r: {
    raw: string;
    usage: GenUsage;
    stopReason: StopReason;
    servedModel: string;
    latencyMs: number;
  },
) {
  const scoped = withOrg(db, p.orgId);
  const cost = await recordUsage(db, {
    orgId: p.orgId,
    userId: p.userId,
    feature: `generate_${p.input.type}`,
    provider: p.provider.name,
    model: p.isMock ? "mock" : r.servedModel,
    usage: r.usage,
    latencyMs: r.latencyMs,
    isMock: p.isMock,
    routerReason: p.routerReason,
    refId: p.draftId,
  });

  const parsed = parseOutput(r.raw);
  if (r.stopReason === "refusal" || !parsed.variants.length) {
    await refundGeneration(db, p.reservationId, cost);
    const message =
      r.stopReason === "refusal"
        ? "The AI declined this request. Try rewording the brief. Your credits were refunded."
        : "The AI didn't return any text. Your credits were refunded. Please try again.";
    await scoped
      .update(
        "drafts",
        p.previousStatus
          ? { status: p.previousStatus, error: message }
          : { status: "failed", error: message },
      )
      .eq("id", p.draftId);
    return { ok: false as const, message };
  }

  const stoppedEarly = r.stopReason === "aborted" || r.stopReason === "max_tokens";
  const variants = p.prefix ? [`${p.prefix}${parsed.variants.join("\n\n")}`] : parsed.variants;
  const body = variants[0]!.slice(0, 40000);
  const flags = mergeFlags(parsed.meta.flags, detectFlags(variants.join("\n"), p.brand.dont_say));

  const match = await computeBrandMatch(db, {
    brandId: p.brand.id,
    documentCount: p.brand.document_count,
    text: body,
    channel: p.input.channel,
    market: p.org.market,
    brand: p.brand,
    forceMock: p.org.is_demo,
  });
  if (match.embedTokens) {
    await recordUsage(db, {
      orgId: p.orgId,
      userId: p.userId,
      feature: "brand_match",
      provider: match.isMock ? "mock" : "voyage",
      model: match.model,
      usage: {
        inputTokens: match.embedTokens,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      isMock: match.isMock,
      refId: p.draftId,
    });
  }

  const env = parseEnv();
  const millicredits = costToMillicredits(cost, env.CREDIT_VALUE_USD);
  const { data: current } = await scoped
    .select("drafts", "metadata, credits_used")
    .eq("id", p.draftId)
    .single();
  const prevMeta = ((current?.metadata as Record<string, Json>) ?? {}) as Record<string, Json>;
  const { previous_status: _ps, ...keepMeta } = prevMeta;
  void _ps;
  const metadata: Record<string, Json> = {
    ...keepMeta,
    brief: (prevMeta.brief ?? (p.input.brief as unknown as Json)) as Json,
    variants,
    selected_variant: 0,
    ...(parsed.meta.subject ? { subject: parsed.meta.subject } : {}),
    ...(parsed.meta.preheader ? { preheader: parsed.meta.preheader } : {}),
    ...(parsed.meta.hashtags ? { hashtags: parsed.meta.hashtags } : {}),
    ...(parsed.meta.cta ? { cta: parsed.meta.cta } : {}),
    stop_reason: r.stopReason,
  };

  const { data: lastVersion } = await scoped
    .select("draft_versions", "version")
    .eq("draft_id", p.draftId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((lastVersion as { version: number } | null)?.version ?? 0) + 1;

  await scoped
    .update("drafts", {
      body,
      title: parsed.meta.title ?? p.input.brief.goal.slice(0, 120),
      metadata: metadata as JsonDoc,
      status: stoppedEarly ? "partial" : "pending",
      flags: flags as unknown as JsonDoc,
      brand_match_score: match.score,
      brand_match_reasons: match.reasons as unknown as JsonDoc,
      model_used: p.isMock ? "mock" : r.servedModel,
      credits_used: ((current?.credits_used as number | undefined) ?? 0) + millicredits,
      is_mock: p.isMock,
      error: stoppedEarly
        ? "This draft stopped before it finished. Use Continue to finish it."
        : null,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", p.draftId);
  await scoped.insert("draft_versions", {
    draft_id: p.draftId,
    version,
    body,
    metadata: metadata as JsonDoc,
    source: p.input.regenerate ? "ai_regen" : "ai",
    feedback_text: p.input.regenerate?.feedback ?? null,
    model_used: p.isMock ? "mock" : r.servedModel,
    created_by: p.userId,
  });
  await settleGeneration(db, p.reservationId, millicredits, cost);
  await track(
    {
      name: "draft_generated",
      orgId: p.orgId,
      userId: p.userId,
      props: {
        type: p.input.type,
        channel: p.input.channel,
        tier: p.tier,
        router_reason: p.routerReason,
        is_mock: p.isMock,
        millicredits,
        partial: stoppedEarly,
        regenerate: !!p.input.regenerate,
      },
    },
    db,
  );

  return {
    ok: true as const,
    draftId: p.draftId,
    status: stoppedEarly ? ("partial" as const) : ("pending" as const),
    body,
    variants,
    brandMatch: match,
    flags,
    millicredits,
    meta: parsed.meta,
  };
}
