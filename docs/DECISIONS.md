# Decisions log

Each decision: context → choice → why. Newest at the bottom. "Revisit" marks things to check before go-live.

## D-001 · Scaffold fresh (M0)

No `funnel-aether-frontend` checkout was in the workspace, so the app is scaffolded fresh with `create-next-app@16.4.2`. The persona switcher is therefore never carried over; seeded demo accounts arrive in M1/M11. The backend repo (`1billionco/funnel-aether-backend`) will be read for porting in M2–M4, never deployed.

## D-002 · Package manager: pnpm, Node 22

Fast installs and a strict dependency graph. `packageManager` is pinned in `package.json`; Netlify builds on Node 22 (`netlify.toml`).

## D-003 · shadcn/ui components written by hand

The shadcn registry (`ui.shadcn.com`) was unreachable from the build sandbox. The components follow the shadcn pattern exactly (copy-in source on the `radix-ui` package, `cva`, `cn`, `components.json` present), so the CLI can be used later without conflict. Each component is restyled to the §7 tokens.

## D-004 · Contrast-safe token variants

The spec palette was checked against WCAG 2.1 AA:

- Signal amber `#D97706` on white is 3.19:1, which fails for text. Amber **fills** carry ink text (5.61:1). Amber **text** uses `--amber-ink` (`#92400E` light, `#F59E0B` dark).
- Teal `#0F766E` as text on the dark surface is 3.39:1, which fails. Dark mode adds `--primary-fg: #2DD4BF` for teal text and links; buttons keep the brand teal fill with white text (5.47:1).
- Approve-green text on its own 10% tint is just under 4.5:1. Light mode uses `--approve-fg: #166534` for text; the fill stays `#15803D`.
- Dark-mode status text uses lighter variants (`#4ADE80`, `#F97066`, `#8DA2FB`).
  axe runs in Playwright on `/dev/ui` in both themes (`tests/e2e/design-system.spec.ts`).

## D-005 · `cacheComponents` off

Next 16's scaffold enables `cacheComponents`. Almost every app route is per-tenant and dynamic, and §7.3 requires Lite mode to be decided server-side in the root layout from cookies and headers. Under `cacheComponents`, that read would need Suspense boundaries around the whole document. Turning it off keeps the boring, conventional model. Revisit for marketing pages in M8 if Lighthouse needs it.

## D-006 · CSP baseline without nonces

As §9 allows, the CSP is static (set in `next.config.ts`, built by `lib/security/csp.ts`). Next.js emits inline bootstrap scripts, so `script-src` includes `'unsafe-inline'`; Next's own CSP guide confirms this for the no-nonce setup. Nonces would force dynamic rendering everywhere. `connect-src` only lists hosts actually configured (Supabase REST and Realtime, PostHog when keyed, Sentry when keyed). `frame-ancestors 'none'` plus `X-Frame-Options: DENY` apply everywhere except `/f/*`, which gets `frame-ancestors *` for embedding. **Revisit in M9:** consider SRI or nonces for app routes.

## D-007 · Generation deadline is configurable

Netlify's synchronous-function limit couldn't be confirmed from the sandbox (docs host unreachable), and secondary sources disagree (10s vs 60s). The spec's 25s abort is therefore `GENERATION_DEADLINE_MS` (default 25000). Joshua confirms the real limit on his plan (see GO_LIVE), and we set the deadline about 5s under it. **Revisit at M3.**

## D-008 · DB tests on the Supabase CLI local stack

Docker is available, so RLS and integration tests run against `supabase start` (light profile: studio, edge-runtime, logflare, vector, imgproxy, supavisor, postgres-meta and mailpit excluded). `tests/db/helpers.ts` refuses any non-local host unless `ALLOW_REMOTE_TEST_DB=1` is set for a dedicated test project, so tests can never hit production. CI runs the same stack.

## D-009 · `/dev/ui` hidden in production

Gated on `NEXT_PUBLIC_APP_ENV`, which is inlined at build from Netlify's `CONTEXT`. The page shows on deploy previews and branch deploys and returns 404 on production.

## D-010 · Playwright pinned to 1.56.1

That version matches the pre-installed Chromium (revision 1194) in the build sandbox. CI installs its own browser with `playwright install --with-deps chromium`.

## D-011 · Brand fonts via `next/font/google`

Fraunces, Geist and Geist Mono are self-hosted at build time by `next/font`, so there are no runtime requests to Google and `font-src 'self'` holds. In Lite mode (M1) the font CSS variables are not attached to `<html>`, so the browser never downloads them and the system stack applies.

## D-012 · What the backend repo actually contains (M0 review)

