-- M1: tenancy, profiles, brands (questionnaire), beta gating, events, feedback, jobs, rate limits.
--
-- Security model (spec §4, §9):
--  * Every tenant table has org_id + RLS: the caller must be a member of org_id.
--  * Writes that need invariants go through SECURITY DEFINER RPCs.
--  * Column-level grants stop users from writing server-owned columns
--    (plan, counts, scores, flags) even on rows they can update.
--  * Helper functions live in the non-exposed `private` schema.

create schema if not exists private;
grant usage on schema private to authenticated, anon;

-- ---------------------------------------------------------------- enums
create type public.market as enum ('UK', 'NG');
create type public.currency as enum ('GBP', 'NGN');
create type public.plan_id as enum ('free', 'growth', 'advanced');
create type public.org_status as enum ('active', 'dormant', 'pruned');
create type public.member_role as enum ('owner', 'editor', 'reviewer');
create type public.signup_mode as enum ('open', 'invite', 'closed');
create type public.feedback_kind as enum ('nps', 'bug', 'idea', 'draft_rating');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');

-- ---------------------------------------------------------------- shared trigger
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- organizations
-- Slugs share the URL root with app routes (/{slug}/today), so reserved words are blocked.
create or replace function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'auth', 'billing', 'dev', 'f', 'help', 'invite', 'legal', 'login',
    'logout', 'onboarding', 'pricing', 'privacy', 'settings', 'sign-in', 'sign-out', 'sign-up',
    'signin', 'signup', 'static', 'support', 'terms', 'waitlist', 'www', '_next', 'demo'
  ]);
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$' and not private.is_reserved_slug(slug)),
  market public.market not null,
  currency public.currency not null,
  timezone text not null default 'Europe/London',
  plan public.plan_id not null default 'free',
  plan_period_start timestamptz not null default now(),
  plan_period_end timestamptz not null default (now() + interval '1 month'),
  lite_mode_default boolean not null default false,
  status public.org_status not null default 'active',
  market_locked boolean not null default false,
  is_demo boolean not null default false,
  business_address text,
  onboarding_completed_at timestamptz,
  deleted_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint currency_matches_market check (
    (market = 'UK' and currency = 'GBP') or (market = 'NG' and currency = 'NGN')
  )
);
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'editor',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  onboarding_state jsonb not null default '{}'::jsonb,
  is_founder_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- membership helpers
create or replace function private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function private.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function private.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.member_role[]) to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;

-- ---------------------------------------------------------------- brands
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  industry text check (char_length(industry) <= 120),
  offer text check (char_length(offer) <= 1000),
  audience text check (char_length(audience) <= 1000),
  tone_sliders jsonb not null default
    '{"formal_casual":50,"playful_serious":50,"concise_detailed":50,"bold_reassuring":50}'::jsonb,
  do_say text[] not null default '{}',
  dont_say text[] not null default '{}',
  compliance_rules text[] not null default '{}',
  example_ctas text[] not null default '{}',
  website_url text check (char_length(website_url) <= 500),
  whatsapp_number text check (char_length(whatsapp_number) <= 32),
  primary_language text not null default 'en-GB',
  summary text check (char_length(summary) <= 4000),
  summary_status text not null default 'none' check (summary_status in ('none', 'draft', 'approved')),
  summary_approved_by uuid references auth.users (id) on delete set null,
  summary_approved_at timestamptz,
  training_quality_score integer not null default 0 check (training_quality_score between 0 and 100),
  document_count integer not null default 0,
  chunk_count integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_org_idx on public.brands (org_id) where deleted_at is null;
create trigger brands_touch before update on public.brands
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- beta gating
create table public.app_settings (
  id boolean primary key default true check (id),
  signup_mode public.signup_mode not null default 'invite',
  max_orgs integer not null default 200,
  ai_daily_budget_usd numeric(10, 2) not null default 5,
  ai_kill_switch boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.app_settings (id) values (true) on conflict do nothing;

create table public.beta_invites (
  code text primary key check (code ~ '^[A-Z0-9-]{4,40}$'),
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  market public.market,
  expires_at timestamptz,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.invite_redemptions (
  code text not null references public.beta_invites (code) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, org_id)
);

-- ---------------------------------------------------------------- instrumentation
create table public.events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (name ~ '^[a-z_]{2,64}$'),
  props jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index events_name_at_idx on public.events (name, at);
create index events_org_at_idx on public.events (org_id, at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind public.feedback_kind not null,
  score integer check (score between -1 and 10),
  text text check (char_length(text) <= 4000),
  page text check (char_length(page) <= 300),
  draft_id uuid,
  created_at timestamptz not null default now()
);
create index feedback_org_idx on public.feedback (org_id, created_at);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type text not null,
  status public.job_status not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_org_idx on public.jobs (org_id, created_at desc);
create index jobs_status_idx on public.jobs (status, created_at) where status in ('queued', 'running');
create trigger jobs_touch before update on public.jobs
  for each row execute function private.touch_updated_at();

create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

-- Postgres-backed token bucket (spec §3 rate limiting). Server-only.
create table private.rate_limits (
  key text primary key,
  tokens double precision not null,
  updated_at timestamptz not null default now()
);
-- Not exposed via the Data API, but locked anyway (defence in depth). The
-- SECURITY DEFINER function below runs as the table owner and is unaffected.
alter table private.rate_limits enable row level security;

-- ---------------------------------------------------------------- RLS
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.app_settings enable row level security;
alter table public.beta_invites enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.events enable row level security;
alter table public.feedback enable row level security;
alter table public.jobs enable row level security;
alter table public.admin_audit enable row level security;

-- organizations: members read; owners update a safe subset of columns.
create policy org_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (private.has_org_role(id, '{owner}')) with check (private.has_org_role(id, '{owner}'));
revoke insert, update, delete on public.organizations from authenticated, anon;
grant update (name, timezone, lite_mode_default, business_address) on public.organizations to authenticated;

-- memberships: members see their teammates. Changes go through RPCs (later milestones).
create policy memberships_select on public.memberships for select to authenticated
  using (private.is_org_member(org_id));
revoke insert, update, delete on public.memberships from authenticated, anon;

-- profiles: you and your teammates are visible; you edit your own safe columns.
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or private.shares_org_with(user_id));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, onboarding_state) on public.profiles to authenticated;

