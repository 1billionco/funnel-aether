# Progress

## M0 — Foundations (done)

**Built**

- Next.js 16.4 (App Router, Turbopack) + TypeScript strict + Tailwind v4, pnpm.
- §7 design tokens as CSS variables with full dark mode (follows the OS, with a manual override saved in `localStorage`). Fonts: Fraunces, Geist and Geist Mono via `next/font` (self-hosted).
- shadcn-style UI kit on Radix: Button, Badge/chip, Card, Input/Textarea, Label, Checkbox, Switch, Slider, Progress, Separator, Tabs, Tooltip, Dialog, DropdownMenu, Select, Skeleton, Kbd, Metric, StateBlock.
- `/dev/ui` design system page showing every token and component in light and dark, plus live service modes. Returns 404 on production.
- `lib/env.ts`: zod-parsed env in which every key is optional, with `services()` reporting live, mock or off per integration.
- Supabase: CLI config, first migration (pgvector, pgcrypto), server/browser/service clients (all null-safe in mock mode).
- Provider interfaces: `LLMProvider`, `EmbeddingProvider`, `PaymentProvider`, `ChannelAdapter`.
- Security headers: HSTS, Referrer-Policy, nosniff, Permissions-Policy, and CSP with `frame-ancestors 'none'` everywhere except `/f/*`.
- `netlify.toml`, background-function shared-secret helper, and a `probe-background` function to confirm the plan supports Background Functions.
- Tooling: ESLint, Prettier (with Tailwind class sorting), Vitest (unit), Vitest + Postgres (DB), Playwright (desktop and 360px, with axe), and GitHub Actions CI.
- Docs: CLAUDE.md, DECISIONS, ENV, GO_LIVE, RUNBOOK, PRIVACY_NOTES, and the build spec copied to `docs/BUILD_SPEC.md`.

**Tests:** unit 14 · db 2 · e2e 12 (6 per viewport: rendering, theme persistence, axe in light and dark, no overflow at 360px, headers).

**CI:** green on GitHub (`1billionco/funnel-aether`, run 39966008178). Two CI-only fixes: `typecheck` now runs `next typegen` first, and runners are pinned to `ubuntu-24.04` (D-013).

**Not done / blocked**

- Netlify site not connected yet (Joshua). The "Netlify preview shows `/dev/ui`" check is still pending.

## M1 — Auth, tenancy, onboarding, events (done)

**Built**

- Schema: organizations, memberships, profiles, brands (questionnaire), app_settings, beta_invites, invite_redemptions, events, feedback, jobs, admin_audit, rate limits. RLS on every table plus column grants (D-015).
- RPCs: `create_organization` (sign-up mode, invite codes, org cap, one owned org; D-014), `set_org_market` (locked after first payment), `complete_onboarding`, `touch_org_activity`, `rate_limit_take`, `get_signup_mode`, `check_invite_code`.
- Auth: password, magic link and Google (Server Actions), `/auth/callback` for links and OAuth, `proxy.ts` session refresh plus redirect of signed-out visitors, invite code kept across redirects in a cookie.
- Onboarding: `/onboarding` (country + business), then `/{org}/setup/{brand|samples|summary|first-draft}` with progress bar and skippable steps. Samples, summary and first draft are placeholders until M2/M3.
- App shell: desktop sidebar (amber Review badge), top bar (business switcher, Create, feedback, account menu), mobile bottom tabs (Today, Review, Create, Leads, More), Lite mode (server-decided, slow-connection hint).
- Screens: Today (greeting, next best step, waiting for you, checklist), Brand (questionnaire editor), Settings (profile, business and country, Lite mode, theme, team list), honest placeholders for Review, Create, Leads, Campaigns, Analytics and Billing.
- Plans and entitlements config (`lib/credits/plans.ts`, `can` / `limit`).
- Founder admin `/admin`: sign-up mode, org cap, invite codes, business list.
- Events: `signed_up` (DB trigger), `onboarding_started`, `onboarding_completed`, `feedback_submitted`; in-app feedback button on every app page.

**Tests:** unit 52 · db 27 (cross-tenant RLS, column grants, invite gating, withOrg scoping, rate limit) · e2e 26 (sign-up → onboarding at 360px and desktop, cross-tenant 404, signed-out redirect, admin 404, brand save, Lite mode).

**Joshua to do:** see GO_LIVE (Supabase Auth settings).

## M2 — Brand Voice / RAG (done)

**Built**

