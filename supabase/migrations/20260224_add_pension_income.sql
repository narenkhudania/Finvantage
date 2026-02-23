-- Add pension income column to family and income profiles.
-- Safe to run multiple times.

alter table public.family_members
  add column if not exists pension numeric default 0;

alter table public.income_profiles
  add column if not exists pension numeric default 0;
