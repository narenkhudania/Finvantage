-- Store risk questionnaire answers for dashboard drill-down and audit trail.
-- Safe to run multiple times.

alter table public.risk_profiles
  add column if not exists questionnaire_version integer default 1,
  add column if not exists questionnaire_answers jsonb default '[]'::jsonb;

update public.risk_profiles
set questionnaire_version = 1
where questionnaire_version is null;

update public.risk_profiles
set questionnaire_answers = '[]'::jsonb
where questionnaire_answers is null;
