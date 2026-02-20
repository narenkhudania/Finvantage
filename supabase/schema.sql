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
  created_at timestamptz default now(),
  unique (user_id, category)
);

create index if not exists expenses_user_id_idx on public.expenses(user_id);

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
  inflation_rate numeric default 6,
  current_amount numeric default 0,
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
