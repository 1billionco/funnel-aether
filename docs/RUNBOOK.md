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

_To do (M3)._ Admin → Guardrails → AI kill-switch, or set `app_settings.ai_kill_switch = true` in SQL.

## Restoring a deleted organisation within the grace period

_To do (M1/M9)._

## Handling a data-subject request (export / erasure)

_To do (M1/M9)._
