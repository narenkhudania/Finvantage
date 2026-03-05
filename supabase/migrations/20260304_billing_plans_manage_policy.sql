-- Allow admin-controlled writes to billing plans.
-- Fixes 403 on /rest/v1/billing_plans upsert from Admin Billing Plans Management.

alter table if exists public.billing_plans enable row level security;

drop policy if exists billing_plans_manage on public.billing_plans;
create policy billing_plans_manage
on public.billing_plans
for all
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

