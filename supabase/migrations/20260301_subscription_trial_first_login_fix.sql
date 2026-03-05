-- Align migrated-trial behavior to first-login activation (one-time).
-- Also hard-disables any legacy free-plan access states.

alter table if exists public.user_billing_profiles
  add column if not exists trial_eligible boolean not null default false,
  add column if not exists trial_activated_at timestamptz;

create index if not exists user_billing_profiles_trial_eligible_idx
  on public.user_billing_profiles(trial_eligible)
  where trial_eligible = true;

-- Disable any legacy free pricing cards if present.
update public.billing_plans
set
  is_active = false,
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'free_plan_removed', true,
    'free_plan_removed_at', now()
  )
where
  lower(plan_code) like '%free%'
  or lower(display_name) like '%free%'
  or (amount_inr = 0 and lower(plan_code) not like '%trial%');

-- Expire legacy free subscriptions if they still exist.
update public.subscriptions
set
  status = 'expired',
  access_state = 'blocked',
  end_at = coalesce(end_at, now()),
  auto_renew = false,
  cancel_at_period_end = true,
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'free_plan_removed', true,
    'free_plan_removed_at', now()
  )
where
  (
    lower(plan_code) like '%free%'
    or lower(plan_code) = 'starter'
  )
  and status in ('active', 'trialing', 'past_due');

-- Expire previously auto-seeded migrated trials so trial starts only on first login.
update public.subscriptions
set
  status = 'expired',
  access_state = 'blocked',
  end_at = coalesce(end_at, now()),
  auto_renew = false,
  cancel_at_period_end = true,
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'trial_reset_to_first_login', true,
    'trial_reset_at', now()
  )
where
  plan_code = 'trial_migrated'
  and status in ('active', 'trialing', 'past_due')
  and (
    coalesce((metadata ->> 'migration_version') = '20260301', false)
    or lower(coalesce(metadata ->> 'migrated_from_free', 'false')) = 'true'
  );

-- Mark legacy non-paid users as eligible for one-time first-login trial.
with paid_users as (
  select distinct s.user_id
  from public.subscriptions s
  where s.amount > 0
    and s.status in ('active', 'past_due')
  union
  select distinct p.user_id
  from public.payments p
  where p.amount > 0
    and lower(coalesce(p.status, '')) in ('captured', 'paid', 'authorized', 'succeeded')
),
eligible_users as (
  select u.id as user_id
  from auth.users u
  left join paid_users pu on pu.user_id = u.id
  where pu.user_id is null
)
insert into public.user_billing_profiles (
  user_id,
  referral_code,
  trial_eligible,
  trial_started_at,
  trial_end_at,
  trial_consumed,
  trial_activated_at,
  updated_at
)
select
  eu.user_id,
  upper('FV' || substr(replace(eu.user_id::text, '-', ''), 1, 16)),
  true,
  null,
  null,
  false,
  null,
  now()
from eligible_users eu
on conflict (user_id) do update
set
  trial_eligible = true,
  trial_started_at = null,
  trial_end_at = null,
  trial_consumed = false,
  trial_activated_at = null,
  updated_at = now();

-- Users who already have paid history are not eligible for migration trial.
update public.user_billing_profiles ubp
set
  trial_eligible = false,
  updated_at = now()
where exists (
  select 1
  from public.payments p
  where p.user_id = ubp.user_id
    and p.amount > 0
    and lower(coalesce(p.status, '')) in ('captured', 'paid', 'authorized', 'succeeded')
);
