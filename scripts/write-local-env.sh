#!/usr/bin/env bash
# Writes .env.local from the running Supabase CLI stack (used by CI and new clones).
set -euo pipefail
eval "$(pnpm exec supabase status -o env | sed 's/^/export SB_/')"
cat > .env.local <<ENV
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100
NEXT_PUBLIC_SUPABASE_URL=${SB_API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SB_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SB_SERVICE_ROLE_KEY}
BACKGROUND_FN_SECRET=local-background-secret
CRON_SECRET=local-cron-secret
FOUNDER_ADMIN_EMAILS=founder@example.test
ENV
echo "Wrote .env.local for ${SB_API_URL}"
