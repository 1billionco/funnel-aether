-- M3: drafts, versions, approval audit, credit ledger, generation reservations,
-- global daily AI budget + kill switch, stuck-draft sweeper.

create type public.draft_type as enum ('social_post', 'email', 'whatsapp', 'landing_copy', 'seo_brief', 'campaign_step');
create type public.draft_status as enum (
  'generating', 'partial', 'failed', 'pending', 'approved', 'rejected', 'scheduled', 'sent', 'posted', 'archived');
create type public.version_source as enum ('ai', 'human_edit', 'ai_regen');
create type public.approval_action as enum ('approve', 'edit', 'reject', 'regenerate', 'schedule', 'send', 'post', 'undo', 'archive');
create type public.ledger_reason as enum ('monthly_grant', 'generation', 'pack_purchase', 'refund', 'admin_adjust');
create type public.reservation_status as enum ('reserved', 'settled', 'refunded');

alter table public.organizations
  add column credit_balance_milli integer not null default 0,
  add column credits_granted_for timestamptz;

-- ---------------------------------------------------------------- drafts
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  type public.draft_type not null,
  channel text not null check (channel in ('linkedin', 'instagram', 'facebook', 'x', 'email', 'whatsapp', 'web')),
  title text check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 40000),
  metadata jsonb not null default '{}'::jsonb,
  status public.draft_status not null default 'generating',
  brand_match_score integer check (brand_match_score between 0 and 100),
  brand_match_reasons jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  model_used text,
  tier text check (tier in ('fast', 'smart')),
  router_reason text,
  prompt_version text,
  credits_used integer not null default 0, -- milli-credits
  is_mock boolean not null default false,
  error text,
  rejected_reason text check (char_length(rejected_reason) <= 1000),
  scheduled_for timestamptz,
  posted_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  generation_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_org_status_idx on public.drafts (org_id, status, created_at desc);
create index drafts_generating_idx on public.drafts (generation_started_at) where status = 'generating';
create trigger drafts_touch before update on public.drafts
  for each row execute function private.touch_updated_at();

create table public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  draft_id uuid not null references public.drafts (id) on delete cascade,
  version integer not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  source public.version_source not null,
  feedback_text text check (char_length(feedback_text) <= 2000),
  model_used text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (draft_id, version)
);

create table public.approval_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  draft_id uuid not null references public.drafts (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  action public.approval_action not null,
  note text check (char_length(note) <= 2000),
  at timestamptz not null default now()
);
create index approval_events_draft_idx on public.approval_events (draft_id, at);

-- ---------------------------------------------------------------- credits
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  delta integer not null, -- milli-credits (+grant / −spend)
  reason public.ledger_reason not null,
  ref_id uuid,
  balance_after integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_org_idx on public.credit_ledger (org_id, created_at desc);

create table public.generation_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  draft_id uuid,
  user_id uuid references auth.users (id) on delete set null,
  day date not null default (now() at time zone 'utc')::date,
  est_millicredits integer not null check (est_millicredits >= 0),
  est_cost_usd numeric(12, 6) not null default 0,
  actual_millicredits integer,
  actual_cost_usd numeric(12, 6),
  status public.reservation_status not null default 'reserved',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index generation_reservations_org_day_idx on public.generation_reservations (org_id, day);
create index generation_reservations_draft_idx on public.generation_reservations (draft_id);

-- Global AI spend per UTC day: reserved (in flight) + actual (settled).
create table public.ai_daily_spend (
  day date primary key,
  reserved_usd numeric(12, 6) not null default 0,
  actual_usd numeric(12, 6) not null default 0,
  breached_at timestamptz
);

-- ---------------------------------------------------------------- RLS
alter table public.drafts enable row level security;
alter table public.draft_versions enable row level security;
alter table public.approval_events enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.generation_reservations enable row level security;
alter table public.ai_daily_spend enable row level security;

create policy drafts_select on public.drafts for select to authenticated using (private.is_org_member(org_id));
create policy draft_versions_select on public.draft_versions for select to authenticated using (private.is_org_member(org_id));
create policy approval_events_select on public.approval_events for select to authenticated using (private.is_org_member(org_id));
create policy credit_ledger_select on public.credit_ledger for select to authenticated using (private.is_org_member(org_id));
-- All writes go through the server after role checks (service role) or the RPCs below.
revoke insert, update, delete on public.drafts, public.draft_versions, public.approval_events, public.credit_ledger from authenticated, anon;
revoke all on public.generation_reservations, public.ai_daily_spend from authenticated, anon;

