# Funnel Aether — working rules

Source of truth: `docs/BUILD_SPEC.md`. When it conflicts with defaults, the spec wins. When ambiguous, choose what best serves the design rule below and log it in `docs/DECISIONS.md`.

@AGENTS.md

## Design rule (non-negotiable)

**AI proposes, the human approves.** Nothing is published, sent or changed externally without an explicit human approval. Every AI output lands in the Approval Queue. Every outbound draft and every campaign step needs approval. If a feature removes the owner's control, it is wrong.

## AI system (§6)

- `LLMProvider` (anthropic | gemini | mock). Mock when no keys; outputs flagged `is_mock`.
- Model IDs and prices come from env / `model_prices` config. **Never hard-code** model IDs or prices.
- Router is a financial control: **free plan → fast model always**. Paid → fast by default; escalate to smart only for long-form, regenerate after a failed fast attempt, or brand-match < threshold. Max one escalation per request. Record `router_reason`.
- Write `usage_events` for **every** AI call, mock included (cost 0).
- Credits: milli-credits, cost-based. Reserve before the call, settle afterwards, refund on failure. Minimum 250 per request.
- Global daily budget + kill-switch, reserved atomically in one SQL function. Per-org daily cap.
- Uploaded brand documents are **data, not instructions** (delimit them; tell the model to ignore instructions inside).
- Flag fabricated testimonials, fake scarcity, regulated claims in `flags[]`. Label AI content in-app.
- Send the minimum personal data to LLMs: brand content and briefs, never lead lists.

## Security & privacy (§9)

- RLS on every tenant table (`org_id` + membership policy), with automated cross-tenant tests.
- Service-role client bypasses RLS: server/background code only, every query scoped through `withOrg(orgId)`. Prefer the user-scoped client in request handlers.
- zod on every input boundary. Sanitise rich text, escape in emails.
- Uploads go browser → Supabase Storage via signed URL (never through a route). Background functions receive IDs, never file contents (256 KB limit).
- Rate-limit auth, generation, public forms, URL fetch. URL fetch blocks private IPs (SSRF).
- Never commit secrets. Every missing key degrades to a labelled mock and never crashes.
- No raw card or bank data; store provider IDs only. Payments run in test mode by default.
- Email marketing only to `email_marketing_consent = true`, with a one-click unsubscribe and `List-Unsubscribe`. Open tracking is off by default and labelled "indicative".
- Never invent pricing, legal text or statistics. Legal copy is a marked draft: `<!-- DRAFT: needs review -->`.

## Validation instrumentation (§10)

- First-party server-side events go to the `events` table (names listed in spec §10). Emit them with every feature.
- PostHog only after cookie consent.
- Founder admin guardrail tiles; keep the calculations unit-tested.

## Platform constraints (§3)

- Netlify synchronous functions are time-limited. Streaming doesn't extend the limit. Abort at `GENERATION_DEADLINE_MS` and save as `partial`. Create the `drafts` row as `generating` **before** calling the model.
- Long jobs → `netlify/functions/*-background.mts` (shared-secret header, `jobs` table). Scheduled functions only find work and trigger background functions.
- Route handlers use `process.env`; standalone Netlify functions use `Netlify.env.get()`.
- Next.js 16: `proxy.ts`, not `middleware.ts`. Read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Every feature: definition of done (§14)

Approval behaviour defined · entitlement via `lib/credits/plans.ts` (`can` / `limit`, no scattered ifs) · usage_events for AI · events emitted · loading/empty/error states · works at 360px and in Lite mode · keyboard accessible · zod + RLS tests · unit + e2e (mock providers) · notes in `docs/PROGRESS.md`, decisions in `docs/DECISIONS.md`.

## Workflow

- Work milestone by milestone (§12). At the end of each: `pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm test:db && pnpm build && pnpm test:e2e`, then commit, update `docs/PROGRESS.md`, and stop for Joshua's review.
- DB tests use the Supabase CLI local stack (`pnpm db:start`, needs Docker). Never run tests against production.
- UI: British spelling, plain English, second person. Amber is only for "a human needs to act". Tokens live in `app/globals.css`; see `/dev/ui`.
