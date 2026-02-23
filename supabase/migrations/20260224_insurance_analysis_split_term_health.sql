-- Split insurance coverage inputs into dedicated term and health amounts.
-- Safe to run multiple times.

alter table public.insurance_analysis_config
  add column if not exists insurance_type text default 'Term',
  add column if not exists insurance_amount numeric default 0,
  add column if not exists term_insurance_amount numeric default 0,
  add column if not exists health_insurance_amount numeric default 0;

update public.insurance_analysis_config
set term_insurance_amount = coalesce(
  term_insurance_amount,
  case when insurance_type = 'Term' then insurance_amount end,
  existing_insurance,
  immediate_needs,
  0
)
where coalesce(term_insurance_amount, 0) = 0;

update public.insurance_analysis_config
set health_insurance_amount = coalesce(
  health_insurance_amount,
  case when insurance_type = 'Health' then insurance_amount end,
  0
)
where coalesce(health_insurance_amount, 0) = 0;
