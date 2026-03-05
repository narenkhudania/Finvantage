begin;

create table if not exists public.request_rate_limits (
  scope text not null,
  identity_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, identity_hash, window_start)
);

create index if not exists request_rate_limits_scope_window_idx
  on public.request_rate_limits(scope, window_start desc);

create or replace function public.rate_limit_allow(
  p_scope text,
  p_identity_hash text,
  p_window_seconds integer default 60,
  p_max_requests integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'default');
  v_identity text := coalesce(nullif(trim(p_identity_hash), ''), 'anonymous');
  v_window_seconds integer := greatest(1, coalesce(p_window_seconds, 60));
  v_max integer := greatest(1, coalesce(p_max_requests, 30));
  v_epoch bigint := floor(extract(epoch from now()));
  v_bucket bigint := (v_epoch / v_window_seconds) * v_window_seconds;
  v_window_start timestamptz := to_timestamp(v_bucket);
  v_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext(v_scope), hashtext(v_identity || ':' || v_bucket::text));

  insert into public.request_rate_limits (
    scope,
    identity_hash,
    window_start,
    request_count,
    created_at,
    updated_at
  )
  values (
    v_scope,
    v_identity,
    v_window_start,
    1,
    now(),
    now()
  )
  on conflict (scope, identity_hash, window_start)
  do update
  set request_count = public.request_rate_limits.request_count + 1,
      updated_at = now()
  returning request_count into v_count;

  delete from public.request_rate_limits
  where scope = v_scope
    and identity_hash = v_identity
    and window_start < now() - interval '2 days';

  return jsonb_build_object(
    'allowed', v_count <= v_max,
    'count', v_count,
    'limit', v_max,
    'windowSeconds', v_window_seconds,
    'windowStart', v_window_start
  );
end;
$$;

grant execute on function public.rate_limit_allow(text, text, integer, integer) to service_role;
grant execute on function public.rate_limit_allow(text, text, integer, integer) to authenticated;

commit;

