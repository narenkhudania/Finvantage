-- Billing communication templates/events and points-operations hardening.

alter table if exists public.user_billing_profiles
  add column if not exists points_frozen boolean not null default false;

create table if not exists public.billing_message_templates (
  template_key text primary key,
  title text not null,
  channel text not null check (channel in ('email', 'mobile', 'in_app')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_message_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null references public.billing_message_templates(template_key) on delete restrict,
  channel text not null check (channel in ('email', 'mobile', 'in_app')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'dropped')),
  payload jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists billing_message_events_user_idx
  on public.billing_message_events(user_id, created_at desc);

create index if not exists billing_message_events_status_idx
  on public.billing_message_events(status, created_at desc);

insert into public.billing_message_templates (template_key, title, channel, subject, body, is_active, metadata)
values
  ('billing_payment_initiated_email', 'Payment Initiated (Email)', 'email', 'Payment initiated for your Finvantage plan', 'We created your payment request for {{plan_code}}. Complete checkout to activate access.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_payment_success_email', 'Payment Success (Email)', 'email', 'Payment successful for your Finvantage subscription', 'Your payment for {{plan_code}} was successful. Access is active.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_payment_success_in_app', 'Payment Success (In-app)', 'in_app', null, 'Payment successful. Your dashboard access is active.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_subscription_activated_in_app', 'Subscription Activated (In-app)', 'in_app', null, 'Your subscription is active and dashboard access is restored.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_payment_failed_email', 'Payment Failed (Email)', 'email', 'Payment failed for your Finvantage subscription', 'Your payment attempt failed. Retry from Billing Manage to avoid dashboard lock.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_payment_failed_mobile', 'Payment Failed (Mobile)', 'mobile', null, 'Payment failed. Retry in Finvantage Billing to continue dashboard access.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_access_limited_in_app', 'Access Limited (In-app)', 'in_app', null, 'Dashboard is limited due to pending payment. Complete payment to restore full access.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_trial_migrated_in_app', 'Trial Activated (In-app)', 'in_app', null, 'Your one-time 30-day trial is active. Subscribe before trial end to keep dashboard access.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_trial_ending_soon_in_app', 'Trial Ending Soon (In-app)', 'in_app', null, 'Your trial ends soon. Subscribe now to avoid dashboard lock.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_subscription_cancelled_in_app', 'Subscription Cancelled (In-app)', 'in_app', null, 'Auto-renew is disabled. Access remains active until your current cycle ends.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_subscription_resumed_in_app', 'Subscription Resumed (In-app)', 'in_app', null, 'Auto-renew is enabled again for your active subscription.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_points_earned_in_app', 'Points Earned (In-app)', 'in_app', null, 'You earned reward points for your activity.', true, '{"source":"subscription_rollout"}'::jsonb),
  ('billing_referral_rewarded_in_app', 'Referral Rewarded (In-app)', 'in_app', null, 'Referral reward credited to your points balance.', true, '{"source":"subscription_rollout"}'::jsonb)
on conflict (template_key) do update
set
  title = excluded.title,
  channel = excluded.channel,
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();

alter table public.billing_message_templates enable row level security;
alter table public.billing_message_events enable row level security;

drop policy if exists billing_message_templates_select on public.billing_message_templates;
create policy billing_message_templates_select on public.billing_message_templates
for select using (is_active = true or public.is_admin_user(auth.uid()));

drop policy if exists billing_message_templates_manage on public.billing_message_templates;
create policy billing_message_templates_manage on public.billing_message_templates
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists billing_message_events_select on public.billing_message_events;
create policy billing_message_events_select on public.billing_message_events
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists billing_message_events_manage on public.billing_message_events;
create policy billing_message_events_manage on public.billing_message_events
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));