- Schema: `brand_documents`, `brand_chunks` (vector(1024), HNSW cosine, `embedding_model` per row), `usage_events`, `model_prices`; `match_brand_chunks` (iterative scan, model-filtered, RLS-invoker), `brand_centroid`, `brand_document_stats`; private `brand-docs` bucket (10 MB, allowed types, org-scoped read/delete policies).
- Ingest: signed-URL uploads (browser → Storage, never through a route), paste, and website import via an SSRF-safe fetch (public IPs only, checked at connect time, redirects re-validated, 8 s / 2 MB caps).
- Pipeline (`lib/brand-voice/process.ts`): extract (PDF, DOCX, TXT, MD, CSV; 60-page / 200k-character caps) → chunk (ported 800/150 recursive splitter) → embed (Voyage, or labelled mock) → store → delete original unless kept → fresh stats → quality score → `brand_trained` event. Failures get friendly messages and a retry button. A re-embed function is ready for model changes.
- Jobs: `jobs` table, `dispatchJob` (Netlify background function or `after()`; D-021), `run-job-background` function.
- LLM layer: `AnthropicProvider` (streaming, per-model profiles, cache markers, refusal fallback; D-025), deterministic `MockProvider`, `usage_events` telemetry costed from `model_prices`.
- Brand summary: AI draft → owner edits → approve (only approved summaries reach prompts). Not charged (D-023).
- UI: Brand page (summary, samples with live status, profile, training-quality card with tips); onboarding steps "Examples of your writing" and "Your brand summary".

**Tests:** unit 98 · db 34 (processing, stale-count regression, k-results with HNSW + filter, keep or delete original, failure path, telemetry, cross-tenant retrieval, chunk and storage isolation) · e2e 28 (adds paste, signed upload, SSRF refusal, summary approve, at 360px and desktop).

## M3 — Content Studio, Approval Queue, router, credits (done)

**Built**

- Schema: drafts, draft_versions, approval_events, credit_ledger, generation_reservations, ai_daily_spend; org credit balance. SQL functions: `ensure_credit_grant`, `reserve_generation` (kill switch, global daily budget, free daily cap, balance; all atomic), `settle_generation`, `refund_generation`, `sweep_stuck_drafts`. All are service-role only.
- Router (`lib/ai/router.ts`): free → fast always; paid → fast by default, smart for long-form or regenerate after fast, one low-match escalation (D-029). `router_reason` is recorded on drafts and usage_events; the admin shows the 7-day blend.
- Credits (`lib/credits/meter.ts`): cost-based milli-credits, ¼-credit minimum, worst case reserved, typical estimate shown before generating, settled to actual, refunded on failure.
- Generation core (`lib/generation/core.ts`): draft row `generating` before the model call, retrieval + 5-layer prompt with a cacheable brand block, streaming with a deadline (saved as `partial`, then Continue), output parsing, flags, brand-match score, versions, telemetry, events. Long-form types run as `generate_draft` background jobs with progressive writes.
- `/api/generate` streams NDJSON; `sweep-drafts` scheduled function every 5 minutes.
- Create: market templates, brief with brand defaults, credit estimate and balance, live streaming into version cards, choose a version, "Open in Review".
- Review: filters, list + detail (desktop), swipe cards (mobile) with undo, LinkedIn / Instagram / Facebook / X / email / WhatsApp / web previews, brand-match chip with reasons, flags (amber), approve / edit-then-approve / reject with reason / regenerate with feedback / continue, A/E/R/G and J/K shortcuts, bulk approve for low-risk drafts, version history with word diff, thumbs up/down, copy / WhatsApp click-to-chat / mark as posted / reminder for approved assets.
- Onboarding step 5 generates the first draft and lands in Review with a welcome note. Today shows real counts and a credits ring; the sidebar shows a credits meter and the amber Review badge.
- Admin: kill switch, daily budget, today's spend, router blend.

**Tests:** unit 124 · db 48 (ledger reconciliation, settle/refund, insufficient credits, daily cap, kill switch, concurrent budget, sweeper, generation incl. regenerate / partial / provider failure, draft RLS) · e2e 35 + 2 viewport-specific skips (generate → edit → approve with credits and audit, reject + regenerate, mobile swipe + undo, onboarding first draft, kill switch isolated in its own project).

**Known gaps / next:** NG credit-pack checkout (M7); founder email on budget breach (M5); command palette (later); seeded demo orgs (Sarah/Chinedu) to be added with M4 data.

## Post-M3 fixes (go-live)

- Home page links to sign-up and sign-in.
- Email links: the callback redirected to the server's internal host, losing the new session, so people landed back on sign-in (D-033). Fixed. Opening a link in another browser now explains that the email is confirmed and asks you to sign in. Clear messages for unconfirmed email and expired links; callback failures are logged to the function log.
- Local stack mirrors production auth URLs (site URL and redirect list on port 3100) so e2e tests read real emails from Mailpit.

**Tests:** unit 129 · db 48 · e2e 39 + 2 viewport skips (adds email link sign-in and link in another browser).
