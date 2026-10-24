import { estimateCostUsd, type ModelPrice } from "../ai/telemetry";

/**
 * Credits are cost-based (spec §5): 1 credit = CREDIT_VALUE_USD of model cost,
 * stored as integer milli-credits, minimum 250 (¼ credit) per request.
 */
export const MIN_MILLICREDITS = 250;

export function costToMillicredits(costUsd: number, creditValueUsd: number): number {
  if (!(creditValueUsd > 0)) throw new Error("CREDIT_VALUE_USD must be positive");
  return Math.max(MIN_MILLICREDITS, Math.ceil((costUsd / creditValueUsd) * 1000 - 1e-9));
}

export interface GenerationEstimate {
  /** Reserved up front: worst case (full max_tokens output). */
  reserveMillicredits: number;
  reserveCostUsd: number;
  /** Shown to the user before generating: a typical outcome. */
  typicalMillicredits: number;
}

export function estimateGeneration(input: {
  price: ModelPrice | undefined;
  inputTokens: number;
  maxOutputTokens: number;
  typicalOutputTokens: number;
  creditValueUsd: number;
}): GenerationEstimate {
  const worst = estimateCostUsd(input.price, {
    inputTokens: input.inputTokens,
    outputTokens: input.maxOutputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
  const typical = estimateCostUsd(input.price, {
    inputTokens: input.inputTokens,
    outputTokens: input.typicalOutputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
  return {
    reserveMillicredits: costToMillicredits(worst, input.creditValueUsd),
    reserveCostUsd: Number(worst.toFixed(6)),
    typicalMillicredits: costToMillicredits(typical, input.creditValueUsd),
  };
}
