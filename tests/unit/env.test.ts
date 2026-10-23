import { describe, expect, it } from "vitest";

import { founderAdminEmails, parseEnv, paymentsAreLive, services } from "@/lib/env";

describe("env", () => {
  it("parses an empty environment into mock mode without throwing", () => {
    const env = parseEnv({});
    expect(services(env)).toEqual({
      database: "mock",
      llm: "mock",
      llmFallback: "off",
      embeddings: "mock",
      email: "mock",
      stripe: "mock",
      paystack: "mock",
      productAnalytics: "off",
      errors: "off",
    });
  });

  it("applies numeric defaults and ignores junk", () => {
    const env = parseEnv({ CREDIT_VALUE_USD: "abc", AI_DAILY_BUDGET_USD: "" });
    expect(env.CREDIT_VALUE_USD).toBe(0.002);
    expect(env.AI_DAILY_BUDGET_USD).toBe(5);
    expect(env.EMBEDDING_DIM).toBe(1024);
    expect(env.GENERATION_DEADLINE_MS).toBe(25_000);
  });

  it("treats whitespace-only keys as missing", () => {
    expect(services(parseEnv({ ANTHROPIC_API_KEY: "   " })).llm).toBe("mock");
  });

  it("marks configured services live", () => {
    const s = services(
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        ANTHROPIC_API_KEY: "sk-ant-x",
        RESEND_API_KEY: "re_x",
      }),
    );
    expect(s.database).toBe("live");
    expect(s.llm).toBe("live");
    // Email needs a verified sending domain too.
    expect(s.email).toBe("mock");
  });

  it("treats payments as test mode unless a live key is set", () => {
    expect(paymentsAreLive(parseEnv({ STRIPE_SECRET_KEY: "sk_test_1" })).stripe).toBe(false);
    expect(paymentsAreLive(parseEnv({ STRIPE_SECRET_KEY: "sk_live_1" })).stripe).toBe(true);
    expect(paymentsAreLive(parseEnv({ PAYSTACK_SECRET_KEY: "sk_test_1" })).paystack).toBe(false);
  });

  it("normalises founder admin emails", () => {
    expect(founderAdminEmails(parseEnv({ FOUNDER_ADMIN_EMAILS: " A@x.com, ,b@Y.com" }))).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });
});