`1billionco/funnel-aether-backend` (`main` and `branding-for-funnel-aether-79d7d` are identical, about 970 lines of Python) contains **only the brand-voice service**: profile and document models, chunking, retrieval, and the training-quality score (type diversity 40 + required types 20 + chunk volume 30 + document count 10, capped at 100). It does **not** contain the heuristic lead scoring, the analytics guardrail definitions, the brand-alignment output score, or the Sarah/Chinedu seed data that §0 lists. Brand voice will be ported in M2. Unless Joshua supplies the originals, the rest is built fresh from the spec (§6.4, §8, §10, §11 and Appendix A personas), with the formulas recorded here.

## D-013 · CI runners pinned to `ubuntu-24.04`

`ubuntu-latest` moved to Ubuntu 26 on 19 Oct 2026, and `playwright install --with-deps` for the pinned Playwright 1.56 failed there. The runners are pinned to 24.04 until Playwright is upgraded (do that together with the sandbox browser, D-010).

## D-014 · Invite gating enforced in `create_organization` (M1)

Invite codes are checked when the user creates a business, inside the `create_organization` RPC, which locks the invite row and redeems it atomically. They aren't checked at account creation. This covers Google OAuth (no form to check): the code is stored in an httpOnly cookie before the redirect and passed to the RPC during onboarding. An un-invited account can exist, but it can't create an org, which is the thing that consumes resources. A Supabase "before user created" hook was considered and rejected for now: it needs per-environment dashboard setup and would add a second place to keep in sync. The RPC also enforces sign-up mode (`open | invite | closed`), the `max_orgs` cap and one owned org per user (founder admins exempt).

## D-015 · Column-level grants for server-owned fields (M1)

RLS decides which rows a member can touch; column grants decide which fields. Users can't write `organizations.plan`, `market_locked`, `onboarding_completed_at`, `brands.training_quality_score` / counts, or `profiles.is_founder_admin`, even on their own rows. Those change only through SECURITY DEFINER RPCs or the service role. Tests cover it (`tests/db/tenancy.test.ts`).

## D-016 · URL shape `/{org-slug}/…` with reserved slugs (M1)

Following the spec's `/(app)/[org]` layout, app URLs sit at the root (`/hartley-co/today`). Static routes win over the dynamic segment, and a reserved-slug list in SQL (`private.is_reserved_slug`) stops an org taking `admin`, `sign-in`, `f`, `api` and so on. A missing org and a forbidden org both return 404, so URLs don't reveal which slugs exist.

## D-017 · Lite mode decision and fonts (M1)

Lite mode is decided server-side in the root layout: explicit cookie (`fa_lite` = `1` or `0`), else the `Save-Data: on` header. NG orgs have `lite_mode_default = true`, which sets the cookie on first sign-in or onboarding if the user hasn't chosen. `navigator.connection` only _suggests_ switching (a banner). Fonts use `preload: false` so Lite mode, which doesn't attach the font CSS variables, downloads no font files. The cost is a brief font swap on first paint in full mode. Reading cookies in the root layout makes every route dynamic; that is acceptable because nearly every route is per-user anyway (D-005).

## D-018 · Rate limits: Postgres token bucket, test bypass (M1)

`rate_limit_take()` is service-role only. Auth attempts are limited per IP hash (10 per 10 minutes) and per email (5 per 15 minutes). The e2e suite signs everyone in from one IP, so `RATE_LIMIT_BYPASS=1` disables limits **only when the build isn't production** (`NEXT_PUBLIC_APP_ENV` is inlined from Netlify's `CONTEXT`). A unit test covers the guard.

## D-019 · Post-sign-in routing (M1)

A Server Action that redirects to a Route Handler leaves the client router stuck on the handler URL. The landing page is therefore computed inside the sign-in action and the email/OAuth callback (`afterSignIn`), which also mirrors `FOUNDER_ADMIN_EMAILS` into the profile flag and applies the org's Lite default. `/auth/continue` is a plain page that redirects.

## D-020 · Deferred from M1

Team invitations (Advanced plan seats) and the ⌘K command palette are deferred to later milestones; Settings shows the seat count, and the top bar has a Create button. Data export and org deletion (Settings → Data & privacy) are deferred to M9 with an interim "email the founder" note.

## D-021 · Job runner: background function or `after()` (M2)

`dispatchJob()` writes a `jobs` row, then either POSTs the job ID to `/.netlify/functions/run-job-background` with the shared secret (when `JOB_RUNNER=netlify`), or runs it with `next/server` `after()` within the route's time limit. Inline is the default locally, in CI, and on a Netlify plan without Background Functions. Payloads hold IDs only. Set `JOB_RUNNER=netlify` once the `probe-background` check passes. Document processing for typical uploads (a few pages) finishes well inside the inline limit.

## D-022 · MMR diversity uses word overlap, not vectors (M2)

