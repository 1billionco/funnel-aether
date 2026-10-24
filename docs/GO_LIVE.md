# Go-live checklist

Each milestone adds items here. Full launch steps are completed in M9.

## Accounts and settings Joshua sets up

- [ ] **Netlify:** connect the GitHub repo. Confirm the plan includes **Background Functions** by deploying, then running the probe:
      `curl -i -X POST -H "x-fa-background-secret: $BACKGROUND_FN_SECRET" https://<site>/.netlify/functions/probe-background`
      Expect `202`, then about 35s later the line `probe-background ok` in the function log.
- [ ] **Netlify:** note the synchronous function timeout on your plan and set `GENERATION_DEADLINE_MS` about 5s below it (DECISIONS D-007).
- [ ] **Netlify:** if your plan allows it, set the **functions region to London (`lhr`)** (Site configuration → Functions), so DB round trips stay in the UK.
- [ ] **Supabase:** two projects minimum, `funnel-aether-dev` (dev/test) and `funnel-aether-prod`, both in **London (eu-west-2)**.
- [ ] **Supabase prod on the Pro plan before real users join.** Free projects pause after inactivity and have no automated backups.
- [ ] **Supabase migrations:** apply `supabase/migrations` to each project (`supabase link --project-ref <ref>` then `supabase db push`). Never run `supabase/seed.sql` against prod.
- [ ] **Supabase Auth → URL configuration:** Site URL = production URL; add `https://<site>/auth/callback` and `https://deploy-preview-*--<site>.netlify.app/auth/callback` to Redirect URLs.
- [ ] **Supabase Auth → Email Templates:** make links work in any browser or device (no PKCE cookie needed). In **Confirm signup** and **Magic link**, replace `{{ .ConfirmationURL }}` with `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`. Needs Site URL set correctly.
- [ ] **Supabase Auth → Providers:** enable Google (create an OAuth client in Google Cloud; authorised redirect URI = `https://<project>.supabase.co/auth/v1/callback`). Keep email confirmations on.
- [ ] **Supabase Auth → SMTP:** use Resend SMTP for auth emails (the built-in sender is heavily rate-limited).
- [ ] **Netlify env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `FOUNDER_ADMIN_EMAILS`, `CRON_SECRET`.
- [ ] **First invite:** sign in with a `FOUNDER_ADMIN_EMAILS` address, open `/admin` and create invite codes. Sign-up mode starts as **invite**.
- [ ] **Anthropic:** add `ANTHROPIC_API_KEY` in Netlify. Keep `LLM_MODEL_FAST=claude-haiku-5-5` / `LLM_MODEL_SMART=claude-sonnet-5-5` unless you choose otherwise.
- [ ] **Credits economics:** at Haiku 5.5 prices most fast drafts cost under the ¼-credit minimum (D-024). Decide whether `CREDIT_VALUE_USD` (0.002) and the monthly allowances still make sense.
- [ ] **Model prices:** open `model_prices` (admin, coming in M6, or the Supabase table editor), confirm each Claude row against Anthropic's pricing page, fill in Voyage's price, and set `verified_at`.
- [ ] **Background jobs:** if the probe passes, set `JOB_RUNNER=netlify` and `BACKGROUND_FN_SECRET` in Netlify env.
- [ ] **Anthropic Console and Voyage dashboard:** set a monthly spend limit as a backstop outside the app.
- [ ] **Resend:** verify the sending domain (e.g. `mail.funnelaether.com`); check the current free-tier daily and monthly send limits.
- [ ] **Paystack:** confirm live-account eligibility (registered business in a Paystack country, with a local bank account) before M7 goes live.

## Legal and compliance (business admin, not built)

- [ ] Pay the ICO data protection fee before processing real users' data.
- [ ] Check whether NDPC (Nigeria) registration applies.
- [ ] Have the privacy notice, terms and DPA section legally reviewed, then publish.