-- brands: members read; owners/editors write the profile; counts and scores are server-owned.
create policy brands_select on public.brands for select to authenticated
  using (private.is_org_member(org_id));
create policy brands_insert on public.brands for insert to authenticated
  with check (private.has_org_role(org_id, '{owner,editor}'));
create policy brands_update on public.brands for update to authenticated
  using (private.has_org_role(org_id, '{owner,editor}'))
  with check (private.has_org_role(org_id, '{owner,editor}'));
revoke insert, update, delete on public.brands from authenticated, anon;
grant insert (org_id, name, industry, offer, audience, tone_sliders, do_say, dont_say,
  compliance_rules, example_ctas, website_url, whatsapp_number, primary_language)
  on public.brands to authenticated;
grant update (name, industry, offer, audience, tone_sliders, do_say, dont_say, compliance_rules,
  example_ctas, website_url, whatsapp_number, primary_language, summary, summary_status,
  summary_approved_by, summary_approved_at)
  on public.brands to authenticated;

-- feedback: users can leave feedback for orgs they belong to; read their own.
create policy feedback_insert on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and (org_id is null or private.is_org_member(org_id)));
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = auth.uid());
revoke update, delete on public.feedback from authenticated, anon;

-- jobs: members can watch their org's job progress. Writes are server-only.
create policy jobs_select on public.jobs for select to authenticated
  using (private.is_org_member(org_id));
revoke insert, update, delete on public.jobs from authenticated, anon;

-- app_settings, beta_invites, invite_redemptions, events, admin_audit:
-- no policies = no access for anon/authenticated. Founder admin uses the
-- service role after an application-level check.
revoke all on public.app_settings, public.beta_invites, public.invite_redemptions,
  public.events, public.admin_audit from authenticated, anon;

