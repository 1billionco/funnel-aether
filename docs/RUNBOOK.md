# Runbook

Operational procedures. Sections are filled in as the features they cover ship (M1–M9).

## Local development

1. `pnpm install`
2. `pnpm db:start` (needs Docker), then copy the URL and keys from `pnpm exec supabase status` into `.env.local`.
3. `pnpm dev`, then open http://localhost:3000/dev/ui.
   With no keys at all the app still runs: every integration is a labelled mock.

## Rotating keys

_To do (M9)._ For each secret in `docs/ENV.md`: create a new key, update Netlify env, redeploy, then revoke the old key.

## Disabling AI (kill-switch)

`/admin` → "AI spend and kill switch" → AI generation: **Paused** → Save. Every new generation then returns "AI drafting is paused for today…"; in-flight ones finish. In an emergency, run `update app_settings set ai_kill_switch = true;` in the Supabase SQL editor. The daily budget (`ai_daily_budget_usd`) pauses generation automatically for the rest of the UTC day once reached.

Stuck drafts: the `sweep-drafts` scheduled function marks drafts stuck in "generating" for over 2 minutes as failed or partial and refunds them. To run it by hand: `select sweep_stuck_drafts();`.

## Restoring a deleted organisation within the grace period

_To do (M1/M9)._

## Handling a data-subject request (export / erasure)

_To do (M1/M9)._
