create table if not exists public.billing_usage_point_rules (
  event_type text primary key,
  display_name text not null,
  points integer not null default 0 check (points >= 0 and points <= 10000),
  is_active boolean not null default true,
  description text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.billing_usage_point_rules
  add column if not exists event_type text,
  add column if not exists display_name text,
  add column if not exists points integer default 0,
  add column if not exists is_active boolean default true,
  add column if not exists description text,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.billing_usage_point_rules
  alter column event_type set not null,
  alter column display_name set not null,
  alter column points set not null,
  alter column is_active set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.billing_usage_point_rules
  drop constraint if exists billing_usage_point_rules_points_check;

alter table public.billing_usage_point_rules
  add constraint billing_usage_point_rules_points_check
  check (points >= 0 and points <= 10000);

alter table public.billing_usage_point_rules enable row level security;

drop policy if exists billing_usage_point_rules_select on public.billing_usage_point_rules;
create policy billing_usage_point_rules_select
  on public.billing_usage_point_rules
  for select
  using (auth.role() = 'authenticated');

drop trigger if exists set_billing_usage_point_rules_updated_at on public.billing_usage_point_rules;
create trigger set_billing_usage_point_rules_updated_at
before update on public.billing_usage_point_rules
for each row execute function public.set_updated_at();

insert into public.billing_usage_point_rules (event_type, display_name, points, is_active, description)
values
  ('daily_login', 'Daily Login', 10, true, 'Awarded once per day when user logs in.'),
  ('profile_completion', 'Profile Completion', 20, true, 'Awarded once when onboarding profile is fully completed.'),
  ('risk_profile_completed', 'Risk Profile Completed', 10, true, 'Awarded once when risk profile is submitted.'),
  ('goal_added', 'Goal Added', 20, true, 'Awarded when a new goal is added.'),
  ('report_generated', 'Report Generated', 10, true, 'Awarded when a report/summary is generated.'),
  ('subscription_payment_success', 'Subscription Payment Success', 30, true, 'Awarded on successful paid subscription payment.')
on conflict (event_type)
do update set
  display_name = excluded.display_name,
  points = excluded.points,
  is_active = excluded.is_active,
  description = excluded.description,
  updated_at = now();
