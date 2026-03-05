begin;

-- Idempotency guards for redemption/coupon rows used by payment finalization.
create unique index if not exists reward_points_redeem_fifo_once_idx
  on public.reward_points_ledger (user_id, event_type, source_ref, ((metadata->>'source_ledger_id')))
  where event_type = 'points_redeemed'
    and source_ref is not null
    and (metadata ? 'source_ledger_id');

create unique index if not exists subscription_coupon_redemptions_payment_uidx
  on public.subscription_coupon_redemptions(payment_id)
  where payment_id is not null;

create or replace function public.billing_finalize_payment(
  p_user_id uuid,
  p_payment_id uuid,
  p_order_id text default null,
  p_provider_payment_id text default null,
  p_provider_subscription_id text default null,
  p_points_expiry_months integer default 12,
  p_referrer_points integer default 25,
  p_referred_points integer default 50,
  p_referral_monthly_cap integer default 100,
  p_payment_success_points integer default 50,
  p_retry_days jsonb default '[1,3,5]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_payment public.payments%rowtype;
  v_payment_meta jsonb;
  v_plan_code text;
  v_billing_months integer;
  v_bonus_days integer;
  v_requested_points integer;
  v_coupon_code text;
  v_coupon_discount numeric := 0;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_latest_sub public.subscriptions%rowtype;
  v_has_active_paid boolean := false;
  v_subscription_id uuid;
  v_consumed_points integer := 0;
  v_points_frozen boolean := false;
  v_available record;
  v_take integer;
  v_to_consume integer := 0;
  v_rowcount integer := 0;
  v_referred_by_user_id uuid;
  v_referred_by_code text;
  v_successful_paid_count integer := 0;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_month_ref_count integer := 0;
  v_cap_reached boolean := false;
  v_referral_status text := 'rewarded';
  v_referral_inserted integer := 0;
  v_expiry timestamptz;
  v_existing_subscription_id uuid;
  v_existing_sub public.subscriptions%rowtype;
begin
  if p_user_id is null or p_payment_id is null then
    raise exception 'Missing required parameters.';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Payment record not found.';
  end if;

  v_payment_meta := coalesce(v_payment.metadata, '{}'::jsonb);

  if lower(coalesce(v_payment.status, '')) = 'captured' and (v_payment_meta ? 'created_subscription_id') then
    v_existing_subscription_id := nullif(v_payment_meta->>'created_subscription_id', '')::uuid;
    if v_existing_subscription_id is not null then
      select *
      into v_existing_sub
      from public.subscriptions
      where id = v_existing_subscription_id
        and user_id = p_user_id
      limit 1;

      if found then
        return jsonb_build_object(
          'verified', true,
          'idempotent', true,
          'subscription_id', v_existing_sub.id,
          'plan_code', v_existing_sub.plan_code,
          'status', v_existing_sub.status,
          'start_at', v_existing_sub.start_at,
          'end_at', v_existing_sub.end_at,
          'access_state', coalesce(v_existing_sub.access_state, 'active'),
          'consumed_points', coalesce((v_payment_meta->>'consumed_points')::integer, 0)
        );
      end if;
    end if;
  end if;

  v_plan_code := coalesce(v_payment_meta->>'plan_code', '');
  if v_plan_code = '' then
    raise exception 'Invalid payment metadata. Missing plan.';
  end if;

  v_billing_months := greatest(1, coalesce(nullif(v_payment_meta->>'billing_months', '')::integer, 1));
  v_bonus_days := greatest(0, coalesce(nullif(v_payment_meta->>'bonus_days', '')::integer, 0));
  v_requested_points := greatest(0, coalesce(nullif(v_payment_meta->>'points_redeemed', '')::integer, 0));
  v_coupon_code := nullif(upper(trim(coalesce(v_payment.coupon_code, ''))), '');
  v_coupon_discount := greatest(0, coalesce(nullif(v_payment_meta->>'coupon_discount', '')::numeric, 0));

  -- Upgrade applies from next cycle for active paid subscriptions.
  select *
  into v_latest_sub
  from public.subscriptions
  where user_id = p_user_id
    and status in ('active', 'past_due')
    and coalesce(amount, 0) > 0
    and end_at is not null
    and end_at > v_now
  order by end_at desc
  limit 1
  for update;

  if found then
    v_has_active_paid := true;
    v_start_at := v_latest_sub.end_at;
  else
    v_start_at := v_now;
  end if;

  v_end_at := v_start_at
    + make_interval(months => v_billing_months)
    + make_interval(days => v_bonus_days);

  -- FIFO points consumption with row locks and idempotency guard.
  select coalesce(points_frozen, false)
  into v_points_frozen
  from public.user_billing_profiles
  where user_id = p_user_id;

  if not coalesce(v_points_frozen, false) and v_requested_points > 0 then
    select coalesce(sum(points), 0)::integer
    into v_to_consume
    from public.reward_points_ledger
    where user_id = p_user_id
      and (expires_at is null or expires_at >= v_now);

    v_to_consume := greatest(0, least(v_requested_points, v_to_consume));

    for v_available in
      select id, points, expires_at
      from public.reward_points_ledger
      where user_id = p_user_id
        and points > 0
        and (expires_at is null or expires_at >= v_now)
      order by created_at asc
      for update
    loop
      exit when v_to_consume <= 0;

      v_take := least(v_available.points, v_to_consume);
      if v_take <= 0 then
        continue;
      end if;

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
        p_user_id,
        'points_redeemed',
        -v_take,
        p_payment_id::text,
        jsonb_build_object(
          'source_ledger_id', v_available.id,
          'reason', 'plan_extension_redeem'
        ),
        null,
        v_now
      )
      on conflict do nothing;

      get diagnostics v_rowcount = row_count;
      if v_rowcount > 0 then
        v_to_consume := v_to_consume - v_take;
        v_consumed_points := v_consumed_points + v_take;
      end if;
    end loop;
  end if;

  insert into public.subscriptions (
    user_id,
    plan_code,
    status,
    billing_cycle,
    amount,
    currency,
    start_at,
    end_at,
    cancel_at_period_end,
    auto_renew,
    provider,
    provider_subscription_id,
    provider_customer_id,
    provider_plan_id,
    current_period_start,
    current_period_end,
    access_state,
    last_payment_status,
    failed_attempt_count,
    past_due_since,
    next_retry_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_plan_code,
    'active',
    (v_billing_months::text || '_month'),
    coalesce(v_payment.amount, 0),
    'INR',
    v_start_at,
    v_end_at,
    false,
    true,
    'razorpay',
    nullif(p_provider_subscription_id, ''),
    null,
    null,
    v_start_at,
    v_end_at,
    'active',
    'captured',
    0,
    null,
    null,
    jsonb_build_object(
      'source_payment_id', p_payment_id,
      'coupon_code', v_coupon_code,
      'coupon_discount', v_coupon_discount,
      'points_redeemed', v_consumed_points,
      'bonus_days', v_bonus_days,
      'upgrade_applies_from', case when v_has_active_paid then v_start_at else v_now end,
      'retry_policy_days', coalesce(p_retry_days, '[1,3,5]'::jsonb)
    ),
    v_now,
    v_now
  )
  returning id into v_subscription_id;

  update public.payments
  set
    status = 'captured',
    provider_order_id = nullif(coalesce(p_order_id, provider_order_id), ''),
    provider_payment_id = nullif(coalesce(p_provider_payment_id, provider_payment_id), ''),
    settled_at = v_now,
    metadata = coalesce(v_payment_meta, '{}'::jsonb)
      || jsonb_build_object(
        'verified_at', v_now,
        'verified_by', 'rpc/billing_finalize_payment',
        'consumed_points', v_consumed_points,
        'created_subscription_id', v_subscription_id,
        'provider_subscription_id', nullif(p_provider_subscription_id, '')
      )
  where id = p_payment_id
    and user_id = p_user_id;

  if v_coupon_code is not null and not exists (
    select 1
    from public.subscription_coupon_redemptions
    where payment_id = p_payment_id
  ) then
    insert into public.subscription_coupon_redemptions (
      coupon_id,
      user_id,
      payment_id,
      subscription_id,
      amount_discount,
      metadata,
      redeemed_at,
      created_at
    )
    select
      c.id,
      p_user_id,
      p_payment_id,
      v_subscription_id,
      v_coupon_discount,
      jsonb_build_object('plan_code', v_plan_code),
      v_now,
      v_now
    from public.subscription_coupons c
    where upper(c.code) = v_coupon_code
    limit 1;
  end if;

  update public.user_billing_profiles
  set
    trial_consumed = true,
    updated_at = v_now
  where user_id = p_user_id;

  v_expiry := v_now + make_interval(months => greatest(1, p_points_expiry_months));

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
    p_user_id,
    'subscription_payment_success',
    greatest(0, p_payment_success_points),
    p_payment_id::text,
    jsonb_build_object('subscription_id', v_subscription_id),
    v_expiry,
    v_now
  );

  -- Referral reward after first successful paid subscription.
  select referred_by_user_id, referred_by_code
  into v_referred_by_user_id, v_referred_by_code
  from public.user_billing_profiles
  where user_id = p_user_id;

  if v_referred_by_user_id is not null and coalesce(v_referred_by_code, '') <> '' then
    select count(*)
    into v_successful_paid_count
    from public.payments
    where user_id = p_user_id
      and status in ('captured', 'paid', 'authorized', 'succeeded')
      and amount > 0;

    if v_successful_paid_count = 1 then
      v_month_start := date_trunc('month', v_now);
      v_month_end := v_month_start + interval '1 month';

      select count(*)
      into v_month_ref_count
      from public.referral_events
      where referrer_user_id = v_referred_by_user_id
        and status = 'rewarded'
        and created_at >= v_month_start
        and created_at < v_month_end;

      v_cap_reached := v_month_ref_count >= greatest(1, p_referral_monthly_cap);
      v_referral_status := case when v_cap_reached then 'fraud_hold' else 'rewarded' end;

      insert into public.referral_events (
        referrer_user_id,
        referred_user_id,
        referral_code,
        status,
        metadata,
        created_at
      )
      values (
        v_referred_by_user_id,
        p_user_id,
        v_referred_by_code,
        v_referral_status,
        jsonb_build_object('payment_id', p_payment_id, 'cap_reached', v_cap_reached),
        v_now
      )
      on conflict (referred_user_id) do nothing;

      get diagnostics v_referral_inserted = row_count;

      if v_referral_inserted > 0 then
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
          p_user_id,
          'referral_referred_reward',
          greatest(0, p_referred_points),
          p_payment_id::text,
          jsonb_build_object('referrer_user_id', v_referred_by_user_id, 'referral_code', v_referred_by_code),
          v_expiry,
          v_now
        );

        if not v_cap_reached then
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
            v_referred_by_user_id,
            'referral_referrer_reward',
            greatest(0, p_referrer_points),
            p_payment_id::text,
            jsonb_build_object('referred_user_id', p_user_id, 'referral_code', v_referred_by_code),
            v_expiry,
            v_now
          );
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'verified', true,
    'idempotent', false,
    'subscription_id', v_subscription_id,
    'plan_code', v_plan_code,
    'status', 'active',
    'start_at', v_start_at,
    'end_at', v_end_at,
    'access_state', 'active',
    'consumed_points', v_consumed_points
  );
end;
$$;

revoke all on function public.billing_finalize_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  jsonb
) from public;

grant execute on function public.billing_finalize_payment(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  jsonb
) to service_role;

commit;
