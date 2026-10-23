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
