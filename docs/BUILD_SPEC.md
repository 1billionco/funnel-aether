# Funnel Aether — Build Specification for Claude Code

> **Read this whole file before writing any code.** It is the single source of truth for building Funnel Aether v1 (live validation build). When something here conflicts with your defaults, this file wins. When something is ambiguous, pick the option that best serves the **design rule** in §1 and note the decision in `docs/DECISIONS.md`.

Owner: Joshua Adoghe (founder). Builder: Claude Code, pair-programming with Joshua.
Goal: a **live, multi-tenant, production-quality validation build** hosted on Netlify, used by real UK and Nigerian micro/small businesses during a closed/open beta to test the venture's hypotheses (activation, time-to-value, willingness to pay, cost per user).

---

## 0. How to work

1. Work **milestone by milestone** (§12). At the end of each milestone: run lint, typecheck, unit tests and e2e tests; commit with a clear message; write a short summary in `docs/PROGRESS.md`; then **stop and give Joshua a summary + anything he must do manually** (create an account, paste a key, verify a domain) before continuing.
2. In Milestone 0, create a concise `CLAUDE.md` at repo root holding the non-negotiables from §1, §6, §9 and §10 so they persist across sessions.
3. Never commit secrets. Every external service must have a **mock/fallback mode** so the app runs end-to-end locally with zero keys (this preserves what the earlier demo build did with `is_mock: true`).
4. Never invent pricing, legal text or statistics. Where legal copy is needed, write a clearly marked draft (`<!-- DRAFT: needs review -->`) for Joshua.
5. Verify current library and API details (model IDs, SDK signatures, Netlify/Next.js adapter behaviour) against official docs before relying on memory. Model IDs live in env vars, never hard-coded.
6. Prefer boring, well-supported choices. No new paid services beyond those listed in §3 without asking.

### Prior work to reuse (reference, don't redeploy)
- `1billionco/funnel-aether-backend` (FastAPI + SQLAlchemy + Chroma). **Do not deploy it.** Port its logic into TypeScript: brand-voice profile/document model, chunking, retrieval, the brand-alignment quality score, the transparent heuristic lead-scoring function, the analytics guardrail definitions, and the Sarah/Chinedu seed data. Bugs already fixed there (table creation, upload renaming a brand, stale counts from missing flush) must not reappear.
- `funnel-aether-frontend` (Next.js 16 + Tailwind v4, 6 pages, persona switcher). If present in the workspace, use it as the starting point and refactor to this spec; otherwise scaffold fresh. Remove the persona switcher in favour of real auth (keep seeded demo accounts).

---

## 1. Product in one page

**What it is:** an AI-powered, all-in-one marketing platform for micro and small businesses (0–49 employees) in the UK and Nigeria — brand voice, content, lead capture and scoring, campaigns, and analytics on one data layer.

**Design rule (non-negotiable): AI proposes, the human approves.** Nothing is published, sent or changed externally without an explicit human approval. Every AI output lands in the **Approval Queue**. If a feature would remove the owner's control, it is wrong.

**Positioning:** we win on integration depth and overseen automation, not on being cheapest. Don't gold-plate; make the core loop excellent.

**The core loop to optimise (this is what validation measures):**
`Sign up → Onboard brand (≤5 min) → First AI draft → Approve → Capture first lead → Send first campaign` — target **time-to-value ≤ 7 days**, ideally the same session.

**Two users (requirements, not decoration):**
| Persona | What the system must do |
|---|---|
| **Chinedu** — Lagos micro-retailer, phone-only, patchy data, WhatsApp-driven, NGN, cash-flow sensitive | Mobile-first; "Lite mode" for low bandwidth; WhatsApp-ready outputs and click-to-chat links; NGN prices; pay-as-you-go credit packs; plain-language analytics |
| **Sarah** — UK accountancy practice owner, 7 staff, Mailchimp + CRM + LinkedIn in silos, GBP | Full desktop dashboard; consistent brand voice across team members; seats; ROMI-style reporting; UK GDPR/PECR-compliant data handling |

---

## 2. Scope of this build

### In scope (must ship live)
1. Auth, organisations (tenants), seats/roles, onboarding wizard.
2. Brand Voice: questionnaire + document/sample upload → chunk → embed → retrieval (RAG); brand profile summary; training-quality score.
3. Content Studio: generate posts, emails, WhatsApp messages, landing-page copy, SEO briefs, grounded in brand voice; streaming output.
4. Approval Queue: approve / edit-then-approve / reject / regenerate-with-feedback; full audit trail; keyboard shortcuts; mobile swipe.
5. Model router + credit metering + per-tenant cost telemetry + global spend kill-switch.
6. Leads: hosted lead-capture pages and embeddable forms per brand; manual add; CSV import/export; heuristic scoring with explanation; lead timeline.
7. Campaigns: email sequences (real sending via Resend) to consented leads; WhatsApp and social as **approved, ready-to-post assets** (copy + click-to-chat link / copy-to-clipboard / reminder), not API auto-posting.
8. Analytics: plain-language overview, content and lead metrics, simple attribution (form source/UTM → lead → campaign), weekly summary.
9. Plans & billing: Free Starter / Growth / Advanced; Stripe (GBP) and Paystack (NGN) checkout in **test mode by default**, switchable to live via env; NGN credit packs.
10. Founder Admin: guardrail dashboard, funnel, cost telemetry, users, beta controls.
11. Marketing site: landing page, pricing, privacy/terms drafts, waitlist/invite-code gating.
12. Product analytics + in-app feedback.

