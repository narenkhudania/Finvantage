-- Family planning enhancements: future child placeholders + obligations.
-- Safe to run multiple times.

alter table public.family_members
  add column if not exists is_planned_future_child boolean default false,
  add column if not exists obligation_enabled boolean default false,
  add column if not exists obligation_type text,
  add column if not exists obligation_monthly_amount numeric,
  add column if not exists obligation_start_age integer,
  add column if not exists obligation_end_age integer,
  add column if not exists life_expectancy_age integer;