-- ---------------------------------------------------------------- new user → profile + event
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                        new.raw_user_meta_data ->> 'name', '')), ''))
  on conflict (user_id) do nothing;

  insert into public.events (user_id, name, props)
  values (new.id, 'signed_up', jsonb_build_object(
    'provider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- public RPCs
-- Anyone may learn the sign-up mode (to render the right sign-up form).
create or replace function public.get_signup_mode()
returns public.signup_mode
language sql
stable
security definer
set search_path = ''
as $$
  select signup_mode from public.app_settings where id;
$$;
grant execute on function public.get_signup_mode() to anon, authenticated;

-- Pre-check an invite code before sending a magic link / OAuth redirect.
-- Authoritative enforcement happens in create_organization().
create or replace function public.check_invite_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.beta_invites i
    where i.code = upper(btrim(p_code))
      and i.used_count < i.max_uses
      and (i.expires_at is null or i.expires_at > now())
  );
$$;
grant execute on function public.check_invite_code(text) to anon, authenticated;

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')), 40);
$$;

-- Creates an organisation with the caller as owner. Enforces sign-up mode,
-- invite codes (also for Google OAuth sign-ups, where no form is involved),
-- the global org cap, and one owned org per user (founder admins exempt).
create or replace function public.create_organization(
  p_name text,
  p_market public.market,
  p_timezone text default null,
  p_invite_code text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_settings public.app_settings;
  v_is_founder boolean;
  v_code text := nullif(upper(btrim(coalesce(p_invite_code, ''))), '');
  v_invite public.beta_invites;
  v_base text;
  v_slug text;
  v_org public.organizations;
  v_attempt integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  select * into v_settings from public.app_settings where id for update;
  select coalesce(is_founder_admin, false) into v_is_founder
    from public.profiles where user_id = v_user;
  v_is_founder := coalesce(v_is_founder, false);

  if not v_is_founder then
    if v_settings.signup_mode = 'closed' then
      raise exception 'signups_closed' using errcode = 'P0001';
    end if;

    if exists (select 1 from public.memberships where user_id = v_user and role = 'owner') then
      raise exception 'already_owns_org' using errcode = 'P0001';
    end if;

    if (select count(*) from public.organizations where deleted_at is null) >= v_settings.max_orgs then
      raise exception 'beta_full' using errcode = 'P0001';
    end if;

    if v_settings.signup_mode = 'invite' then
      if v_code is null then
        raise exception 'invite_required' using errcode = 'P0001';
      end if;
      select * into v_invite from public.beta_invites where code = v_code for update;
      if not found
         or v_invite.used_count >= v_invite.max_uses
         or (v_invite.expires_at is not null and v_invite.expires_at <= now()) then
        raise exception 'invite_invalid' using errcode = 'P0001';
      end if;
      if v_invite.market is not null and v_invite.market <> p_market then
        raise exception 'invite_wrong_market' using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_base := private.slugify(p_name);
  if char_length(v_base) < 3 or private.is_reserved_slug(v_base) then
    v_base := 'org-' || v_base;
  end if;
  v_base := trim(both '-' from left(v_base, 40));
  v_slug := v_base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_attempt := v_attempt + 1;
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
    if v_attempt > 20 then
      raise exception 'slug_unavailable';
    end if;
  end loop;

  insert into public.organizations (name, slug, market, currency, timezone, lite_mode_default, created_by)
  values (
    btrim(p_name),
    v_slug,
    p_market,
    case p_market when 'UK' then 'GBP'::public.currency else 'NGN'::public.currency end,
    coalesce(nullif(p_timezone, ''), case p_market when 'UK' then 'Europe/London' else 'Africa/Lagos' end),
    p_market = 'NG',
    v_user
  )
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org.id, v_user, 'owner');

  if v_invite.code is not null then
    update public.beta_invites set used_count = used_count + 1 where code = v_invite.code;
    insert into public.invite_redemptions (code, org_id, user_id) values (v_invite.code, v_org.id, v_user);
  end if;

  insert into public.events (org_id, user_id, name, props)
  values (v_org.id, v_user, 'onboarding_started',
          jsonb_build_object('market', p_market, 'invite', v_invite.code is not null));

  return v_org;
end;
$$;
revoke execute on function public.create_organization(text, public.market, text, text) from anon, public;
grant execute on function public.create_organization(text, public.market, text, text) to authenticated;

-- Market can change until the first payment locks it (spec §5).
create or replace function public.set_org_market(p_org uuid, p_market public.market)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if not private.has_org_role(p_org, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organizations
     set market = p_market,
         currency = case p_market when 'UK' then 'GBP'::public.currency else 'NGN'::public.currency end
   where id = p_org and not market_locked
  returning * into v_org;
  if not found then
    raise exception 'market_locked' using errcode = 'P0001';
  end if;
  return v_org;
end;
$$;
revoke execute on function public.set_org_market(uuid, public.market) from anon, public;
grant execute on function public.set_org_market(uuid, public.market) to authenticated;

-- Token bucket. Returns true if the action is allowed. Server (service role) only.
create or replace function public.rate_limit_take(
  p_key text,
  p_capacity integer,
  p_refill_per_second double precision,
  p_cost double precision default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tokens double precision;
  v_now timestamptz := clock_timestamp();
begin
  insert into private.rate_limits as r (key, tokens, updated_at)
  values (p_key, p_capacity, v_now)
  on conflict (key) do update
    set tokens = least(p_capacity::double precision,
                       r.tokens + extract(epoch from (v_now - r.updated_at)) * p_refill_per_second),
        updated_at = v_now
  returning tokens into v_tokens;

  if v_tokens < p_cost then
    return false;
  end if;
  update private.rate_limits set tokens = tokens - p_cost where key = p_key;
  return true;
end;
$$;
revoke execute on function public.rate_limit_take(text, integer, double precision, double precision) from anon, authenticated, public;
grant execute on function public.rate_limit_take(text, integer, double precision, double precision) to service_role;

-- Marks onboarding complete (server-owned column) and records the event once.
create or replace function public.complete_onboarding(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_org, '{owner,editor}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organizations set onboarding_completed_at = now()
   where id = p_org and onboarding_completed_at is null;
  if found then
    insert into public.events (org_id, user_id, name) values (p_org, auth.uid(), 'onboarding_completed');
  end if;
end;
$$;
revoke execute on function public.complete_onboarding(uuid) from anon, public;
grant execute on function public.complete_onboarding(uuid) to authenticated;

-- Dormancy tracking (spec §5): at most one write per hour per org.
create or replace function public.touch_org_activity(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.organizations
     set last_active_at = now(),
         status = case when status = 'dormant' then 'active'::public.org_status else status end
   where id = p_org
     and private.is_org_member(p_org)
     and last_active_at < now() - interval '1 hour';
$$;
revoke execute on function public.touch_org_activity(uuid) from anon, public;
grant execute on function public.touch_org_activity(uuid) to authenticated;