Retrieval asks Postgres for the 20 most similar chunks (`match_brand_chunks`, pgvector 0.8 iterative HNSW scan so the brand and model filter still returns k rows), then picks 6 with maximal marginal relevance. Relevance is the DB cosine similarity; redundancy is Jaccard word overlap between chunks. That avoids sending 20 × 1024 floats back on every request (about 70–90 ms per round trip from Netlify's US region to London). Revisit if retrieved samples look repetitive.

## D-023 · Onboarding brand summary isn't charged credits (M2)

The summary is a one-off onboarding step on the fast model, and the credit ledger arrives in M3. It is logged in `usage_events` (`feature = brand_summary`, `router_reason = onboarding_fast`), so it counts in cost telemetry, but no credits are deducted. Content generation (M3) is metered.

## D-024 · `model_prices` seeded from Anthropic's published rates (M2)

The spec says prices are never hard-coded and Joshua fills them in. The table is seeded with Anthropic's published October 2026 rates (Haiku 5.5: $0.10 / $0.50; Sonnet 5.5: $2 / $10, cache read $0.20). Where a cache price isn't published, it's derived from the documented 0.1× read and 1.25× write multipliers. Every seeded row has `verified_at = NULL` until Joshua confirms it. Voyage's price is left NULL (cost recorded as 0) for Joshua to fill in. **Note for the credit economics:** Haiku 5.5 is roughly 10× cheaper than the spec's planning assumption, so most fast generations will hit the 0.25-credit minimum.

## D-025 · Model request profiles (M2)

The LLM request shape is chosen per model family (`lib/ai/anthropic.ts` `modelProfile`). On Haiku 5.5 thinking is off and effort is low (short marketing copy doesn't benefit from it). Sonnet 5.5 uses `thinking: between_tools` (its supported way to turn thinking off) at medium effort, plus Anthropic's server-side refusal fallback (`fallbacks: "default"`), which reruns a declined request on another model inside the same call. No sampling parameters are sent (the API rejects `temperature` since 21 Oct 2026). Prompt caching markers go on the stable brand block only when it is at least 512 tokens, the minimum for current models.

## D-026 · Brand-match score designed fresh (M3)

The backend's alignment scorer wasn't in the repo (D-012), so `lib/ai/quality.ts` implements §6.4 directly:

- **Similarity (up to 70 points):** half from the cosine similarity to the brand centroid, half from the best match among the 3 nearest chunks. Raw similarity is normalised per embedder (mock 0.02–0.40, Voyage 0.30–0.80).
- **Call to action:** +15.
- **Fits the channel's length limit:** +10.
- **Uses a favourite phrase:** +5.
- **Penalties:** −15 per avoided word (capped at −30) and −5 for American spelling in UK orgs.
- **No samples yet:** a neutral 40 replaces the similarity part.

The top 3 reasons, problems first, show as a chip. **Revisit** the Voyage normalisation range against real data in the beta.

## D-027 · Monthly credits top up, packs carry over (M3)

At each new period the balance is topped up to the plan allowance (`greatest(0, allowance − balance)`). Unused monthly credits don't accumulate, but anything above the allowance (future NG credit packs) is kept. Free periods roll monthly from org creation. The grant happens in `create_organization`'s onboarding step and lazily inside `reserve_generation`, so it never depends on a scheduled job firing.

## D-028 · Budget breach pauses the day; the kill switch is manual (M3)

`reserve_generation` treats the global daily budget as a pause for that UTC day ("capacity paused for today"). It records `breached_at` and a `budget_breached` event the first time. The persistent `ai_kill_switch` is only flipped by a human in `/admin`. Emailing Joshua on breach waits for M5 (Resend); until then it's an event plus a server log line, shown in admin.

## D-029 · Escalation only when time allows (M3)

Streamed short outputs escalate to the smart model on a low brand match (< 60) only if more than 12 s remain before the deadline. The escalation is a second reservation and a new version with `router_reason = low_brand_match`. Long-form types already route to the smart model on paid plans. A regenerate-with-feedback after a fast attempt routes to smart (`regen_after_fast`). Free plans never reach the smart model (exhaustively unit-tested).

## D-030 · Output contract: streamed body, then a META block (M3)

Variants are separated by `===VARIANT===`, followed by `===META===` and JSON (title, subject, preheader, hashtags, cta, flags). Only the text before META streams to the user; the parser tolerates code fences and missing or broken JSON. That gives a streamed body plus structured fields in one call, without needing structured-output mode on a streaming request. Model flags merge with a rule-based detector (scarcity, testimonials, regulated claims, avoided words).

## D-031 · Draft writes go through the server (M3)

Members can read drafts, versions, audit and ledger under RLS; all writes use the service role via `withOrg` after an app-level role check. Owners and editors can create, edit and regenerate; reviewers can approve, reject, schedule and mark as posted. That keeps server-owned fields (credits, model, scores) safe without per-column grants on a busy table.

## D-032 · Undo is a server action, not a delayed commit (M3)

Approve and reject happen immediately, so nothing is lost if the tab closes. The toast's Undo calls `undoDecision`, which works for the same user within 10 minutes and is audited as `undo`.
