begin;

create table if not exists public.billing_dead_letter_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  event_id text not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'replayed', 'ignored', 'failed')),
  replay_count integer not null default 0,
  last_replayed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_dead_letter_provider_event_uidx
  on public.billing_dead_letter_events(provider, event_id);

create index if not exists billing_dead_letter_status_idx
  on public.billing_dead_letter_events(status, created_at desc);

create table if not exists public.billing_error_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  severity text not null default 'error' check (severity in ('warn', 'error', 'critical')),
  error_code text,
  error_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_error_events_source_idx
  on public.billing_error_events(source, created_at desc);

create table if not exists public.subscription_coupon_reservations (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.subscription_coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create unique index if not exists subscription_coupon_reservation_payment_uidx
  on public.subscription_coupon_reservations(payment_id);

create index if not exists subscription_coupon_reservation_coupon_idx
  on public.subscription_coupon_reservations(coupon_id, status, created_at desc);

create or replace function public.billing_reserve_coupon_for_payment(
  p_user_id uuid,
  p_coupon_code text,
  p_plan_code text,
  p_payment_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_coupon public.subscription_coupons%rowtype;
  v_total_usage integer := 0;
  v_user_usage integer := 0;
  v_total_reserved integer := 0;
  v_user_reserved integer := 0;
  v_discount numeric := 0;
  v_discount_type text;
  v_discount_value numeric := 0;
begin
  if p_user_id is null or p_payment_id is null or p_coupon_code is null or btrim(p_coupon_code) = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(hashtext(upper(trim(p_coupon_code))));

  select *
  into v_coupon
  from public.subscription_coupons
  where upper(code) = upper(trim(p_coupon_code))
    and is_active = true
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_coupon');
  end if;

  if v_coupon.valid_from is not null and v_now < v_coupon.valid_from then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;

  if v_coupon.valid_until is not null and v_now > v_coupon.valid_until then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if coalesce(array_length(v_coupon.applies_to_plan_codes, 1), 0) > 0
     and not (p_plan_code = any(v_coupon.applies_to_plan_codes)) then
    return jsonb_build_object('ok', false, 'reason', 'plan_not_eligible');
  end if;

  select count(*)
  into v_total_usage
  from public.subscription_coupon_redemptions
  where coupon_id = v_coupon.id;

  select count(*)
  into v_user_usage
  from public.subscription_coupon_redemptions
  where coupon_id = v_coupon.id
    and user_id = p_user_id;

  select count(*)
  into v_total_reserved
  from public.subscription_coupon_reservations
  where coupon_id = v_coupon.id
    and status = 'reserved';

  select count(*)
  into v_user_reserved
  from public.subscription_coupon_reservations
  where coupon_id = v_coupon.id
    and user_id = p_user_id
    and status = 'reserved';

  if v_coupon.usage_limit_total is not null
     and (v_total_usage + v_total_reserved) >= v_coupon.usage_limit_total then
    return jsonb_build_object('ok', false, 'reason', 'usage_limit_total_reached');
  end if;

  if v_coupon.usage_limit_per_user is not null
     and (v_user_usage + v_user_reserved) >= v_coupon.usage_limit_per_user then
    return jsonb_build_object('ok', false, 'reason', 'usage_limit_per_user_reached');
  end if;

  v_discount_type := lower(coalesce(v_coupon.discount_type, 'percentage'));
  v_discount_value := greatest(0, coalesce(v_coupon.discount_value, 0));

  if v_discount_type = 'flat' then
    v_discount := v_discount_value;
  else
    v_discount := greatest(0, coalesce(p_amount, 0)) * (v_discount_value / 100.0);
  end if;

  if v_coupon.max_discount_amount is not null then
    v_discount := least(v_discount, greatest(0, v_coupon.max_discount_amount));
  end if;

  v_discount := greatest(0, least(greatest(0, coalesce(p_amount, 0)), round(v_discount::numeric, 2)));

  insert into public.subscription_coupon_reservations (
    coupon_id,
    user_id,
    payment_id,
    status,
    created_at
  )
  values (
    v_coupon.id,
    p_user_id,
    p_payment_id,
    'reserved',
    v_now
  )
  on conflict (payment_id) do update
  set coupon_id = excluded.coupon_id,
      user_id = excluded.user_id,
      status = 'reserved';

  return jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'code', upper(v_coupon.code),
    'discount', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'max_discount_amount', v_coupon.max_discount_amount,
    'stackable', coalesce(v_coupon.stackable, true),
    'recurring_allowed', coalesce(v_coupon.recurring_allowed, true),
    'valid_until', v_coupon.valid_until,
    'applies_to_plan_codes', coalesce(to_jsonb(v_coupon.applies_to_plan_codes), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.billing_reserve_coupon_for_payment(uuid, text, text, uuid, numeric) from public;
grant execute on function public.billing_reserve_coupon_for_payment(uuid, text, text, uuid, numeric) to service_role;

commit;

