-- Billing plan catalog integrity hardening.
-- Prevents pricing/config drift by ensuring one active plan per duration bucket.

begin;

-- Keep only one active plan per billing_months (latest updated row wins).
with ranked as (
  select
    plan_code,
    billing_months,
    row_number() over (
      partition by billing_months
      order by updated_at desc nulls last, created_at desc nulls last, plan_code
    ) as rn
  from public.billing_plans
  where is_active = true
)
update public.billing_plans p
set
  is_active = false,
  metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivated_reason', 'duplicate_active_duration',
    'deactivated_at', now()
  ),
  updated_at = now()
from ranked r
where p.plan_code = r.plan_code
  and r.rn > 1;

create unique index if not exists billing_plans_active_duration_uidx
  on public.billing_plans (billing_months)
  where is_active = true;

create or replace function public.billing_plans_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_billing_plans_set_updated_at on public.billing_plans;
create trigger trg_billing_plans_set_updated_at
before update on public.billing_plans
for each row execute function public.billing_plans_set_updated_at();

commit;
