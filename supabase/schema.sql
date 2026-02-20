-- FinVantage Supabase Schema (Core Tables + RLS + Functions)
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifier text not null unique,
  first_name text not null,
  last_name text,
  dob date,
  life_expectancy integer default 85,
  retirement_age integer default 60,
  pincode text,
  city text,
  state text,
  country text default 'India',
  income_source text default 'salaried',
  iq_score integer,
  onboarding_done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create a baseline profile row on auth sign-up (safety net).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, identifier, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Identifier check used by authService.ts
create or replace function public.identifier_exists(p_identifier text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where lower(identifier) = lower(p_identifier)
  );
$$;

grant execute on function public.identifier_exists(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Family Members
-- ─────────────────────────────────────────────────────────────

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation text not null,
  age integer not null default 0,
  is_dependent boolean default false,
  retirement_age integer,
  monthly_expenses numeric default 0,
  salary numeric default 0,
  bonus numeric default 0,
  reimbursements numeric default 0,
  business numeric default 0,
  rental numeric default 0,
  investment numeric default 0,
  expected_increase numeric default 6,
  created_at timestamptz default now()
);

create index if not exists family_members_user_id_idx on public.family_members(user_id);

-- ─────────────────────────────────────────────────────────────
-- Income Profiles
-- ─────────────────────────────────────────────────────────────

create table if not exists public.income_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_ref text not null,
  salary numeric default 0,
  bonus numeric default 0,
  reimbursements numeric default 0,
  business numeric default 0,
  rental numeric default 0,
  investment numeric default 0,
  expected_increase numeric default 6,
  created_at timestamptz default now(),
  unique (user_id, owner_ref)
);

create index if not exists income_profiles_user_id_idx on public.income_profiles(user_id);

-- ─────────────────────────────────────────────────────────────
-- Expenses
-- ─────────────────────────────────────────────────────────────

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric default 0,
  inflation_rate numeric default 6,
  tenure integer default 34,
  start_year integer,
  end_year integer,
  frequency text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, category)
);

create index if not exists expenses_user_id_idx on public.expenses(user_id);

-- ─────────────────────────────────────────────────────────────
-- Cashflows
-- ─────────────────────────────────────────────────────────────

create table if not exists public.cashflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_ref text not null,
  label text not null,
  amount numeric default 0,
  frequency text not null,
  growth_rate numeric default 0,
  start_year integer not null,
  end_year integer not null,
  notes text,
  flow_type text default 'Income',
  created_at timestamptz default now()
);

create index if not exists cashflows_user_id_idx on public.cashflows(user_id);

-- ─────────────────────────────────────────────────────────────
-- Investment Commitments
-- ─────────────────────────────────────────────────────────────

create table if not exists public.investment_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_ref text not null,
  label text not null,
  amount numeric default 0,
  frequency text not null,
  step_up numeric default 0,
  start_year integer not null,
  end_year integer not null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists investment_commitments_user_id_idx on public.investment_commitments(user_id);

-- ─────────────────────────────────────────────────────────────
-- Assets
-- ─────────────────────────────────────────────────────────────

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  sub_category text not null,
  name text not null,
  owner_ref text not null,
  current_value numeric default 0,
  purchase_year integer default extract(year from now())::int,
  growth_rate numeric default 10,
  available_for_goals boolean default false,
  available_from integer,
  tenure integer,
  monthly_contribution numeric default 0,
  contribution_frequency text,
  contribution_step_up numeric default 0,
  contribution_start_year integer,
  contribution_end_year integer,
  created_at timestamptz default now()
);

create index if not exists assets_user_id_idx on public.assets(user_id);

-- ─────────────────────────────────────────────────────────────
-- Loans
-- ─────────────────────────────────────────────────────────────

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  owner_ref text not null,
  source text not null,
  source_type text not null,
  sanctioned_amount numeric default 0,
  outstanding_amount numeric default 0,
  interest_rate numeric default 8.5,
  remaining_tenure integer default 120,
  emi numeric default 0,
  notes text,
  start_year integer,
  lump_sum_repayments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists loans_user_id_idx on public.loans(user_id);

