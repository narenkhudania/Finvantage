-- Recovery migration for mixed environments:
-- 1) backfill missing billing/profile columns used by current UI
-- 2) make income_profiles upsert target deterministic
-- 3) provide RPC fallback for points award when local /api routes are unavailable

begin;

alter table if exists public.family_members
  add column if not exists pension numeric default 0;

alter table if exists public.income_profiles
  add column if not exists pension numeric default 0;

create unique index if not exists income_profiles_user_owner_ref_key
  on public.income_profiles(user_id, owner_ref);

alter table if exists public.insurance_analysis_config
  add column if not exists insurance_type text default 'Term',
  add column if not exists insurance_amount numeric default 0,
  add column if not exists term_insurance_amount numeric default 0,
  add column if not exists health_insurance_amount numeric default 0;

alter table if exists public.user_billing_profiles
  add column if not exists points_frozen boolean not null default false;

create or replace function public.billing_award_points_client(
  p_event_type text,
  p_source_ref text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_base_points integer := 0;
  v_monthly_cap integer := 1000;
  v_points_expiry_months integer := 12;
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_day_start timestamptz := date_trunc('day', now());
  v_day_end timestamptz := date_trunc('day', now()) + interval '1 day';
  v_once_events text[] := array['profile_completion', 'risk_profile_completed'];
  v_existing_count integer := 0;
  v_used_this_month integer := 0;
  v_remaining_cap integer := 0;
  v_award integer := 0;
  v_expiry timestamptz;
  v_points_frozen boolean := false;
  v_template_active boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'awarded', 0,
      'skipped', true,
      'reason', 'not_authenticated',
      'remainingCap', 0
    );
  end if;

  case p_event_type
    when 'daily_login' then v_base_points := 1;
    when 'profile_completion' then v_base_points := 5;
    when 'risk_profile_completed' then v_base_points := 5;
    when 'goal_added' then v_base_points := 5;
    when 'report_generated' then v_base_points := 5;
    when 'subscription_payment_success' then v_base_points := 50;
    else
      return jsonb_build_object(
        'awarded', 0,
        'skipped', true,
        'reason', 'unsupported_event',
        'remainingCap', 0
      );
  end case;

  select coalesce(points_frozen, false)
  into v_points_frozen
  from public.user_billing_profiles
  where user_id = v_user_id;

  if v_points_frozen then
    return jsonb_build_object(
      'awarded', 0,
      'skipped', true,
      'reason', 'points_frozen',
      'remainingCap', 0
    );
  end if;

  if p_event_type = 'daily_login' then
    select count(*)
    into v_existing_count
    from public.reward_points_ledger
    where user_id = v_user_id
      and event_type = 'daily_login'
      and points > 0
      and created_at >= v_day_start
      and created_at < v_day_end;

    if v_existing_count > 0 then
      return jsonb_build_object(
        'awarded', 0,
        'skipped', true,
        'reason', 'already_awarded_today',
        'remainingCap', 0
      );
    end if;
  end if;

  if p_event_type = any(v_once_events) then
    select count(*)
    into v_existing_count
    from public.reward_points_ledger
    where user_id = v_user_id
      and event_type = p_event_type
      and points > 0;

    if v_existing_count > 0 then
      return jsonb_build_object(
        'awarded', 0,
        'skipped', true,
        'reason', 'already_awarded_once',
        'remainingCap', 0
      );
    end if;
  end if;

  select coalesce(sum(points), 0)::integer
  into v_used_this_month
  from public.reward_points_ledger
  where user_id = v_user_id
    and points > 0
    and created_at >= v_month_start
    and created_at < v_month_end;

  v_remaining_cap := greatest(0, v_monthly_cap - v_used_this_month);
  v_award := least(v_base_points, v_remaining_cap);

  if v_award <= 0 then
    return jsonb_build_object(
      'awarded', 0,
      'skipped', true,
      'reason', 'monthly_cap_reached',
      'remainingCap', 0
    );
  end if;

  v_expiry := now() + make_interval(months => v_points_expiry_months);

  insert into public.reward_points_ledger (
    user_id,
    event_type,
    points,
    source_ref,
    metadata,
    expires_at,
    created_at
  )
  values (
    v_user_id,
    p_event_type,
    v_award,
    p_source_ref,
    coalesce(p_metadata, '{}'::jsonb),
    v_expiry,
    now()
  );

  if to_regclass('public.billing_message_templates') is not null
     and to_regclass('public.billing_message_events') is not null then
    execute
      'select exists (
         select 1
         from public.billing_message_templates
         where template_key = $1 and is_active = true
       )'
    into v_template_active
    using 'billing_points_earned_in_app';

    if v_template_active then
      execute
        'insert into public.billing_message_events
          (user_id, template_key, channel, status, payload, created_at)
         values
          ($1, $2, $3, $4, $5, $6)'
      using
        v_user_id,
        'billing_points_earned_in_app',
        'in_app',
        'queued',
        jsonb_build_object('eventType', p_event_type, 'points', v_award),
        now();
    end if;
  end if;

  return jsonb_build_object(
    'awarded', v_award,
    'skipped', false,
    'reason', null,
    'remainingCap', greatest(0, v_remaining_cap - v_award)
  );
exception
  when others then
    return jsonb_build_object(
      'awarded', 0,
      'skipped', true,
      'reason', 'rpc_error',
      'remainingCap', 0
    );
end;
$$;

grant execute on function public.billing_award_points_client(text, text, jsonb) to authenticated;

commit;