### Out of scope now (design for, don't build)
Auto-posting to LinkedIn/Instagram/Facebook (needs platform app review), WhatsApp Business Cloud API sending, SMS/USSD, self-hosted models, Nigerian in-country data residency (documented as a known gap — §9), full attribution modelling, native mobile apps.

Build these behind clean interfaces (`ChannelAdapter`, `LLMProvider`, `PaymentProvider`, `EmbeddingProvider`) so they can be added without refactors.

---

## 3. Architecture and stack

**Why this shape:** Netlify runs a Next.js app plus TypeScript/Go serverless functions. It cannot run the old FastAPI + Chroma + local sentence-transformers stack. So the live build is **one full-stack Next.js app on Netlify** with a managed Postgres.

| Layer | Choice | Notes |
|---|---|---|
| App | **Next.js 16 (App Router) + TypeScript (strict) + Tailwind CSS v4** | Server Components by default; Route Handlers / Server Actions for APIs. Deployed via Netlify's Next.js runtime. |
| UI kit | **shadcn/ui** (Radix primitives) restyled to §7, **lucide-react** icons, **Recharts** (lazy-loaded) | No other component libraries. |
| DB / Auth / Storage | **Supabase** (Postgres + **pgvector** + Auth + Storage + Realtime) | Region: London (eu-west-2). Row Level Security on every tenant table. **Free projects pause after a period of inactivity and have no automated backups** — fine for development; production must be on Supabase Pro before real users join (flag this to Joshua at M9). |
| Generation LLM | **Anthropic Claude** (primary), router Haiku-class ≈85% / Sonnet-class ≈15% | Env: `LLM_MODEL_FAST`, `LLM_MODEL_SMART`. Suggested defaults `claude-haiku-5-5` / `claude-sonnet-5-5` — **verify current IDs and prices in Anthropic docs**. |
| Fallback LLM | **Google Gemini (Flash-class)** via `LLMProvider` | Optional, used only if `GEMINI_API_KEY` set and Anthropic fails/over budget. Off by default for real user data (see §9). |
| Mock LLM | Deterministic template generator | Used when no keys; responses flagged `is_mock`. |
| Embeddings | **Voyage AI `voyage-4-lite`**, `output_dimension = 1024` | Generous free token allowance. Mock: deterministic hash embeddings (clearly labelled) for local/dev. |
| Email | **Resend** (transactional + campaign sends) | Verified sending domain; per-tenant "from name", reply-to = owner email. |
| Payments | **Stripe** (GBP) + **Paystack** (NGN) | Test mode default. Webhooks → subscriptions table. **Business prerequisite:** a live Paystack account normally needs a business registered in a Paystack country (e.g. CAC-registered in Nigeria) with a local bank account. Build the integration in test mode regardless; Joshua confirms eligibility before M7 goes live. |
| Product analytics | **PostHog** (EU cloud) | Only after cookie consent; server-side events for key funnel steps regardless (first-party, in our DB). |
| Errors | **Sentry** (free tier) | Optional via env. |
| Rate limiting | Postgres-backed token bucket (or Upstash Redis if added later) | Per user + per IP on auth, generation, public forms. |
| Validation | **zod** on every input boundary | Shared schemas client/server. |
| Tests | **Vitest** (unit), **Playwright** (e2e, mock providers) | CI on GitHub Actions. |

### Netlify constraints you must design around
- Synchronous functions have a hard execution limit of roughly **30 seconds** (check current docs). **Streaming improves time-to-first-token but does NOT extend that limit** — the whole request must still finish inside it. Therefore:
  - Short outputs (posts, WhatsApp messages, short emails, fast model) → stream from a Route Handler; set `max_tokens` per output type so p95 completion is < 20 s; abort cleanly at 25 s and save what was produced with status `partial` + a "Continue" action.
  - Long outputs (landing copy, SEO briefs, multi-variant or smart-model requests) → run in a **Background Function**; write progressive text to the draft row; the UI subscribes via **Supabase Realtime** (or polls) to show it appearing.
  - Create the `drafts` row with status `generating` **before** calling the model. Do not rely on code running after the client disconnects — a serverless function may be frozen. A scheduled sweeper marks drafts stuck in `generating` > 2 min as `failed` and refunds credits.
- Long jobs (document extraction + embedding, weekly analytics summaries, bulk CSV import, campaign batch sends) → **Netlify Background Functions** (`-background` suffix, up to 15 min) writing status to a `jobs` table. Background functions have a **256 KB payload limit**: pass IDs, never file contents. They are separate files in `/netlify/functions` (not Next.js routes); invoke them over HTTP with a shared secret header and verify it.
- Scheduled work → **Netlify Scheduled Functions** (≈30 s limit, run only on published deploys, schedules are in UTC): each scheduled function only *finds work and triggers a background function*; it never does the heavy work itself. Jobs: campaign step dispatcher (every 10 min), stuck-draft sweeper (every 5 min), dormancy pruning (daily), weekly summary (Mondays, convert 06:00 Europe/London to UTC and account for BST), credit grants (daily check of billing period).
- Request bodies to synchronous functions are capped at **6 MB** — file uploads must go **directly from the browser to Supabase Storage** via signed upload URLs, never through a Next.js route.
- Netlify functions run in `us-east-1` by default while the database is in London: every DB round trip costs ~70–90 ms. Minimise round trips per request (one RPC/SQL function over several queries), and check whether your Netlify plan lets you set the functions region to `eu-west-2`.
- Verify on Netlify's current docs that Background Functions are available on the plan Joshua is using; if not, the fallback is Supabase Edge Functions or a Supabase `pg_cron` + queue pattern — ask before switching.
- Inside Next.js route handlers use `process.env`; inside standalone Netlify functions use `Netlify.env.get()`; document all env vars in `.env.example`.
- Next.js 16 changed some conventions (e.g. middleware → `proxy`). Check the current Next.js and `@supabase/ssr` docs for the correct session-refresh setup before writing auth code.

