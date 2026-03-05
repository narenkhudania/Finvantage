begin;

create table if not exists public.referral_identity_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('apply_referral', 'checkout_referral', 'payment_verify', 'manual_review')),
  referral_code text,
  ip_hash text,
  user_agent_hash text,
  device_fingerprint_hash text,
  email_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_identity_signals_user_created_idx
  on public.referral_identity_signals(user_id, created_at desc);

create index if not exists referral_identity_signals_referral_code_idx
  on public.referral_identity_signals(referral_code, created_at desc);

create index if not exists referral_identity_signals_ip_hash_idx
  on public.referral_identity_signals(ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists referral_identity_signals_device_hash_idx
  on public.referral_identity_signals(device_fingerprint_hash, created_at desc)
  where device_fingerprint_hash is not null;

create index if not exists referral_identity_signals_email_hash_idx
  on public.referral_identity_signals(email_hash, created_at desc)
  where email_hash is not null;

alter table if exists public.referral_identity_signals enable row level security;

drop policy if exists referral_identity_signals_select on public.referral_identity_signals;
create policy referral_identity_signals_select
on public.referral_identity_signals
for select
using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists referral_identity_signals_manage on public.referral_identity_signals;
create policy referral_identity_signals_manage
on public.referral_identity_signals
for all
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create or replace function public.billing_referral_risk_assessment(
  p_referrer_user_id uuid,
  p_referred_user_id uuid,
  p_lookback_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lookback_days integer := greatest(1, coalesce(p_lookback_days, 90));
  v_since timestamptz := now() - make_interval(days => v_lookback_days);
  v_same_ip_hash boolean := false;
  v_same_user_agent_hash boolean := false;
  v_same_device_hash boolean := false;
  v_same_email_hash boolean := false;
  v_referred_ip_hash text;
  v_referred_user_agent_hash text;
  v_referred_device_hash text;
  v_referred_email_hash text;
  v_ip_cluster_user_count integer := 0;
  v_device_cluster_user_count integer := 0;
  v_email_cluster_user_count integer := 0;
  v_risk_score integer := 0;
  v_is_high_risk boolean := false;
  v_reasons text[] := '{}'::text[];
begin
  if p_referrer_user_id is null or p_referred_user_id is null then
    return jsonb_build_object(
      'is_high_risk', false,
      'risk_score', 0,
      'reason', 'invalid_input'
    );
  end if;

  if p_referrer_user_id = p_referred_user_id then
    return jsonb_build_object(
      'is_high_risk', true,
      'risk_score', 100,
      'reason', 'self_referral',
      'same_ip_hash', false,
      'same_user_agent_hash', false,
      'same_device_hash', false,
      'same_email_hash', false,
      'ip_cluster_user_count', 0,
      'device_cluster_user_count', 0,
      'email_cluster_user_count', 0,
      'reasons', to_jsonb(array['self_referral']::text[]),
      'lookback_days', v_lookback_days
    );
  end if;

  select
    s.ip_hash,
    s.user_agent_hash,
    s.device_fingerprint_hash,
    s.email_hash
  into
    v_referred_ip_hash,
    v_referred_user_agent_hash,
    v_referred_device_hash,
    v_referred_email_hash
  from public.referral_identity_signals s
  where s.user_id = p_referred_user_id
    and s.created_at >= v_since
  order by s.created_at desc
  limit 1;

  if v_referred_ip_hash is not null then
    select count(distinct s.user_id)::integer
    into v_ip_cluster_user_count
    from public.referral_identity_signals s
    where s.ip_hash = v_referred_ip_hash
      and s.created_at >= v_since;
  end if;

  if v_referred_device_hash is not null then
    select count(distinct s.user_id)::integer
    into v_device_cluster_user_count
    from public.referral_identity_signals s
    where s.device_fingerprint_hash = v_referred_device_hash
      and s.created_at >= v_since;
  end if;

  if v_referred_email_hash is not null then
    select count(distinct s.user_id)::integer
    into v_email_cluster_user_count
    from public.referral_identity_signals s
    where s.email_hash = v_referred_email_hash
      and s.created_at >= v_since;
  end if;

  select exists (
    select 1
    from public.referral_identity_signals referrer
    join public.referral_identity_signals referred
      on referred.ip_hash = referrer.ip_hash
    where referrer.user_id = p_referrer_user_id
      and referred.user_id = p_referred_user_id
      and referrer.created_at >= v_since
      and referred.created_at >= v_since
      and referrer.ip_hash is not null
  ) into v_same_ip_hash;

  select exists (
    select 1
    from public.referral_identity_signals referrer
    join public.referral_identity_signals referred
      on referred.user_agent_hash = referrer.user_agent_hash
    where referrer.user_id = p_referrer_user_id
      and referred.user_id = p_referred_user_id
      and referrer.created_at >= v_since
      and referred.created_at >= v_since
      and referrer.user_agent_hash is not null
  ) into v_same_user_agent_hash;

  select exists (
    select 1
    from public.referral_identity_signals referrer
    join public.referral_identity_signals referred
      on referred.device_fingerprint_hash = referrer.device_fingerprint_hash
    where referrer.user_id = p_referrer_user_id
      and referred.user_id = p_referred_user_id
      and referrer.created_at >= v_since
      and referred.created_at >= v_since
      and referrer.device_fingerprint_hash is not null
  ) into v_same_device_hash;

  select exists (
    select 1
    from public.referral_identity_signals referrer
    join public.referral_identity_signals referred
      on referred.email_hash = referrer.email_hash
    where referrer.user_id = p_referrer_user_id
      and referred.user_id = p_referred_user_id
      and referrer.created_at >= v_since
      and referred.created_at >= v_since
      and referrer.email_hash is not null
  ) into v_same_email_hash;

  if v_same_email_hash then
    v_risk_score := v_risk_score + 90;
    v_reasons := array_append(v_reasons, 'same_normalized_email');
  end if;

  if v_same_device_hash then
    v_risk_score := v_risk_score + 70;
    v_reasons := array_append(v_reasons, 'same_device_fingerprint');
  end if;

  if v_same_ip_hash then
    v_risk_score := v_risk_score + 25;
    v_reasons := array_append(v_reasons, 'same_ip_hash');
  end if;

  if v_same_user_agent_hash then
    v_risk_score := v_risk_score + 10;
    v_reasons := array_append(v_reasons, 'same_user_agent_hash');
  end if;

  if v_ip_cluster_user_count >= 6 then
    v_risk_score := v_risk_score + 25;
    v_reasons := array_append(v_reasons, 'ip_cluster');
  end if;

  if v_device_cluster_user_count >= 3 then
    v_risk_score := v_risk_score + 40;
    v_reasons := array_append(v_reasons, 'device_cluster');
  end if;

  if v_email_cluster_user_count >= 2 then
    v_risk_score := v_risk_score + 50;
    v_reasons := array_append(v_reasons, 'email_cluster');
  end if;

  v_is_high_risk := v_risk_score >= 60;

  return jsonb_build_object(
    'is_high_risk', v_is_high_risk,
    'risk_score', v_risk_score,
    'same_ip_hash', v_same_ip_hash,
    'same_user_agent_hash', v_same_user_agent_hash,
    'same_device_hash', v_same_device_hash,
    'same_email_hash', v_same_email_hash,
    'ip_cluster_user_count', coalesce(v_ip_cluster_user_count, 0),
    'device_cluster_user_count', coalesce(v_device_cluster_user_count, 0),
    'email_cluster_user_count', coalesce(v_email_cluster_user_count, 0),
    'reason', case when v_is_high_risk then 'high_risk_signal_overlap' else 'ok' end,
    'reasons', to_jsonb(coalesce(v_reasons, '{}'::text[])),
    'lookback_days', v_lookback_days
  );
end;
$$;

revoke all on function public.billing_referral_risk_assessment(uuid, uuid, integer) from public;
grant execute on function public.billing_referral_risk_assessment(uuid, uuid, integer) to service_role;

commit;
