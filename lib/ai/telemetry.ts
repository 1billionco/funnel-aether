import type { ServiceSupabase } from "../db/service";
import type { GenUsage } from "./provider";

export interface ModelPrice {
  model: string;
  input_per_mtok: number | null;
  output_per_mtok: number | null;
  cache_read_per_mtok: number | null;
  cache_write_per_mtok: number | null;
}

let cache: { at: number; prices: Map<string, ModelPrice> } | null = null;

/** Prices from the model_prices table (admin-editable), cached for a minute. */
export async function getModelPrices(db: ServiceSupabase): Promise<Map<string, ModelPrice>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.prices;
  const { data } = await db
    .from("model_prices")
    .select("model, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok");
  const prices = new Map((data ?? []).map((p) => [p.model, p as ModelPrice]));
  cache = { at: Date.now(), prices };
  return prices;
}

export function clearPriceCache() {
  cache = null;
}

/**
 * Cost from the token counts the API returned (§6.6). input_tokens excludes
 * cached tokens on the Messages API, so the three input buckets add up.
 * Unknown prices count as 0 (flagged in admin).
 */
export function estimateCostUsd(price: ModelPrice | undefined, usage: GenUsage): number {
  if (!price) return 0;
  const per = (n: number, rate: number | null) => (n * Number(rate ?? 0)) / 1_000_000;
  return (
    per(usage.inputTokens, price.input_per_mtok) +
    per(usage.outputTokens, price.output_per_mtok) +
    per(usage.cacheReadTokens, price.cache_read_per_mtok ?? price.input_per_mtok) +
    per(usage.cacheWriteTokens, price.cache_write_per_mtok ?? price.input_per_mtok)
  );
}

export interface UsageRecord {
  orgId: string | null;
  userId?: string | null;
  feature: string;
  provider: string;
  model: string;
  usage: GenUsage;
  latencyMs?: number;
  isMock: boolean;
  routerReason?: string | null;
  refId?: string | null;
}

/** Writes one usage_events row for every AI/embedding call, mock included (cost 0). */
export async function recordUsage(db: ServiceSupabase | null, r: UsageRecord): Promise<number> {
  const cost =
    r.isMock || !db ? 0 : estimateCostUsd((await getModelPrices(db)).get(r.model), r.usage);
  if (!db) return cost;
  const { error } = await db.from("usage_events").insert({
    org_id: r.orgId,
    user_id: r.userId ?? null,
    feature: r.feature,
    provider: r.provider,
    model: r.model,
    input_tokens: r.usage.inputTokens,
    output_tokens: r.usage.outputTokens,
    cached_tokens: r.usage.cacheReadTokens,
    cache_write_tokens: r.usage.cacheWriteTokens,
    est_cost_usd: Number(cost.toFixed(6)),
    latency_ms: r.latencyMs ?? null,
    is_mock: r.isMock,
    router_reason: r.routerReason ?? null,
    ref_id: r.refId ?? null,
  });
  if (error) console.error("[usage] failed to record", error.message);
  return cost;
}
