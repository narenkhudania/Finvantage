-- AI advisory security hardening:
-- - DB-backed per-user quota windows (minute/day)
-- - Atomic quota consume RPC (service role only)
-- - Locked-down table exposure via RLS

begin;

create table if not exists public.ai_advice_quota_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_type text not null check (window_type in ('minute', 'day')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, window_type, window_start)
);

create index if not exists ai_advice_quota_windows_updated_idx
  on public.ai_advice_quota_windows(updated_at desc);

create or replace function public.ai_advice_consume_quota(
  p_user_id uuid,
  p_minute_limit integer default 8,
  p_daily_limit integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_day_start timestamptz := date_trunc('day', v_now);
  v_minute_count integer;
  v_daily_count integer;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'missing_user',
      'minuteCount', 0,
      'dailyCount', 0,
      'minuteRemaining', 0,
      'dailyRemaining', 0
    );
  end if;

  insert into public.ai_advice_quota_windows (user_id, window_type, window_start, request_count, updated_at)
  values
    (p_user_id, 'minute', v_minute_start, 0, v_now),
    (p_user_id, 'day', v_day_start, 0, v_now)
  on conflict (user_id, window_type, window_start) do nothing;

  update public.ai_advice_quota_windows
  set request_count = request_count + 1, updated_at = v_now
  where user_id = p_user_id
    and window_type = 'minute'
    and window_start = v_minute_start
    and request_count < greatest(1, p_minute_limit)
  returning request_count into v_minute_count;

  if v_minute_count is null then
    select request_count
      into v_minute_count
    from public.ai_advice_quota_windows
    where user_id = p_user_id
      and window_type = 'minute'
      and window_start = v_minute_start;

    select request_count
      into v_daily_count
    from public.ai_advice_quota_windows
    where user_id = p_user_id
      and window_type = 'day'
      and window_start = v_day_start;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'minute_limit',
      'minuteCount', coalesce(v_minute_count, greatest(1, p_minute_limit)),
      'dailyCount', coalesce(v_daily_count, 0),
      'minuteRemaining', 0,
      'dailyRemaining', greatest(0, greatest(1, p_daily_limit) - coalesce(v_daily_count, 0))
    );
  end if;

  update public.ai_advice_quota_windows
  set request_count = request_count + 1, updated_at = v_now
  where user_id = p_user_id
    and window_type = 'day'
    and window_start = v_day_start
    and request_count < greatest(1, p_daily_limit)
  returning request_count into v_daily_count;

  if v_daily_count is null then
    -- Roll back minute token when daily limit fails.
    update public.ai_advice_quota_windows
    set request_count = greatest(0, request_count - 1), updated_at = v_now
    where user_id = p_user_id
      and window_type = 'minute'
      and window_start = v_minute_start;

    select request_count
      into v_daily_count
    from public.ai_advice_quota_windows
    where user_id = p_user_id
      and window_type = 'day'
      and window_start = v_day_start;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'minuteCount', greatest(0, v_minute_count - 1),
      'dailyCount', coalesce(v_daily_count, greatest(1, p_daily_limit)),
      'minuteRemaining', greatest(0, greatest(1, p_minute_limit) - greatest(0, v_minute_count - 1)),
      'dailyRemaining', 0
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'minuteCount', v_minute_count,
    'dailyCount', v_daily_count,
    'minuteRemaining', greatest(0, greatest(1, p_minute_limit) - v_minute_count),
    'dailyRemaining', greatest(0, greatest(1, p_daily_limit) - v_daily_count)
  );
end;
$$;

revoke all on function public.ai_advice_consume_quota(uuid, integer, integer) from public;
grant execute on function public.ai_advice_consume_quota(uuid, integer, integer) to service_role;

alter table public.ai_advice_quota_windows enable row level security;

commit;