### Folder layout (target)
```
/app
  /(marketing)        landing, pricing, legal, waitlist
  /(auth)             sign-in, sign-up, magic-link callback, invite
  /(app)/[org]        today, review, create, brand, leads, campaigns, analytics, settings, billing
  /(admin)/admin      founder-only
  /f/[slug]           public hosted lead form / mini landing page
  /api/...            route handlers (generate stream, webhooks, form submit, export)
/components           ui/, app/, charts/, marketing/
/lib
  /ai                 provider.ts, anthropic.ts, gemini.ts, mock.ts, router.ts, prompts/, quality.ts
  /embeddings         voyage.ts, mock.ts, chunker.ts, retrieve.ts
  /credits            meter.ts, ledger.ts, plans.ts
  /leads              scoring.ts (ported heuristic, with explanation output)
  /channels           email-resend.ts, whatsapp-assets.ts, social-assets.ts, adapter.ts
  /billing            stripe.ts, paystack.ts, entitlements.ts
  /analytics          events.ts, guardrails.ts
  /db                 supabase clients (server/browser/service), typed queries
/netlify/functions    background + scheduled functions
/supabase/migrations  SQL migrations (schema, RLS, pgvector, seed)
/tests                unit/, e2e/
/docs                 DECISIONS.md, PROGRESS.md, RUNBOOK.md, ENV.md
```

---

## 4. Data model (Postgres / Supabase)

Every tenant-scoped table has `org_id uuid not null` + RLS policy: user must be a member of `org_id`. Use `created_at`, `updated_at` everywhere. Soft-delete where audit matters.

