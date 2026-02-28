-- Align support tickets schema with complaint workflows and allow customers to
-- create their own complaint tickets while preserving admin access.

alter table if exists public.support_tickets
  add column if not exists ticket_number text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz;

create index if not exists support_tickets_user_category_idx
  on public.support_tickets(user_id, category);
create index if not exists support_tickets_ticket_number_idx
  on public.support_tickets(ticket_number);

alter table if exists public.support_tickets enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
for select
using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
for insert
with check (
  public.is_admin_user(auth.uid())
  or (
    user_id = auth.uid()
    and lower(coalesce(category, 'complaint')) = 'complaint'
    and lower(coalesce(status, 'open')) = 'open'
  )
);
