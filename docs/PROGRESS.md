# Progress

## M0 — Foundations (done, awaiting review)

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

**Not done / blocked**

- No GitHub remote or Netlify site yet; Joshua creates these (see the M0 summary). "CI green" and "Netlify preview shows `/dev/ui`" are verified locally only until then.
