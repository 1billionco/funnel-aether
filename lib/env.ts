import { z } from "zod";

/**
 * Environment contract (spec §13). Every key is optional: a missing key must
 * degrade to a clearly labelled mock, never crash. `services()` is the single
 * place that decides which integrations are live vs mock.
 *
 * Next.js route handlers read process.env; standalone Netlify functions call
 * parseEnv() with values from Netlify.env.get() (see lib/env-netlify.ts, M2+).
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const num = (fallback: number) =>
  optional.transform((v) => {
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  });

export const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optional,
  NEXT_PUBLIC_APP_ENV: optional,
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  ANTHROPIC_API_KEY: optional,
  LLM_MODEL_FAST: optional,
  LLM_MODEL_SMART: optional,
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,
  VOYAGE_API_KEY: optional,
  EMBEDDING_MODEL: optional,
  EMBEDDING_DIM: num(1024),
  CREDIT_VALUE_USD: num(0.002),
  GENERATION_DEADLINE_MS: num(25_000),
  BACKGROUND_FN_SECRET: optional,
  JOB_RUNNER: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM_DOMAIN: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_GROWTH_GBP: optional,
  STRIPE_PRICE_ADVANCED_GBP: optional,
  PAYSTACK_SECRET_KEY: optional,
  PAYSTACK_PLAN_GROWTH_NGN: optional,
  PAYSTACK_PLAN_ADVANCED_NGN: optional,
  NEXT_PUBLIC_POSTHOG_KEY: optional,
  NEXT_PUBLIC_POSTHOG_HOST: optional,
  SENTRY_DSN: optional,
  FOUNDER_ADMIN_EMAILS: optional,
  AI_DAILY_BUDGET_USD: num(5),
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

export type ServiceMode = "live" | "mock" | "off";

export interface ServiceStatus {
  database: ServiceMode;
  llm: ServiceMode;
  llmFallback: ServiceMode;
  embeddings: ServiceMode;
  email: ServiceMode;
  stripe: ServiceMode;
  paystack: ServiceMode;
  productAnalytics: ServiceMode;
  errors: ServiceMode;
}

/** Which integrations run for real. Anything not "live" must be labelled in the UI. */
export function services(env: Env = parseEnv()): ServiceStatus {
  return {
    database: env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "live" : "mock",
    llm: env.ANTHROPIC_API_KEY ? "live" : "mock",
    llmFallback: env.GEMINI_API_KEY ? "live" : "off",
    embeddings: env.VOYAGE_API_KEY ? "live" : "mock",
    email: env.RESEND_API_KEY && env.EMAIL_FROM_DOMAIN ? "live" : "mock",
    stripe: env.STRIPE_SECRET_KEY ? "live" : "mock",
    paystack: env.PAYSTACK_SECRET_KEY ? "live" : "mock",
    productAnalytics: env.NEXT_PUBLIC_POSTHOG_KEY ? "live" : "off",
    errors: env.SENTRY_DSN ? "live" : "off",
  };
}

/** Test-mode keys are the default for payments; live keys must be an explicit choice. */
export function paymentsAreLive(env: Env = parseEnv()): { stripe: boolean; paystack: boolean } {
  return {
    stripe: !!env.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
    paystack: !!env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_"),
  };
}

export function founderAdminEmails(env: Env = parseEnv()): string[] {
  return (env.FOUNDER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
