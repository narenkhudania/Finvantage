-- Subscription, coupon, referral, and points foundation for paid rollout.
-- Decisions encoded from product spec:
-- - INR charging only (Razorpay single-currency for now)
-- - Plans: monthly 99, quarter 289, half-year 499, annual 899 (tax inclusive)
-- - Existing free users receive 30-day migrated trial immediately at migration run time
-- - Points expire after 12 months, monthly earning cap enforced at API layer

create extension if not exists pgcrypto;

create table if not exists public.billing_plans (
  plan_code text primary key,
  display_name text not null,
  billing_months integer not null check (billing_months in (1, 3, 6, 12)),
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  tax_inclusive boolean not null default true,
  auto_renew boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_plans (plan_code, display_name, billing_months, amount_inr, tax_inclusive, auto_renew, is_active, sort_order, metadata)
values
  ('starter_monthly_99', 'Starter Monthly', 1, 99, true, true, true, 10, '{"headline":"Best to start"}'::jsonb),
  ('starter_quarterly_289', 'Starter 3 Months', 3, 289, true, true, true, 20, '{"discount":"5%"}'::jsonb),
  ('starter_half_yearly_499', 'Starter 6 Months', 6, 499, true, true, true, 30, '{"discount":"10%"}'::jsonb),
  ('starter_annual_899', 'Starter 12 Months', 12, 899, true, true, true, 40, '{"discount":"20%"}'::jsonb)
on conflict (plan_code) do update
set
  display_name = excluded.display_name,
  billing_months = excluded.billing_months,
  amount_inr = excluded.amount_inr,
  tax_inclusive = excluded.tax_inclusive,
  auto_renew = excluded.auto_renew,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

create table if not exists public.user_billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country text not null default 'India',
  billing_currency text not null default 'INR',
  referral_code text not null unique,
  referred_by_code text,
  referred_by_user_id uuid references auth.users(id) on delete set null,
  trial_started_at timestamptz,
  trial_end_at timestamptz,
  trial_consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_billing_profiles_referred_by_idx
  on public.user_billing_profiles(referred_by_user_id);

create table if not exists public.subscription_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('flat', 'percentage')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  max_discount_amount numeric(12,2),
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  recurring_allowed boolean not null default true,
  stackable boolean not null default true,
  applies_to_plan_codes text[] not null default '{}'::text[],
  usage_limit_total integer,
  usage_limit_per_user integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.subscription_coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_discount numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_idx
  on public.subscription_coupon_redemptions(coupon_id, redeemed_at desc);

create index if not exists coupon_redemptions_user_idx
  on public.subscription_coupon_redemptions(user_id, redeemed_at desc);

create table if not exists public.reward_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  points integer not null,
  source_ref text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reward_points_ledger_user_idx
  on public.reward_points_ledger(user_id, created_at desc);

create index if not exists reward_points_ledger_expiry_idx
  on public.reward_points_ledger(expires_at);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'rewarded' check (status in ('rewarded', 'reversed', 'fraud_hold')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(referred_user_id)
);

create index if not exists referral_events_referrer_idx
  on public.referral_events(referrer_user_id, created_at desc);

create table if not exists public.billing_admin_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_admin_overrides_user_idx
  on public.billing_admin_overrides(user_id, ends_at desc);

create table if not exists public.billing_internal_reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.billing_internal_reminders (title, description, due_at, status, metadata)
select
  'Update Razorpay webhook/test domain',
  'Replace placeholder/test webhook domain with final production domain.',
  now() + interval '10 day',
  'open',
  '{"source":"subscription_rollout","suggested_domain":"https://finvantage.vercel.app"}'::jsonb
where not exists (
  select 1
  from public.billing_internal_reminders
  where title = 'Update Razorpay webhook/test domain'
);

alter table public.subscriptions
  add column if not exists provider text default 'razorpay',
  add column if not exists provider_subscription_id text,
  add column if not exists provider_customer_id text,
  add column if not exists auto_renew boolean default true,
  add column if not exists access_state text default 'active',
  add column if not exists failed_attempt_count integer default 0,
  add column if not exists past_due_since timestamptz;

create index if not exists subscriptions_provider_sub_idx on public.subscriptions(provider_subscription_id);

alter table public.payments
  add column if not exists provider_order_id text,
  add column if not exists coupon_code text,
  add column if not exists points_redeemed integer default 0;

create index if not exists payments_provider_order_idx on public.payments(provider_order_id);

-- -------------------------------------------------------------------
-- Trial migration for current free users (one-time idempotent insert/update)
-- -------------------------------------------------------------------
with base_users as (
  select id from auth.users
),
profile_seed as (
  insert into public.user_billing_profiles (user_id, referral_code, trial_started_at, trial_end_at, trial_consumed)
  select
    u.id,
    upper('FV' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    now(),
    now() + interval '30 day',
    false
  from base_users u
  on conflict (user_id) do update
  set
    trial_started_at = coalesce(public.user_billing_profiles.trial_started_at, excluded.trial_started_at),
    trial_end_at = coalesce(public.user_billing_profiles.trial_end_at, excluded.trial_end_at),
    updated_at = now()
  returning user_id
)
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
  access_state,
  metadata
)
select
  u.id,
  'trial_migrated',
  'trialing',
  'monthly',
  0,
  'INR',
  now(),
  now() + interval '30 day',
  false,
  true,
  'active',
  '{"migrated_from_free":true,"migration_version":"20260301"}'::jsonb
from base_users u
where not exists (
  select 1
  from public.subscriptions s
  where s.user_id = u.id
    and s.status in ('active', 'trialing', 'past_due')
);

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
alter table public.billing_plans enable row level security;
alter table public.user_billing_profiles enable row level security;
alter table public.subscription_coupons enable row level security;
alter table public.subscription_coupon_redemptions enable row level security;
alter table public.reward_points_ledger enable row level security;
alter table public.referral_events enable row level security;
alter table public.billing_admin_overrides enable row level security;
alter table public.billing_internal_reminders enable row level security;

drop policy if exists billing_plans_select on public.billing_plans;
create policy billing_plans_select on public.billing_plans
for select using (true);

drop policy if exists user_billing_profiles_select on public.user_billing_profiles;
create policy user_billing_profiles_select on public.user_billing_profiles
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists user_billing_profiles_update on public.user_billing_profiles;
create policy user_billing_profiles_update on public.user_billing_profiles
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists subscription_coupons_select on public.subscription_coupons;
create policy subscription_coupons_select on public.subscription_coupons
for select using (
  is_active = true
  or public.is_admin_user(auth.uid())
);

drop policy if exists subscription_coupons_manage on public.subscription_coupons;
create policy subscription_coupons_manage on public.subscription_coupons
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists coupon_redemptions_select on public.subscription_coupon_redemptions;
create policy coupon_redemptions_select on public.subscription_coupon_redemptions
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists coupon_redemptions_manage on public.subscription_coupon_redemptions;
create policy coupon_redemptions_manage on public.subscription_coupon_redemptions
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists reward_points_select on public.reward_points_ledger;
create policy reward_points_select on public.reward_points_ledger
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists reward_points_manage on public.reward_points_ledger;
create policy reward_points_manage on public.reward_points_ledger
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists referral_events_select on public.referral_events;
create policy referral_events_select on public.referral_events
for select using (
  referred_user_id = auth.uid()
  or referrer_user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists referral_events_manage on public.referral_events;
create policy referral_events_manage on public.referral_events
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists billing_overrides_select on public.billing_admin_overrides;
create policy billing_overrides_select on public.billing_admin_overrides
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists billing_overrides_manage on public.billing_admin_overrides;
create policy billing_overrides_manage on public.billing_admin_overrides
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists billing_reminders_select on public.billing_internal_reminders;
create policy billing_reminders_select on public.billing_internal_reminders
for select using (public.is_admin_user(auth.uid()));

drop policy if exists billing_reminders_manage on public.billing_internal_reminders;
create policy billing_reminders_manage on public.billing_internal_reminders
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));
