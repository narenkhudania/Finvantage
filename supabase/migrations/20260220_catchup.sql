-- One-time catch-up migration for recent schema additions.
-- Safe to run multiple times.

-- Family Members
alter table public.family_members
  add column if not exists retirement_age integer;

-- Expenses
alter table public.expenses
  add column if not exists start_year integer,
  add column if not exists end_year integer,
  add column if not exists frequency text,
  add column if not exists notes text;

-- Assets (contribution schedule)
alter table public.assets
  add column if not exists monthly_contribution numeric default 0,
  add column if not exists contribution_frequency text,
  add column if not exists contribution_step_up numeric default 0,
  add column if not exists contribution_start_year integer,
  add column if not exists contribution_end_year integer;

-- Loans
alter table public.loans
  add column if not exists start_year integer,
  add column if not exists lump_sum_repayments jsonb default '[]'::jsonb;

-- Goals (expanded fields)
alter table public.goals
  add column if not exists loan_details jsonb,
  add column if not exists start_goal_amount numeric,
  add column if not exists desired_retirement_age integer,
  add column if not exists expected_monthly_expenses_after_retirement numeric,
  add column if not exists retirement_handling text,
  add column if not exists detailed_breakdown jsonb;

-- Report Snapshots (Command Center)
create table if not exists public.report_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.report_snapshots enable row level security;

drop policy if exists report_snapshots_select on public.report_snapshots;
create policy report_snapshots_select on public.report_snapshots
for select using (user_id = auth.uid());

drop policy if exists report_snapshots_insert on public.report_snapshots;
create policy report_snapshots_insert on public.report_snapshots
for insert with check (user_id = auth.uid());

drop policy if exists report_snapshots_update on public.report_snapshots;
create policy report_snapshots_update on public.report_snapshots
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists report_snapshots_delete on public.report_snapshots;
create policy report_snapshots_delete on public.report_snapshots
for delete using (user_id = auth.uid());

-- Optional: PostgREST schema cache reload (may be ignored depending on config)
-- notify pgrst, 'reload schema';
