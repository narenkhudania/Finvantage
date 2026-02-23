-- Add opt-in flag for including family member income in planning calculations.
-- Safe to run multiple times.

alter table public.family_members
  add column if not exists include_income_in_planning boolean default true;

update public.family_members
set include_income_in_planning = true
where include_income_in_planning is null;