-- ---------------------------------------------------------------- credit functions (service role only)

-- Monthly allowance (spec §5). Allowance amounts live in app config
-- (lib/credits/plans.ts) and are passed in. Unused monthly credits don't roll
-- over: a new period tops the balance up to the allowance, so purchased pack
-- credits above it are kept (DECISIONS D-027). Caller must hold the org row lock.
create or replace function private.apply_period_grant(p_org uuid, p_allowance integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_delta integer;
begin
  select * into v_org from public.organizations where id = p_org;
  -- Advance the billing period if it has ended (free plans roll monthly).
  while v_org.plan_period_end <= now() loop
    update public.organizations
       set plan_period_start = plan_period_end,
           plan_period_end = plan_period_end + interval '1 month'
     where id = p_org
    returning * into v_org;
  end loop;
  if v_org.credits_granted_for is not null and v_org.credits_granted_for >= v_org.plan_period_start then
    return v_org.credit_balance_milli;
  end if;
  v_delta := greatest(0, p_allowance - v_org.credit_balance_milli);
  update public.organizations
     set credit_balance_milli = credit_balance_milli + v_delta,
         credits_granted_for = plan_period_start
   where id = p_org
  returning * into v_org;
  insert into public.credit_ledger (org_id, delta, reason, balance_after, note)
  values (p_org, v_delta, 'monthly_grant', v_org.credit_balance_milli, 'Monthly allowance');
  return v_org.credit_balance_milli;
end;
$$;

create or replace function public.ensure_credit_grant(p_org uuid, p_allowance integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.organizations where id = p_org for update;
  return private.apply_period_grant(p_org, p_allowance);
end;
$$;

-- Atomically checks the kill switch, global daily budget, per-org daily cap
-- and balance, then reserves the estimate (spec §5, §6.6). Concurrent calls
-- serialise on the day's spend row and the org row, so they can't overshoot.
create or replace function public.reserve_generation(
  p_org uuid,
  p_user uuid,
  p_draft uuid,
  p_est_millicredits integer,
  p_est_cost_usd numeric,
  p_daily_cap integer,
  p_allowance integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_settings public.app_settings;
  v_spend public.ai_daily_spend;
  v_balance integer;
  v_today integer;
  v_res uuid;
begin
  select * into v_settings from public.app_settings where id;
  if v_settings.ai_kill_switch then
    return jsonb_build_object('ok', false, 'reason', 'ai_paused');
  end if;

  insert into public.ai_daily_spend (day) values (v_day) on conflict (day) do nothing;
  select * into v_spend from public.ai_daily_spend where day = v_day for update;
  if v_spend.reserved_usd + v_spend.actual_usd + p_est_cost_usd > v_settings.ai_daily_budget_usd then
    if v_spend.breached_at is null then
      update public.ai_daily_spend set breached_at = now() where day = v_day;
      insert into public.events (name, props)
      values ('budget_breached', jsonb_build_object('day', v_day, 'budget_usd', v_settings.ai_daily_budget_usd,
              'spent_usd', v_spend.actual_usd, 'reserved_usd', v_spend.reserved_usd));
    end if;
    return jsonb_build_object('ok', false, 'reason', 'budget_exceeded');
  end if;

  perform 1 from public.organizations where id = p_org for update;
  v_balance := private.apply_period_grant(p_org, p_allowance);

  if p_daily_cap is not null then
    select count(*) into v_today from public.generation_reservations
     where org_id = p_org and day = v_day and status <> 'refunded';
    if v_today >= p_daily_cap then
      return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'balance', v_balance);
    end if;
  end if;

  if v_balance < p_est_millicredits then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'balance', v_balance);
  end if;

  insert into public.generation_reservations (org_id, draft_id, user_id, day, est_millicredits, est_cost_usd)
  values (p_org, p_draft, p_user, v_day, p_est_millicredits, p_est_cost_usd)
  returning id into v_res;

  update public.organizations set credit_balance_milli = credit_balance_milli - p_est_millicredits
   where id = p_org returning credit_balance_milli into v_balance;
  insert into public.credit_ledger (org_id, delta, reason, ref_id, balance_after, note)
  values (p_org, -p_est_millicredits, 'generation', p_draft, v_balance, 'Reserved');
  update public.ai_daily_spend set reserved_usd = reserved_usd + p_est_cost_usd where day = v_day;

  return jsonb_build_object('ok', true, 'reservation_id', v_res, 'balance', v_balance);
end;
$$;

-- Settles a reservation to actual usage: refunds (or charges) the difference.
create or replace function public.settle_generation(p_reservation uuid, p_actual_millicredits integer, p_actual_cost_usd numeric)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.generation_reservations;
  v_delta integer;
  v_balance integer;
begin
  select * into v_res from public.generation_reservations where id = p_reservation for update;
  if not found or v_res.status <> 'reserved' then
    return null;
  end if;
  perform 1 from public.ai_daily_spend where day = v_res.day for update;
  perform 1 from public.organizations where id = v_res.org_id for update;

  v_delta := v_res.est_millicredits - p_actual_millicredits;
  update public.organizations set credit_balance_milli = credit_balance_milli + v_delta
   where id = v_res.org_id returning credit_balance_milli into v_balance;
  if v_delta <> 0 then
    insert into public.credit_ledger (org_id, delta, reason, ref_id, balance_after, note)
    values (v_res.org_id, v_delta, 'generation', v_res.draft_id, v_balance, 'Settled to actual usage');
  end if;
  update public.ai_daily_spend
     set reserved_usd = greatest(0, reserved_usd - v_res.est_cost_usd),
         actual_usd = actual_usd + p_actual_cost_usd
   where day = v_res.day;
  update public.generation_reservations
     set status = 'settled', actual_millicredits = p_actual_millicredits, actual_cost_usd = p_actual_cost_usd, settled_at = now()
   where id = p_reservation;
  return v_balance;
end;
$$;

create or replace function public.refund_generation(p_reservation uuid, p_actual_cost_usd numeric default 0)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.generation_reservations;
  v_balance integer;
begin
  select * into v_res from public.generation_reservations where id = p_reservation for update;
  if not found or v_res.status <> 'reserved' then
    return null;
  end if;
  perform 1 from public.ai_daily_spend where day = v_res.day for update;
  perform 1 from public.organizations where id = v_res.org_id for update;
  update public.organizations set credit_balance_milli = credit_balance_milli + v_res.est_millicredits
   where id = v_res.org_id returning credit_balance_milli into v_balance;
  insert into public.credit_ledger (org_id, delta, reason, ref_id, balance_after, note)
  values (v_res.org_id, v_res.est_millicredits, 'refund', v_res.draft_id, v_balance, 'Generation failed');
  -- Any provider cost already incurred still counts against the global budget.
  update public.ai_daily_spend
     set reserved_usd = greatest(0, reserved_usd - v_res.est_cost_usd),
         actual_usd = actual_usd + coalesce(p_actual_cost_usd, 0)
   where day = v_res.day;
  update public.generation_reservations
     set status = 'refunded', actual_millicredits = 0, actual_cost_usd = p_actual_cost_usd, settled_at = now()
   where id = p_reservation;
  return v_balance;
end;
$$;

-- Marks drafts stuck in 'generating' for over 2 minutes as failed and refunds
-- them (spec §3: functions can be frozen after the client disconnects).
create or replace function public.sweep_stuck_drafts(p_older_than interval default interval '2 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft record;
  v_count integer := 0;
begin
  for v_draft in
    select id from public.drafts
     where status = 'generating' and coalesce(generation_started_at, created_at) < now() - p_older_than
     for update skip locked
  loop
    update public.drafts
       set status = case when char_length(body) > 0 then 'partial'::public.draft_status else 'failed'::public.draft_status end,
           error = 'Generation stopped before it finished. Your credits were refunded.'
     where id = v_draft.id;
    perform public.refund_generation(r.id) from public.generation_reservations r
     where r.draft_id = v_draft.id and r.status = 'reserved';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.ensure_credit_grant(uuid, integer) from public, anon, authenticated;
revoke execute on function public.reserve_generation(uuid, uuid, uuid, integer, numeric, integer, integer) from public, anon, authenticated;
revoke execute on function public.settle_generation(uuid, integer, numeric) from public, anon, authenticated;
revoke execute on function public.refund_generation(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.sweep_stuck_drafts(interval) from public, anon, authenticated;
grant execute on function public.ensure_credit_grant(uuid, integer) to service_role;
grant execute on function public.reserve_generation(uuid, uuid, uuid, integer, numeric, integer, integer) to service_role;
grant execute on function public.settle_generation(uuid, integer, numeric) to service_role;
grant execute on function public.refund_generation(uuid, numeric) to service_role;
grant execute on function public.sweep_stuck_drafts(interval) to service_role;

-- Members can see their balance (column is server-owned; already readable via org_select).
