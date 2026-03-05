begin;

create or replace function public.billing_award_points_client_v2(
  p_event_type text,
  p_source_ref text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_monthly_cap integer default 1000,
  p_points_expiry_months integer default 12,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_now timestamptz := now();
  v_base_points integer := 0;
  v_monthly_cap integer := greatest(0, coalesce(p_monthly_cap, 1000));
  v_points_expiry_months integer := greatest(1, coalesce(p_points_expiry_months, 12));
  v_month_start timestamptz := date_trunc('month', v_now);
  v_month_end timestamptz := date_trunc('month', v_now) + interval '1 month';
  v_day_start timestamptz := date_trunc('day', v_now);
  v_day_end timestamptz := date_trunc('day', v_now) + interval '1 day';
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

  perform pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    (extract(year from v_month_start)::integer * 100) + extract(month from v_month_start)::integer
  );

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

  if p_source_ref is not null and btrim(p_source_ref) <> '' then
    select count(*)
    into v_existing_count
    from public.reward_points_ledger
    where user_id = v_user_id
      and event_type = p_event_type
      and source_ref = p_source_ref
      and points > 0;

    if v_existing_count > 0 then
      return jsonb_build_object(
        'awarded', 0,
        'skipped', true,
        'reason', 'already_awarded_source',
        'remainingCap', 0
      );
    end if;
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

  v_expiry := v_now + make_interval(months => v_points_expiry_months);

  begin
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
      v_now
    );
  exception
    when unique_violation then
      return jsonb_build_object(
        'awarded', 0,
        'skipped', true,
        'reason', 'duplicate_request',
        'remainingCap', v_remaining_cap
      );
  end;

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
        v_now;
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

grant execute on function public.billing_award_points_client_v2(text, text, jsonb, integer, integer, uuid) to authenticated;
grant execute on function public.billing_award_points_client_v2(text, text, jsonb, integer, integer, uuid) to service_role;

commit;
