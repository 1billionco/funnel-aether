# Environment variables

All variables are optional in code. A missing key degrades to a labelled mock or turns the feature off; it never crashes the app (`lib/env.ts` → `services()`). Set production values in **Netlify → Site configuration → Environment variables**. Never commit them.

| Variable                                                  | Used by                             | Missing →                  | Notes                                                              |
| --------------------------------------------------------- | ----------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                    | links in emails, OAuth redirects    | relative URLs              | Production custom domain                                           |
| `NEXT_PUBLIC_SUPABASE_URL`                                | all DB access                       | mock (no persistence)      | Supabase project URL (London, eu-west-2)                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                           | browser + user-scoped server client | mock                       | Public; RLS protects data                                          |
| `SUPABASE_SERVICE_ROLE_KEY`                               | background functions, webhooks      | those features off         | **Secret. Bypasses RLS.** Server only                              |
| `ANTHROPIC_API_KEY`                                       | generation                          | mock generator (`is_mock`) | Set a monthly spend limit in the Anthropic Console                 |
| `LLM_MODEL_FAST` / `LLM_MODEL_SMART`                      | router                              | spec defaults              | Verify IDs and prices in Anthropic docs                            |
| `GEMINI_API_KEY` / `GEMINI_MODEL`                         | fallback LLM                        | fallback off               | Check Google's data-use terms before using with real customer data |
| `GENERATION_DEADLINE_MS`                                  | streamed generation                 | 25000                      | About 5s under the Netlify sync limit (D-007)                      |
| `VOYAGE_API_KEY`                                          | embeddings                          | deterministic mock vectors | Mock vectors are stored with `embedding_model = 'mock'`            |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM`                       | embeddings                          | `voyage-4-lite` / 1024     | Changing the model requires the re-embed job                       |
| `CREDIT_VALUE_USD`                                        | credit metering                     | 0.002                      | 1 credit = $0.002 of model cost                                    |
| `AI_DAILY_BUDGET_USD`                                     | global kill-switch seed             | 5                          | Also editable in admin (`app_settings`)                            |
| `BACKGROUND_FN_SECRET`                                    | invoking background functions       | invocations rejected       | `openssl rand -hex 32`                                             |
| `CRON_SECRET`                                             | scheduled → background hand-off     | rejected                   | `openssl rand -hex 32`                                             |
| `RESEND_API_KEY` / `EMAIL_FROM_DOMAIN`                    | email                               | mock sender (logged)       | Domain must be verified in Resend                                  |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`             | UK billing                          | mock checkout              | Use `sk_test_` until the pricing go/no-go                          |
| `STRIPE_PRICE_GROWTH_GBP` / `STRIPE_PRICE_ADVANCED_GBP`   | checkout                            | mock                       | Price IDs from the Stripe dashboard                                |
| `PAYSTACK_SECRET_KEY`                                     | NG billing                          | mock checkout              | Test key first; live needs an eligible business                    |
| `PAYSTACK_PLAN_GROWTH_NGN` / `PAYSTACK_PLAN_ADVANCED_NGN` | NG subscriptions                    | mock                       | Plan codes from Paystack                                           |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`    | product analytics                   | off                        | EU cloud; loads only after cookie consent                          |
| `SENTRY_DSN`                                              | error monitoring                    | off                        |                                                                    |
| `FOUNDER_ADMIN_EMAILS`                                    | `/admin` access                     | nobody is admin            | Comma-separated                                                    |

Build-time only (set automatically): `CONTEXT` (Netlify) → `NEXT_PUBLIC_APP_ENV`.

Test-only: `TEST_DATABASE_URL` (defaults to the local Supabase stack), `ALLOW_REMOTE_TEST_DB=1` (for a dedicated test project only), `E2E_BASE_URL` (runs e2e against a deployed preview).