-- ─────────────────────────────────────────────────────────────
-- Goals
-- ─────────────────────────────────────────────────────────────

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  description text not null,
  priority integer default 1,
  resource_buckets text[] default '{}',
  is_recurring boolean default false,
  frequency text,
  start_date_type text not null,
  start_date_value integer not null,
  end_date_type text not null,
  end_date_value integer not null,
  target_amount_today numeric default 0,
  start_goal_amount numeric,
  inflation_rate numeric default 6,
  current_amount numeric default 0,
  loan_details jsonb,
  desired_retirement_age integer,
  expected_monthly_expenses_after_retirement numeric,
  retirement_handling text,
  detailed_breakdown jsonb,
  created_at timestamptz default now()
);

create index if not exists goals_user_id_idx on public.goals(user_id);

-- ─────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.income_profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.cashflows enable row level security;
alter table public.investment_commitments enable row level security;
alter table public.assets enable row level security;
alter table public.loans enable row level security;
alter table public.goals enable row level security;

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
for delete using (id = auth.uid());

-- Family Members
drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
for select using (user_id = auth.uid());

drop policy if exists family_members_insert on public.family_members;
create policy family_members_insert on public.family_members
for insert with check (user_id = auth.uid());

drop policy if exists family_members_update on public.family_members;
create policy family_members_update on public.family_members
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists family_members_delete on public.family_members;
create policy family_members_delete on public.family_members
for delete using (user_id = auth.uid());

-- Income Profiles
drop policy if exists income_profiles_select on public.income_profiles;
create policy income_profiles_select on public.income_profiles
for select using (user_id = auth.uid());

drop policy if exists income_profiles_insert on public.income_profiles;
create policy income_profiles_insert on public.income_profiles
for insert with check (user_id = auth.uid());

drop policy if exists income_profiles_update on public.income_profiles;
create policy income_profiles_update on public.income_profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists income_profiles_delete on public.income_profiles;
create policy income_profiles_delete on public.income_profiles
for delete using (user_id = auth.uid());

-- Expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
for select using (user_id = auth.uid());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
for insert with check (user_id = auth.uid());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
for delete using (user_id = auth.uid());

-- Cashflows
drop policy if exists cashflows_select on public.cashflows;
create policy cashflows_select on public.cashflows
for select using (user_id = auth.uid());

drop policy if exists cashflows_insert on public.cashflows;
create policy cashflows_insert on public.cashflows
for insert with check (user_id = auth.uid());

drop policy if exists cashflows_update on public.cashflows;
create policy cashflows_update on public.cashflows
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cashflows_delete on public.cashflows;
create policy cashflows_delete on public.cashflows
for delete using (user_id = auth.uid());

-- Investment Commitments
drop policy if exists investment_commitments_select on public.investment_commitments;
create policy investment_commitments_select on public.investment_commitments
for select using (user_id = auth.uid());

drop policy if exists investment_commitments_insert on public.investment_commitments;
create policy investment_commitments_insert on public.investment_commitments
for insert with check (user_id = auth.uid());

drop policy if exists investment_commitments_update on public.investment_commitments;
create policy investment_commitments_update on public.investment_commitments
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists investment_commitments_delete on public.investment_commitments;
create policy investment_commitments_delete on public.investment_commitments
for delete using (user_id = auth.uid());

-- Assets
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
for select using (user_id = auth.uid());

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
for insert with check (user_id = auth.uid());

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
for delete using (user_id = auth.uid());

-- Loans
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans
for select using (user_id = auth.uid());

drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans
for insert with check (user_id = auth.uid());

drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists loans_delete on public.loans;
create policy loans_delete on public.loans
for delete using (user_id = auth.uid());

-- Goals
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals
for select using (user_id = auth.uid());

drop policy if exists goals_insert on public.goals;
create policy goals_insert on public.goals
for insert with check (user_id = auth.uid());

drop policy if exists goals_update on public.goals;
create policy goals_update on public.goals
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists goals_delete on public.goals;
create policy goals_delete on public.goals
for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Insurance Policies
-- ─────────────────────────────────────────────────────────────

create table if not exists public.insurances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  type text not null,
  proposer text not null,
  insured text not null,
  sum_assured numeric default 0,
  premium numeric default 0,
  begin_year integer,
  ppt_end_year integer,
  maturity_type text,
  annual_premiums_left integer,
  premium_end_year integer,
  maturity_date date,
  is_money_back boolean default false,
  money_back_years integer[] default '{}',
  money_back_amounts numeric[] default '{}',
  income_from integer,
  income_to integer,
  income_growth numeric,
  income_type text,
  income_year_1 numeric,
  income_year_2 numeric,
  income_year_3 numeric,
  income_year_4 numeric,
  sum_insured numeric,
  deductible numeric,
  things_covered text,
  created_at timestamptz default now()
);

