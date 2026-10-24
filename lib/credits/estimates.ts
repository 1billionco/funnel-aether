import "server-only";

import { modelFor } from "@/lib/ai";
import { OUTPUT_TYPES, tokensFor, type OutputType } from "@/lib/ai/output-types";
import { chooseTier } from "@/lib/ai/router";
import { getModelPrices } from "@/lib/ai/telemetry";
import { estimateGeneration } from "@/lib/credits/meter";
import type { PlanSubject } from "@/lib/credits/plans";
import type { ServiceSupabase } from "@/lib/db/service";
import { parseEnv, services } from "@/lib/env";

/** Typical credits per output type and version count (index = versions − 1), shown before generating (spec §5). */
export async function typicalEstimates(
  db: ServiceSupabase | null,
  org: PlanSubject & { is_demo?: boolean },
): Promise<Record<OutputType, number[]>> {
  const env = parseEnv();
  const mock = services(env).llm === "mock" || org.is_demo;
  const prices = db && !mock ? await getModelPrices(db) : new Map();
  const out = {} as Record<OutputType, number[]>;
  for (const type of Object.keys(OUTPUT_TYPES) as OutputType[]) {
    const tier = chooseTier({ org, outputType: type }).tier;
    const spec = OUTPUT_TYPES[type];
    out[type] = Array.from({ length: spec.maxVariants }, (_, i) => {
      const tokens = tokensFor(spec, i + 1);
      return estimateGeneration({
        price: mock ? undefined : prices.get(modelFor(tier, env)),
        inputTokens: 2500, // brand block + samples + brief, typical
        maxOutputTokens: tokens.max,
        typicalOutputTokens: tokens.typical,
        creditValueUsd: env.CREDIT_VALUE_USD,
      }).typicalMillicredits;
    });
  }
  return out;
}
