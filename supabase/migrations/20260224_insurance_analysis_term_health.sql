-- Insurance analysis: move to type + amount inputs for Term/Health workflows.
-- Safe to run multiple times.

alter table public.insurance_analysis_config
  add column if not exists insurance_type text default 'Term',
  add column if not exists insurance_amount numeric default 0;

update public.insurance_analysis_config
set insurance_type = 'Term'
where insurance_type is null or btrim(insurance_type) = '';

update public.insurance_analysis_config
set insurance_amount = coalesce(nullif(existing_insurance, 0), nullif(immediate_needs, 0), 0)
where coalesce(insurance_amount, 0) = 0;