create index if not exists insurances_user_id_idx on public.insurances(user_id);

-- ─────────────────────────────────────────────────────────────
-- Transactions
-- ─────────────────────────────────────────────────────────────

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  description text not null,
  amount numeric not null,
  category text not null,
  type text not null,
  created_at timestamptz default now()
);

create index if not exists transactions_user_id_idx on public.transactions(user_id);

-- ─────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read boolean default false,
  timestamp timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);

-- ─────────────────────────────────────────────────────────────
-- Risk Profiles
-- ─────────────────────────────────────────────────────────────

create table if not exists public.risk_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null,
  level text not null,
  last_updated timestamptz not null,
  equity integer not null,
  debt integer not null,
  gold integer not null,
  liquid integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Insurance Analysis Config
-- ─────────────────────────────────────────────────────────────

create table if not exists public.insurance_analysis_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inflation numeric not null default 6,
  investment_rate numeric not null default 11.5,
  replacement_years integer not null default 20,
  immediate_needs numeric not null default 1000000,
  financial_asset_discount numeric not null default 50,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Report Snapshots
-- ─────────────────────────────────────────────────────────────

create table if not exists public.report_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Estate Flags
-- ─────────────────────────────────────────────────────────────

create table if not exists public.estate_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  has_will boolean default false,
  nominations_updated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- RLS Policies (new tables)
-- ─────────────────────────────────────────────────────────────

alter table public.insurances enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.estate_flags enable row level security;
alter table public.insurance_analysis_config enable row level security;
alter table public.report_snapshots enable row level security;

-- Insurances
drop policy if exists insurances_select on public.insurances;
create policy insurances_select on public.insurances
for select using (user_id = auth.uid());

drop policy if exists insurances_insert on public.insurances;
create policy insurances_insert on public.insurances
for insert with check (user_id = auth.uid());

drop policy if exists insurances_update on public.insurances;
create policy insurances_update on public.insurances
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists insurances_delete on public.insurances;
create policy insurances_delete on public.insurances
for delete using (user_id = auth.uid());

-- Transactions
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
for select using (user_id = auth.uid());

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
for insert with check (user_id = auth.uid());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
for delete using (user_id = auth.uid());

-- Notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select using (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
for insert with check (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
for delete using (user_id = auth.uid());

-- Risk Profiles
drop policy if exists risk_profiles_select on public.risk_profiles;
create policy risk_profiles_select on public.risk_profiles
for select using (user_id = auth.uid());

drop policy if exists risk_profiles_insert on public.risk_profiles;
create policy risk_profiles_insert on public.risk_profiles
for insert with check (user_id = auth.uid());

drop policy if exists risk_profiles_update on public.risk_profiles;
create policy risk_profiles_update on public.risk_profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists risk_profiles_delete on public.risk_profiles;
create policy risk_profiles_delete on public.risk_profiles
for delete using (user_id = auth.uid());

-- Estate Flags
drop policy if exists estate_flags_select on public.estate_flags;
create policy estate_flags_select on public.estate_flags
for select using (user_id = auth.uid());

drop policy if exists estate_flags_insert on public.estate_flags;
create policy estate_flags_insert on public.estate_flags
for insert with check (user_id = auth.uid());

drop policy if exists estate_flags_update on public.estate_flags;
create policy estate_flags_update on public.estate_flags
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists estate_flags_delete on public.estate_flags;
create policy estate_flags_delete on public.estate_flags
for delete using (user_id = auth.uid());

-- Insurance Analysis Config
drop policy if exists insurance_analysis_select on public.insurance_analysis_config;
create policy insurance_analysis_select on public.insurance_analysis_config
for select using (user_id = auth.uid());

drop policy if exists insurance_analysis_insert on public.insurance_analysis_config;
create policy insurance_analysis_insert on public.insurance_analysis_config
for insert with check (user_id = auth.uid());

drop policy if exists insurance_analysis_update on public.insurance_analysis_config;
create policy insurance_analysis_update on public.insurance_analysis_config
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists insurance_analysis_delete on public.insurance_analysis_config;
create policy insurance_analysis_delete on public.insurance_analysis_config
for delete using (user_id = auth.uid());

-- Report Snapshots
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