- `organizations` — id, name, slug, market (`UK`|`NG`), currency (`GBP`|`NGN`), timezone, plan (`free`|`growth`|`advanced`), plan_period_start/end, lite_mode_default bool, status (`active`|`dormant`|`pruned`), last_active_at.
- `memberships` — org_id, user_id, role (`owner`|`editor`|`reviewer`), invited_by.
- `profiles` — user_id, full_name, avatar, onboarding_state jsonb, is_founder_admin bool.
- `brands` — org_id, name, industry, audience, tone_sliders jsonb (formal↔casual, playful↔serious, concise↔detailed, bold↔reassuring), do_say[], dont_say[], compliance_rules[], example_ctas[], summary (AI-generated, human-approved), training_quality_score 0–100, document_count.
- `brand_documents` — brand_id, filename, mime, storage_path, char_count, status (`queued`|`processing`|`ready`|`failed`), error.
- `brand_chunks` — org_id, brand_id, document_id, content, token_count, embedding `vector(1024)`, **embedding_model** (e.g. `voyage-4-lite` or `mock`). HNSW index (cosine). Retrieval must filter by `brand_id` **and** `embedding_model = current model` — mock and real vectors are not comparable. Provide an admin "re-embed brand" job for when the model changes. Do retrieval in a SQL function (`match_brand_chunks`) and, with HNSW plus a filter, check that k results are actually returned (pgvector iterative scan or a fallback exact search for small brands).
- `drafts` — org_id, brand_id, type (`social_post`|`email`|`whatsapp`|`landing_copy`|`seo_brief`|`campaign_step`), channel, title, body, metadata jsonb (platform, hashtags, subject line, CTA), status (`generating`|`partial`|`failed`|`pending`|`approved`|`rejected`|`scheduled`|`sent`|`posted`|`archived`) — `posted` is set when the owner taps "Mark as posted" on a social/WhatsApp asset they published manually (otherwise analytics can't count published content), brand_match_score, model_used, credits_used, is_mock, created_by, approved_by, approved_at.
- `draft_versions` — draft_id, version, body, source (`ai`|`human_edit`|`ai_regen`), feedback_text, model_used.
- `approval_events` — audit log: draft_id, actor, action (`approve`|`edit`|`reject`|`regenerate`|`schedule`|`send`), note, at.
- `forms` — org_id, brand_id, slug, title, fields jsonb, consent_text, thank_you, is_active, theme.
- `leads` — org_id, name, email, phone, whatsapp_opt_in, email_marketing_consent bool + consent_text + consent_at + source_ip_hash, source (`form`|`manual`|`import`), form_id, utm jsonb, company, notes, score 0–100, score_band (`hot`|`warm`|`cold`), score_reasons jsonb, status (`new`|`contacted`|`qualified`|`customer`|`lost`), unsubscribed_at.
- `lead_events` — lead_id, type (`created`|`email_sent`|`email_opened`|`clicked`|`status_change`|`note`), payload, at.
- `campaigns` — org_id, brand_id, name, goal, channel (`email` now), audience_filter jsonb, status (`draft`|`awaiting_approval`|`active`|`paused`|`completed`).
- `campaign_steps` — campaign_id, order, delay_hours, draft_id (must be approved before activation).
- `sends` — campaign_step_id, lead_id, provider_message_id, status, opened_at, clicked_at, error.
- `credit_ledger` — org_id, delta (+grant/−spend), reason (`monthly_grant`|`generation`|`pack_purchase`|`refund`|`admin_adjust`), ref_id, balance_after.
- `usage_events` — org_id, user_id, feature, provider, model, input_tokens, output_tokens, cached_tokens, est_cost_usd, latency_ms, is_mock, router_reason.
- `subscriptions` — org_id, provider (`stripe`|`paystack`), provider_customer_id, provider_sub_id, plan, status, current_period_end, cancel_at.
- `jobs` — org_id, type, status, progress, result jsonb, error.
- `events` — first-party product events (see §10), org_id, user_id, name, props jsonb, at.
- `feedback` — org_id, user_id, kind (`nps`|`bug`|`idea`|`draft_rating`), score, text, page.
- `beta_invites` — code, max_uses, used_count, market, expires_at.
- `app_settings` — singleton: signup_mode (`open`|`invite`|`closed`), max_orgs, ai_daily_budget_usd, ai_kill_switch.

Write migrations as SQL in `/supabase/migrations`. Generate TypeScript types from the schema. Include RLS tests (a user from org A cannot read/write org B — write these as automated tests).

---

## 5. Plans, entitlements and credits

Encode in `lib/credits/plans.ts` as **config, not scattered `if`s**. Every gated feature calls `can(org, 'feature')` / `limit(org, 'contacts')`.

| Entitlement | Free Starter | Growth | Advanced |
|---|---|---|---|
| Price | £0 / ₦0 | **£29 / ₦15,000** per month | **£79 / ₦25,000** per month |
| Brands | 1 | 3 | 10 |
| Contacts (leads) | 100 | 2,500 | 10,000 |
| AI credits / month | UK 15 · NG 10 (fast model only) | 250 (full router) | 1,000 + overage packs |
| Channels | 1 (email or WhatsApp assets) | Email + social + WhatsApp assets | All + API access (later) |
| Analytics history | 7 days | 12 months + lead scoring | + cohorts + attribution-lite |
| Campaign sequences | 1 active, 2 steps | 5 active | Unlimited |
| Seats | 1 | 1 | 3 |
| Human element | Approval queue | + onboarding webinar booking link | + monthly 60-min strategist review booking link |

- NG prices are shown in NGN; UK in GBP. Market is chosen at onboarding, editable until the first payment, then locked for billing (geo-fence: Paystack only for NG orgs; Stripe only for UK orgs; flag mismatch between declared market and payment country for admin review rather than blocking).
- **NG credit packs** (pay-as-you-go): e.g. 50 / 150 credits via Paystack one-off payment. Prices configurable in admin — leave as placeholders for Joshua to set.
- **Credits are cost-based, not token-based**, so the smart model (≈2× the price) consumes proportionally more and a credit always protects the margin. Define `CREDIT_VALUE_USD` (default **0.002**, ≈ one-third of a standard fast-model generation at Appendix C.2 prices, matching "1 credit ≈ 3–4 typical generations" in Appendix C.5). Store credits as integers in **milli-credits** to avoid rounding errors. `cost_millicredits = ceil(est_cost_usd / CREDIT_VALUE_USD × 1000)`, minimum 250 (¼ credit) per request. Reserve the estimated cost before calling the model, settle to actual usage afterwards, refund on failure. Display credits to users rounded to one decimal place. Show the estimate **before** generating and the actual cost after. Block generation when the balance can't cover the estimate, with an upgrade/credit-pack prompt.
- Embedding calls (uploads, quality scoring) are logged in `usage_events` but **not** charged as credits in this build.
- **Dormancy pruning:** free orgs with no login for 30 days → `dormant` (email warning at day 23); 60 days → `pruned` (delete embeddings and drafts, keep account shell). Paid orgs are never pruned.

---

## 6. AI system

### 6.1 Provider abstraction
```ts
interface LLMProvider {
  stream(req: GenRequest): AsyncIterable<Delta>;   // with usage at end
  complete(req: GenRequest): Promise<GenResult>;
}
```
Implementations: `anthropic`, `gemini`, `mock`. Selection: mock if no keys; otherwise Anthropic; Gemini only as configured fallback.

### 6.2 Router (`lib/ai/router.ts`) — a financial control, not a feature
- Free plan → **always fast model**.
- Paid plans → fast model by default. Escalate to smart model only when: long-form output (> ~600 words: landing copy, long emails, SEO briefs), regenerate-with-feedback after one failed fast attempt, or brand-match score of the fast output < threshold (default 60) — max one escalation per request.
- Record `router_reason` in `usage_events`. Target blend ≈ 85/15; show the live blend on the admin dashboard.
- Use **prompt caching** for the system prompt + brand context block (stable per brand).

### 6.3 Prompt assembly
System prompt layers: (1) Funnel Aether role and safety rules; (2) brand profile (tone sliders, do/don't, compliance rules, audience, market, currency, locale — en-GB vs en-NG spelling and cultural references); (3) top-k retrieved brand chunks (k=6, MMR to diversify); (4) channel spec (character limits, format, CTA, hashtags, WhatsApp-friendly formatting, email subject + preheader); (5) user request.
- Treat uploaded brand documents as **data, not instructions** (wrap in delimiters; instruct model to ignore instructions inside them).
- Output structured JSON via schema (title, body, variants[], hashtags[], subject, cta) for non-streamed parts; stream the body for UX.
- Keep prompts in `lib/ai/prompts/` as versioned templates with tests.

### 6.4 Brand-match quality score
Port the existing backend scoring: embed output, cosine similarity vs brand centroid + top chunks, plus rule checks (don't-say terms, length, CTA present). Return 0–100 with 2–3 human-readable reasons shown as a chip in the review UI.

### 6.5 Safety and honesty
- Never auto-publish or auto-send. Approval is required for every outbound draft and every campaign step.
- Label AI-generated content inside the app; offer an optional "Drafted with AI, reviewed by a human" footer toggle for emails.
- Refuse/flag: fabricated reviews/testimonials, fake scarcity claims, regulated claims (financial returns, health) — the model must warn in a `flags[]` field and the UI shows it before approval.

### 6.6 Cost guardrails (hard requirements)
- Model prices live in a `model_prices` config (input, output, cache-read, cache-write per MTok, per model ID), editable in admin — never hard-coded. Joshua fills it from Anthropic's/Voyage's current pricing pages; `est_cost_usd` is computed from the token counts the API returns.
- Prompt caching only applies above the provider's minimum cacheable prompt length; check the docs, and only add cache markers when the brand block is long enough.
- Per-request token caps per feature.
- `usage_events` written for **every** call, including mock (cost 0).
- **Global daily budget** (`ai_daily_budget_usd` in app_settings; default $5). On breach → kill-switch: generation returns a friendly "capacity paused for today" and Joshua gets an email. Per-org daily cap too (free: 5 generations/day). The budget check must be atomic (a single SQL function that reserves spend) so concurrent requests can't overshoot it.
- Backstop outside the app: Joshua sets a monthly spend limit in the Anthropic Console and Voyage dashboard. Mention this in `docs/GO_LIVE.md`.
- Admin tile: free-tier cost per active free user per month (**guardrail ≤ £0.30**) and per paying user (targets UK ≈ £2.85, NG ≈ £1.95).

---

## 7. Front-end design (make it distinctive, not template-y)

### 7.1 Design concept: "calm control"
The product promise is *overseen automation*. The UI should feel calm, editorial and trustworthy — like a well-run studio, not a busy martech cockpit. Human decisions are visually central; AI is the quiet assistant around them.

### 7.2 Tokens (define as CSS variables in Tailwind v4 `@theme`; full dark mode)
- **Paper** background `#F7F5F0` (light) / `#111318` (dark); **Surface** `#FFFFFF` / `#181B22`; **Ink** text `#15171F` / `#ECEDEF`; **Muted** `#6B6F7B` / `#9A9EA8`; **Line** `#E6E2D8` / `#262A33`.
- **Aether teal** (primary, actions, AI) `#0F766E`, hover `#0B5F58`, tint `#E6F2F0`.
- **Signal amber** (needs your decision / pending approval) `#D97706`, tint `#FDF3E1`. Amber is reserved for "a human needs to act" — never decorative.
- **Approve green** `#15803D`; **Reject/Danger** `#B42318`; **Info** `#3B5BDB`.
- Type: **Fraunces** (display headings, numbers on hero tiles), **Geist Sans** (UI), **Geist Mono** (credits, IDs, metrics). Scale 12/14/16/20/24/32/44. Body 15–16px, line-height 1.55.
- Radius 10px (cards), 8px (inputs), full (chips). Shadows minimal; use 1px lines and spacing for structure. 8px spacing grid.
- Motion: 150–200ms ease-out; respect `prefers-reduced-motion`.
- Accessibility: WCAG 2.1 AA contrast, visible focus rings (teal 2px offset), full keyboard support, aria labels, 44px min touch targets.

### 7.3 Layout
- **Desktop (≥1024px):** left sidebar (collapsible) — Today, Review *(amber count badge)*, Create, Brand, Leads, Campaigns, Analytics; bottom: Credits meter, Plan, Settings. Top bar: org switcher, global "Create" button (⌘K command palette), help, avatar.
- **Mobile (<768px):** bottom tab bar with 4 tabs — **Today · Review · Create · Leads** (others in "More"). Large tap targets, sticky primary action.
- **Lite mode** — decided **on the server** so there's no flash or hydration mismatch: on if the user's setting/cookie says so, or the request carries the `Save-Data: on` header, or (first visit only) the org is NG. `navigator.connection` is only a client-side hint (unsupported in Safari/Firefox): use it to *suggest* switching on, then set the cookie. Load fonts conditionally in the root layout based on that server decision. In Lite mode: no web fonts beyond system stack, no charts (replace with plain-language sentences and simple CSS bars), no images/avatars, paginate lists at 10, defer non-critical JS. Target < 150 KB gzipped JS on Today/Review in Lite mode — measure it with the bundle analyser in CI rather than assuming.

### 7.4 Screens (build each with loading, empty, error and success states)
1. **Today (home)** — greeting with date; a single "Next best step" card driving the core loop (e.g. "Approve your first draft"); **Waiting for you** (pending approvals, amber); **New hot leads**; **This week** in plain language ("You published 4 posts and captured 7 leads; 2 are hot"); credits remaining ring; onboarding checklist until the core loop is complete.
2. **Review (Approval Queue)** — the heart of the product. Inbox-style split view: list (filter by type/channel/brand/status) + detail pane showing the draft in a realistic channel preview (LinkedIn post card, email with subject/preheader, WhatsApp bubble), brand-match chip with reasons, flags, model used, credits used, version history diff. Actions: **Approve (A)**, **Edit (E)** inline rich editor, **Reject (R)** with optional reason, **Regenerate with feedback (G)**, Schedule. Bulk approve for low-risk items. Mobile: card stack with swipe right = approve, left = reject, tap = edit (with undo toast).
3. **Create (Content Studio)** — choose output type → short brief (goal, offer, audience, channel; smart defaults from brand) → see estimated credits → generate with **streamed** output and 2–3 variants → "Send to Review". Templates gallery tuned per market (e.g. "Weekend promo for WhatsApp Status", "LinkedIn insight post for accountants").
4. **Brand** — brand profile card (summary the owner approved), tone sliders, do/don't lists, compliance rules, documents list with processing status, training-quality score with tips to improve ("Add 3 past emails to lift your score"). Multi-brand switcher on Growth+.
5. **Leads** — table (desktop) / cards (mobile): name, source, score band chip with "why" tooltip, status, consent icons, last activity. Lead detail drawer: timeline, notes, status, actions (add to campaign, open WhatsApp click-to-chat, email). Forms tab: create/edit hosted form, copy link, embed snippet, QR code download. Import/export CSV.
6. **Campaigns** — list + builder: pick audience (filters on score/status/source/consent), add steps (each step's draft generated → must be approved in Review), delays, activate (blocked until all steps approved and audience has consent). Per-campaign stats.
7. **Analytics** — plain-language headline first, then tiles and charts: leads over time by source, content approved/published, campaign sends/opens/clicks, lead→customer conversions, simple attribution table (form/UTM → leads → customers). Weekly summary archive. Free plan limited to 7 days with a gentle upgrade hint.
8. **Billing** — current plan, credits ledger, usage this period, upgrade/downgrade, Stripe portal (UK) / Paystack management (NG), credit packs (NG).
9. **Settings** — profile, organisation (market locked after first payment), team & seats (Advanced: invite by email, roles owner/editor/reviewer), notifications, Lite mode, **Data & privacy**: export all data (JSON+CSV zip), delete organisation (with confirmation and grace period).
10. **Onboarding wizard** (≤5 minutes, progress bar, skippable steps): market & currency → business basics → brand questionnaire (tone sliders, audience, what you sell, words to use/avoid) → upload 1–5 samples or paste text or a website URL (fetch & extract text server-side) → AI writes a brand summary → owner approves/edits it → generate first draft → land in Review with a celebratory but restrained moment.
11. **Public hosted form `/f/[slug]`** — fast, mobile-first, brand-coloured, consent checkbox (unticked by default), honeypot + rate limit, thank-you page with optional WhatsApp click-to-chat.
12. **Admin (founder only)** — see §10.
13. **Marketing site** — landing page (hero: "Your whole marketing funnel in one place — AI drafts, you decide."), how it works (5 phases: Attract, Convert, Engage, Analyse, Optimise with AI vs human columns), personas-based use cases (UK services / NG retail), pricing table with GBP/NGN toggle (auto by geo hint), FAQ, waitlist/invite-code sign-up, privacy and terms drafts.

### 7.5 Microcopy rules
Plain English, second person, short. Name the human's role explicitly ("You approve everything before it goes out"). No jargon on Free/NG surfaces ("people who filled your form", not "MQLs"). British spelling in UI. Currency always formatted per org (`£29`, `₦15,000`).

---

## 8. Functional detail by funnel phase (epic map)

| Phase | AI executes | Human decides (UI surface) | Build now |
|---|---|---|---|
| **Attract** | Content drafts, SEO briefs, post variants | Approve voice and claims (Review) | ✅ |
| **Convert** | Lead scoring with reasons, form copy suggestions | Define offer, form fields, qualification thresholds (Leads → Forms / Settings) | ✅ |
| **Engage** | Email sequence drafts, send-time suggestion | Frequency, tone boundaries, approve each step, activate (Campaigns) | ✅ email · WhatsApp/social as approved assets |
| **Analyse** | Weekly plain-language summary, anomaly flags (e.g. "leads down 40% vs last week") | Interpret meaning, mark what to act on (Analytics) | ✅ |
| **Optimise** | Experiment proposals ("try a shorter subject line") as drafts | Approve trade-offs (Review) | ✅ lightweight: suggestions become drafts |

Lead scoring: port the backend heuristic (source quality, completeness, engagement events, recency, consent) → 0–100 → bands hot ≥70, warm 40–69, cold <40; always store and display `score_reasons`. Owner can adjust weights in settings (Advanced).

Email sending rules (UK PECR / good practice): send only to leads with `email_marketing_consent = true`; every campaign email includes unsubscribe link (one-click, `List-Unsubscribe` header) and the sender's business name and address; honour unsubscribes immediately; throttle per org; bounce/complaint webhooks from Resend update lead status. Free plan: sends capped (e.g. 100/month) to protect domain reputation.
- All tenants send from Joshua's verified domain (e.g. `hello@mail.funnelaether.com` with the business's name as display name and reply-to set to the owner). One bad tenant can damage deliverability for everyone: auto-pause an org's sending if its bounce rate > 5% or any spam complaint arrives, and show it in admin. Check Resend's current free-tier daily/monthly send limits and enforce a global cap below them.
- **Click tracking is the primary engagement metric.** Open tracking (pixels) is unreliable because of Apple Mail Privacy Protection, and the ICO treats tracking pixels as needing consent under PECR — make open tracking off by default and label any open rates as "indicative".

---

## 9. Security, privacy and compliance

- Supabase RLS on all tenant tables; service-role key used **only** in server code/background functions; never exposed to the client. **The service role bypasses RLS**, so every query using it must filter by `org_id` explicitly — wrap it in a helper (`withOrg(orgId)`) and add tests that background jobs can't touch another org's rows. Prefer the user-scoped client in request handlers.
- Uploads: browser → Supabase Storage via signed upload URL (private bucket, path `org_id/brand_id/…`, storage RLS policies); a background function extracts text and embeds it. Delete the original file after successful extraction unless the owner chooses to keep it (data minimisation).
- Auth: email magic link + Google OAuth; optional password. Email verification required before sending campaigns.
- Validate everything with zod; sanitise rich text (allow-list); escape in email templates.
- Rate limit sign-up, sign-in, generation, form submission, URL fetch. URL fetch: block private IP ranges (SSRF protection), size/time limits.
- File uploads: allow PDF, DOCX, TXT, MD, CSV; max 10 MB (enforced in the signed-URL request and the storage bucket policy); virus-scan stub interface; text extraction in a background function with a page/character cap.
- Secrets only in Netlify env vars; `.env.example` documents each.
- Security headers: HSTS, Referrer-Policy, `X-Content-Type-Options`, and a CSP using `frame-ancestors 'none'` everywhere except `/f/*` (embeddable: `frame-ancestors *`). A strict nonce-based CSP forces dynamic rendering in Next.js — start with a CSP that allows Next's scripts via `'self'` plus the third-party hosts actually used, and tighten later; document the choice.
- **UK GDPR / DPA 2018 & PECR:** privacy notice draft, lawful basis per data type documented in `docs/PRIVACY_NOTES.md`, data export and deletion self-serve, consent records stored with text and timestamp, cookie banner (PostHog only after consent).
- **Nigeria Data Protection Act 2023:** same self-serve rights; privacy notice section for Nigerian users; **known gap documented**: data is stored in the UK region for this validation build; in-country residency for payment/personal data is a later milestone. Paystack holds NG card/payment data, not us.
- **International transfers:** "data lives in London" is only true for the database. Netlify functions (US by default), Anthropic, Voyage, Resend, PostHog and Sentry also process personal data, much of it in the US. List every sub-processor, its location and the transfer basis in `docs/PRIVACY_NOTES.md` and the privacy notice draft. Send the minimum personal data to LLMs (brand content and briefs, not lead lists).
- **Controller vs processor:** Funnel Aether is a *controller* for account data and a *processor* for the leads each business collects. The terms draft must include a data processing agreement (DPA) section; flag this for legal review.
- **Business admin Joshua must do (list in `docs/GO_LIVE.md`, don't build):** pay the ICO data protection fee before processing real users' data; check whether NDPC registration applies; publish privacy notice and terms after review.
- Do not store raw card or bank details anywhere. Store only provider IDs.
- Gemini fallback: before enabling for real customer data, check Google's current API terms for whether free-tier inputs may be used to improve their products; if so, only use paid-tier keys or keep Gemini for internal/dev use.
- Audit log (approval_events + admin actions).
- Write `docs/RUNBOOK.md`: rotating keys, restoring a deleted org within grace period, handling a data-subject request, disabling AI via kill-switch.

---

## 10. Validation instrumentation (build in Milestone 1, not at the end)

### First-party events (in `events` table, server-side)
`signed_up`, `onboarding_started`, `brand_trained`, `onboarding_completed`, `draft_generated`, `draft_approved`, `draft_rejected`, `draft_edited_before_approve`, `form_created`, `lead_captured`, `campaign_activated`, `email_sent`, `first_value_reached` (= first approved draft **and** first lead **or** first campaign send), `upgrade_clicked`, `checkout_started`, `subscription_started`, `subscription_cancelled`, `credits_exhausted`, `credit_pack_purchased`, `feedback_submitted`.

### Founder Admin dashboard (`/admin`, `is_founder_admin` only)
Guardrail tiles with target, current value, and red/amber/green:
| Metric | Guardrail / hypothesis |
|---|---|
| Time-to-value (signup → `first_value_reached`), median | ≤ 7 days |
| Free-to-paid conversion | 5% working hypothesis (4–7% band) |
| Paid churn, monthly | ≤ 3.5% |
| AI support deflection | ≥ 70% — **not measurable in this build** (no support assistant yet); show the tile as "not yet instrumented" |
| Free-tier AI+infra cost per active free user / month | ≤ £0.30 |
| Marginal cost per paying user / month | UK ≈ £2.85 · NG ≈ £1.95 |
| Router blend fast/smart | ≈ 85/15 |
| Approval rate (approved ÷ generated) & edit-before-approve rate | track (quality signal) |

Plus: activation funnel by market (UK vs NG), cohort retention table (weekly), daily AI spend vs budget, kill-switch toggle, signup mode (open/invite/closed), invite-code management, org list with plan/market/last active, feedback inbox, NPS (prompt in-app at day 7 and day 30).

Also: in-app feedback button on every page; thumbs up/down on every draft (feeds `feedback`).

---

## 11. Seed data and demo accounts
Port the two Appendix A personas as seeded orgs (only in dev/preview, and optionally one read-only public demo in production behind a "Try the demo" button that resets nightly):
- **Hartley & Co. Advisory** (Sarah, UK, GBP, Growth plan): brand profile, 3 documents, drafts in mixed states, 25 scored leads, 1 active email campaign.
- **Chinedu Electronics & Home** (Chinedu, Lagos, NGN, Free plan, Lite mode): brand profile, WhatsApp-style drafts, 15 leads with WhatsApp opt-ins.
Demo accounts never call paid APIs (forced mock).

---

## 12. Milestones (stop for review after each)

**M0 — Foundations.** Repo, Next.js 16 + TS strict + Tailwind v4 + shadcn restyled to §7 tokens, ESLint/Prettier, Vitest, Playwright, GitHub Actions (lint, typecheck, test, build), `netlify.toml`, Supabase project wiring, `.env.example`, `CLAUDE.md`, docs skeleton. **Test database:** use the Supabase CLI local stack (needs Docker) for RLS/integration tests in CI; if Docker isn't available in your environment, use a separate free Supabase *test* project and tell Joshua — never run tests against production. Two Supabase projects minimum: `dev/test` and `prod`. Design system page at `/dev/ui` showing every token and component in light/dark.
*Done when:* CI green; a Netlify preview deploy shows the design system page.

**M1 — Auth, tenancy, onboarding, events.** Supabase Auth (magic link + Google), orgs/memberships, RLS + RLS tests, onboarding wizard (without AI yet), app shell (sidebar/bottom tabs, Lite mode), `events` pipeline, signup modes + invite codes. Invite gating must also hold for **Google OAuth** sign-ups (where there's no form to check): store the invite code in a cookie before redirect and enforce it server-side in the auth callback or a Supabase "before user created" auth hook, so an un-invited Google account can't create an org.
*Done when:* two users in different orgs can't see each other's data (automated test); onboarding completes on a 360px viewport.

**M2 — Brand Voice (RAG).** Upload/paste/URL ingest, chunking, Voyage embeddings (mock fallback), pgvector retrieval, brand summary generation + approval, training-quality score.
*Done when:* uploading a document makes it retrievable; quality score updates correctly after each upload (regression test for the old stale-count bug).

**M3 — Content Studio, Approval Queue, router, credits.** Streaming generation, variants, channel previews, approve/edit/reject/regenerate with versions and audit, router with reasons, credit ledger, usage_events, daily budget + kill-switch, brand-match score and flags.
*Done when:* e2e: generate → edit → approve, credits decrement correctly, kill-switch blocks generation, free plan never hits the smart model (unit test).

**M4 — Leads & forms.** Hosted forms, embed snippet, QR, consent capture, honeypot + rate limit, scoring with reasons, lead detail timeline, CSV import/export, WhatsApp click-to-chat.
*Done when:* submitting the public form on mobile creates a scored lead with stored consent; contact limits enforced per plan.

**M5 — Campaigns & email.** Resend integration (mock fallback), sequence builder, approval gating, scheduled dispatcher, unsubscribe + List-Unsubscribe, bounce/complaint webhooks, send caps.
*Done when:* a 2-step sequence sends to consented test leads only, after both steps are approved; unsubscribe works end-to-end.

**M6 — Analytics & admin.** Org analytics (plain-language first), weekly summary background job, anomaly flags, founder admin with all §10 tiles, cohorts, feedback/NPS.
*Done when:* admin tiles compute correctly from seeded data (unit tests on guardrail calculations).

**M7 — Billing.** Plans config, Stripe Checkout + Customer Portal (GBP), Paystack checkout + subscription + credit packs (NGN), webhooks (signature-verified, idempotent), entitlements switching on webhook, dunning emails, test mode default.
*Done when:* in test mode, upgrading changes entitlements immediately; cancelling downgrades at period end; webhook replay is idempotent.

**M8 — Marketing site, legal drafts, polish.** Landing, pricing (GBP/NGN), FAQ, waitlist, privacy/terms drafts, cookie consent, SEO metadata/OG images, empty states and microcopy pass, accessibility audit (axe in Playwright), Lighthouse ≥ 90 (performance on mobile for Today/Review/form pages).

**M9 — Hardening & go-live.** Security headers, rate limits review, error monitoring, backup/restore check, load test the form endpoint, full e2e suite on the Netlify preview, `RUNBOOK.md`, production env checklist, switch `signup_mode` to `invite` for beta launch.
*Done when:* Joshua can follow `docs/GO_LIVE.md` to launch on a custom domain.

---

## 13. Environment variables (document in `.env.example` and `docs/ENV.md`)
```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
LLM_MODEL_FAST=claude-haiku-5-5        # verify in Anthropic docs
LLM_MODEL_SMART=claude-sonnet-5-5      # verify in Anthropic docs
GEMINI_API_KEY=                        # optional fallback
GEMINI_MODEL=                          # verify in Google AI Studio
VOYAGE_API_KEY=
EMBEDDING_MODEL=voyage-4-lite
EMBEDDING_DIM=1024
CREDIT_VALUE_USD=0.002
BACKGROUND_FN_SECRET=
RESEND_API_KEY=
EMAIL_FROM_DOMAIN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_GROWTH_GBP=
STRIPE_PRICE_ADVANCED_GBP=
PAYSTACK_SECRET_KEY=
PAYSTACK_PLAN_GROWTH_NGN=
PAYSTACK_PLAN_ADVANCED_NGN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
SENTRY_DSN=
FOUNDER_ADMIN_EMAILS=
AI_DAILY_BUDGET_USD=5
CRON_SECRET=
```
Every missing key must degrade to a clearly labelled mock, never crash.

---

## 14. Definition of done (every feature)
- Approval-queue behaviour defined (what needs a human tap).
- Entitlement checks via `plans.ts`.
- Cost telemetry (`usage_events`) for any AI call.
- First-party event(s) emitted.
- Loading / empty / error states; works at 360px and in Lite mode; keyboard accessible.
- zod validation + RLS covered by tests.
- Unit tests for logic; e2e for the user-visible flow (mock providers).
- Notes added to `docs/PROGRESS.md`; decisions to `docs/DECISIONS.md`.

## 15. Questions you'll be tempted to ask — answers
- *Which LLM?* Claude via the router; fast model by default; smart by exception; Gemini optional fallback; mock without keys.
- *Where does data live?* Supabase London. NG residency is a documented later milestone.
- *What stops free-tier abuse?* Credits, fast-model-only, per-org daily cap, global budget kill-switch, invite-only signups, dormancy pruning, rate limits.
- *Can we auto-post to social/WhatsApp?* Not in this build. Produce approved, ready-to-post assets with one-tap copy/share/click-to-chat; keep a `ChannelAdapter` for later API integrations.
- *Live payments?* Build fully, ship in test mode; Joshua flips to live after the pricing go/no-go.
