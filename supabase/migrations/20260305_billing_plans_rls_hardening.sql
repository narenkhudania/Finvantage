-- Harden billing_plans auth grants + RLS for admin plan writes.
-- Fixes 403 on authenticated admin upsert from Billing Plans Management.

begin;

alter table if exists public.billing_plans enable row level security;

grant select on table public.billing_plans to anon, authenticated;
grant insert, update, delete on table public.billing_plans to authenticated;

drop policy if exists billing_plans_select on public.billing_plans;
create policy billing_plans_select
on public.billing_plans
for select
using (true);

drop policy if exists billing_plans_manage on public.billing_plans;
create policy billing_plans_manage
on public.billing_plans
for all
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

commit;
