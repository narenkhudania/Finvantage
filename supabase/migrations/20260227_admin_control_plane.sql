-- Admin Control Plane for FinVantage
-- Scope: RBAC, audit trails, customer ops, payments monitoring, KYC/fraud queues,
-- analytics helpers, webhook replay, feature flags, customer communications.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------
-- Compatibility preflight
-- If legacy admin RBAC tables exist with non-UUID ids, drop and recreate.
-- -------------------------------------------------------------------

do $$
declare
  v_admin_roles_id_type text;
  v_admin_permissions_id_type text;
  v_admin_users_role_id_type text;
  v_feature_flags_has_legacy_key boolean := false;
begin
  select data_type
  into v_admin_roles_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'admin_roles'
    and column_name = 'id'
  limit 1;

  select data_type
  into v_admin_permissions_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'admin_permissions'
    and column_name = 'id'
  limit 1;

  select data_type
  into v_admin_users_role_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'admin_users'
    and column_name = 'role_id'
  limit 1;

  if v_admin_roles_id_type is not null and v_admin_roles_id_type <> 'uuid' then
    raise notice 'Dropping legacy admin_roles/admin_users/admin_role_permissions (non-UUID id types)';
    drop table if exists public.admin_role_permissions cascade;
    drop table if exists public.admin_users cascade;
    drop table if exists public.admin_roles cascade;
  end if;

  if v_admin_permissions_id_type is not null and v_admin_permissions_id_type <> 'uuid' then
    raise notice 'Dropping legacy admin_permissions/admin_role_permissions (non-UUID id types)';
    drop table if exists public.admin_role_permissions cascade;
    drop table if exists public.admin_permissions cascade;
  end if;

  if v_admin_users_role_id_type is not null and v_admin_users_role_id_type <> 'uuid' then
    raise notice 'Dropping legacy admin_users/admin_role_permissions (non-UUID role_id type)';
    drop table if exists public.admin_role_permissions cascade;
    drop table if exists public.admin_users cascade;
  end if;

  -- Drop clearly non-essential legacy admin telemetry/session tables.
  drop table if exists public.admin_sessions cascade;
  drop table if exists public.analytics_daily_snapshots cascade;
  drop table if exists public.audit_logs cascade;

  -- Legacy feature_flags often uses PK column `key` instead of `id/flag_key`.
  -- It conflicts with the admin control-plane contract and upsert RPC.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'feature_flags'
      and column_name = 'key'
  ) into v_feature_flags_has_legacy_key;

  if v_feature_flags_has_legacy_key then
    raise notice 'Dropping legacy feature_flags table with key-based schema';
    drop table if exists public.feature_flags cascade;
  end if;
end $$;

-- -------------------------------------------------------------------
-- Core RBAC
-- -------------------------------------------------------------------

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  display_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id uuid not null references public.admin_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id),
  is_active boolean not null default true,
  two_factor_enabled boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_role_idx on public.admin_users(role_id);
create index if not exists admin_users_is_active_idx on public.admin_users(is_active);

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- Customer Admin State / Ops
-- -------------------------------------------------------------------

create table if not exists public.user_admin_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_blocked boolean not null default false,
  blocked_reason text,
  blocked_by uuid references auth.users(id),
  blocked_at timestamptz,
  force_logout_requested_at timestamptz,
  risk_level text,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists user_admin_flags_block_idx on public.user_admin_flags(is_blocked);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  status text not null default 'trialing',
  billing_cycle text not null default 'monthly',
  amount numeric not null default 0,
  currency text not null default 'INR',
  start_at timestamptz not null default now(),
  end_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure legacy subscriptions table shape has required columns.
alter table if exists public.subscriptions
  add column if not exists user_id uuid,
  add column if not exists plan_code text,
  add column if not exists status text default 'trialing',
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists amount numeric default 0,
  add column if not exists currency text default 'INR',
  add column if not exists start_at timestamptz default now(),
  add column if not exists end_at timestamptz,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status);
create index if not exists subscriptions_plan_idx on public.subscriptions(plan_code);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'internal',
  provider_payment_id text,
  status text not null default 'pending',
  amount numeric not null,
  currency text not null default 'INR',
  fee_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  attempted_at timestamptz not null default now(),
  settled_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Ensure legacy payments table shape has required columns.
alter table if exists public.payments
  add column if not exists subscription_id uuid,
  add column if not exists user_id uuid,
  add column if not exists provider text default 'internal',
  add column if not exists provider_payment_id text,
  add column if not exists status text default 'pending',
  add column if not exists amount numeric default 0,
  add column if not exists currency text default 'INR',
  add column if not exists fee_amount numeric default 0,
  add column if not exists tax_amount numeric default 0,
  add column if not exists attempted_at timestamptz default now(),
  add column if not exists settled_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists payments_user_status_idx on public.payments(user_id, status);
create index if not exists payments_attempted_idx on public.payments(attempted_at desc);
create index if not exists payments_subscription_idx on public.payments(subscription_id);

create table if not exists public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'not_started',
  risk_score integer not null default 0,
  risk_band text,
  review_notes text,
  documents jsonb not null default '[]'::jsonb,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Ensure legacy kyc_records table shape has required columns.
alter table if exists public.kyc_records
  add column if not exists user_id uuid,
  add column if not exists status text default 'not_started',
  add column if not exists risk_score integer default 0,
  add column if not exists risk_band text,
  add column if not exists review_notes text,
  add column if not exists documents jsonb default '[]'::jsonb,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists kyc_records_status_idx on public.kyc_records(status);
create index if not exists kyc_records_risk_score_idx on public.kyc_records(risk_score desc);

drop trigger if exists set_kyc_records_updated_at on public.kyc_records;
create trigger set_kyc_records_updated_at
before update on public.kyc_records
for each row execute function public.set_updated_at();

create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  severity text not null default 'medium',
  rule_key text not null,
  status text not null default 'open',
  amount numeric,
  details jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure legacy fraud_flags table shape has required columns.
alter table if exists public.fraud_flags
  add column if not exists user_id uuid,
  add column if not exists severity text default 'medium',
  add column if not exists rule_key text,
  add column if not exists status text default 'open',
  add column if not exists amount numeric,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists assigned_to uuid,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists fraud_flags_status_severity_idx on public.fraud_flags(status, severity);
create index if not exists fraud_flags_user_idx on public.fraud_flags(user_id);

drop trigger if exists set_fraud_flags_updated_at on public.fraud_flags;
create trigger set_fraud_flags_updated_at
before update on public.fraud_flags
for each row execute function public.set_updated_at();

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  assigned_to uuid references auth.users(id),
  channel text not null default 'in_app',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.support_tickets
  add column if not exists user_id uuid,
  add column if not exists subject text,
  add column if not exists status text default 'open',
  add column if not exists priority text default 'medium',
  add column if not exists assigned_to uuid,
  add column if not exists channel text default 'in_app',
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists support_tickets_status_priority_idx on public.support_tickets(status, priority);

drop trigger if exists set_support_tickets_updated_at on public.support_tickets;
create trigger set_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_updated_at();

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  channel text not null default 'in_app',
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table if exists public.admin_notifications
  add column if not exists user_id uuid,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists channel text default 'in_app',
  add column if not exists status text default 'queued',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

create index if not exists admin_notifications_user_idx on public.admin_notifications(user_id, created_at desc);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  description text,
  is_enabled boolean not null default false,
  rollout_percent integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.feature_flags
  add column if not exists flag_key text,
  add column if not exists description text,
  add column if not exists is_enabled boolean default false,
  add column if not exists rollout_percent integer default 100,
  add column if not exists config jsonb default '{}'::jsonb,
  add column if not exists updated_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists feature_flags_enabled_idx on public.feature_flags(is_enabled);

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text,
  event_type text not null,
  status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  replay_count integer not null default 0,
  error_message text,
  last_replayed_at timestamptz
);

alter table if exists public.webhook_events
  add column if not exists provider text,
  add column if not exists event_id text,
  add column if not exists event_type text,
  add column if not exists status text default 'received',
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists received_at timestamptz default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists replay_count integer default 0,
  add column if not exists error_message text,
  add column if not exists last_replayed_at timestamptz;

create unique index if not exists webhook_events_provider_event_idx on public.webhook_events(provider, event_id) where event_id is not null;
create index if not exists webhook_events_status_idx on public.webhook_events(status, received_at desc);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  event_time timestamptz not null default now()
);

alter table if exists public.activity_events
  add column if not exists user_id uuid,
  add column if not exists event_name text,
  add column if not exists source text default 'app',
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists event_time timestamptz default now();

create index if not exists activity_events_time_idx on public.activity_events(event_time desc);
create index if not exists activity_events_user_idx on public.activity_events(user_id, event_time desc);
create index if not exists activity_events_name_idx on public.activity_events(event_name, event_time desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table if exists public.admin_audit_logs
  add column if not exists admin_user_id uuid,
  add column if not exists action text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists reason text,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists ip inet,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now();

create index if not exists admin_audit_logs_admin_time_idx on public.admin_audit_logs(admin_user_id, created_at desc);
create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs(action, created_at desc);

-- -------------------------------------------------------------------
-- Seed roles & permissions
-- -------------------------------------------------------------------

insert into public.admin_roles (role_key, display_name, description)
values
  ('super_admin', 'Super Admin', 'Full platform access across operations, compliance and configuration'),
  ('compliance_officer', 'Compliance Officer', 'KYC, AML, audit and policy workflows'),
  ('operations', 'Operations', 'Customer operations and support workflows'),
  ('support', 'Support', 'Customer helpdesk and communication only'),
  ('finance', 'Finance', 'Billing, subscriptions and payments analytics'),
  ('read_only_audit', 'Read-only Audit', 'Read-only access for internal and external audit')
on conflict (role_key) do nothing;

insert into public.admin_permissions (permission_key, description)
values
  ('customers.read', 'Read customer records and timeline'),
  ('customers.manage', 'Block, unblock, force logout, profile interventions'),
  ('subscriptions.read', 'Read subscriptions and billing data'),
  ('subscriptions.manage', 'Manage subscription state and refunds'),
  ('payments.read', 'Read payments and settlement data'),
  ('payments.manage', 'Manage payment interventions and replay'),
  ('kyc.read', 'Read KYC records'),
  ('kyc.review', 'Approve/reject KYC records'),
  ('fraud.read', 'Read fraud alerts and queues'),
  ('fraud.review', 'Assign and resolve fraud alerts'),
  ('analytics.read', 'Read platform analytics and KPIs'),
  ('ops.manage', 'Use operational controls, flags and tools'),
  ('audit.read', 'Read immutable admin audit logs'),
  ('audit.write', 'Write admin audit logs'),
  ('admin.manage', 'Manage admin users, roles and permissions')
on conflict (permission_key) do nothing;

-- Super admin gets every permission by default.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
cross join public.admin_permissions p
where r.role_key = 'super_admin'
on conflict do nothing;

-- -------------------------------------------------------------------
-- RBAC helper functions
-- -------------------------------------------------------------------

create or replace function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = p_user_id
      and au.is_active = true
  );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;

create or replace function public.admin_has_permission(
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    join public.admin_roles r on r.id = au.role_id
    left join public.admin_role_permissions rp on rp.role_id = r.id
    left join public.admin_permissions p on p.id = rp.permission_id
    where au.user_id = p_user_id
      and au.is_active = true
      and (
        r.role_key = 'super_admin'
        or p.permission_key = p_permission_key
      )
  );
$$;

grant execute on function public.admin_has_permission(text, uuid) to authenticated;

create or replace function public.admin_require_permission(p_permission_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission(p_permission_key, auth.uid()) then
    raise exception 'admin permission denied for %', p_permission_key
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.admin_require_permission(text) to authenticated;

create or replace function public.admin_require_permission_for_user(
  p_permission_key text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission(p_permission_key, p_user_id) then
    raise exception 'admin permission denied for %', p_permission_key
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.admin_require_permission_for_user(text, uuid) to authenticated;

create or replace function public.admin_insert_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb,
  p_ip inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.admin_require_permission('audit.write');

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    reason,
    payload,
    ip,
    user_agent
  )
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_reason,
    coalesce(p_payload, '{}'::jsonb),
    p_ip,
    p_user_agent
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.admin_insert_audit_log(text, text, text, text, jsonb, inet, text) to authenticated;

create or replace function public.admin_current_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with current_admin as (
    select
      au.user_id,
      au.is_active,
      r.role_key,
      r.display_name
    from public.admin_users au
    join public.admin_roles r on r.id = au.role_id
    where au.user_id = auth.uid()
      and au.is_active = true
    limit 1
  )
  select jsonb_build_object(
    'isAdmin', exists(select 1 from current_admin),
    'userId', auth.uid(),
    'roleKey', (select role_key from current_admin),
    'roleName', (select display_name from current_admin),
    'permissions', coalesce(
      (
        select case
          when ca.role_key = 'super_admin' then (
            select jsonb_agg(permission_key order by permission_key)
            from public.admin_permissions
          )
          else (
            select jsonb_agg(distinct p.permission_key order by p.permission_key)
            from public.admin_role_permissions rp
            join public.admin_permissions p on p.id = rp.permission_id
            where rp.role_id = (
              select au.role_id from public.admin_users au where au.user_id = auth.uid() and au.is_active = true limit 1
            )
          )
        end
        from current_admin ca
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.admin_current_access() to authenticated;

-- -------------------------------------------------------------------
-- Admin RPCs (secure service endpoints over PostgREST)
-- -------------------------------------------------------------------

create or replace function public.admin_dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('analytics.read')
  ),
  user_stats as (
    select
      count(*)::bigint as total_users,
      count(*) filter (where onboarding_done = true)::bigint as onboarded_users,
      count(*) filter (where created_at >= now() - interval '30 day')::bigint as new_users_30d
    from public.profiles
  ),
  activity_stats as (
    select
      count(distinct user_id) filter (where event_time >= now() - interval '1 day')::bigint as dau,
      count(distinct user_id) filter (where event_time >= now() - interval '30 day')::bigint as mau
    from public.activity_events
    where event_time >= now() - interval '30 day'
  ),
  assets_stats as (
    select coalesce(sum(current_value), 0)::numeric as total_aum
    from public.assets
  ),
  payment_stats as (
    select
      coalesce(sum(amount) filter (where status in ('captured','settled','authorized','success') and coalesce(attempted_at, created_at) >= date_trunc('month', now())), 0)::numeric as mtd_revenue,
      count(*) filter (where status in ('failed','declined') and coalesce(attempted_at, created_at) >= now() - interval '30 day')::bigint as failed_payments_30d
    from public.payments
  ),
  risk_stats as (
    select
      count(*) filter (where kind = 'fraud' and status in ('open','investigating','escalated'))::bigint as open_fraud_flags,
      count(*) filter (where kind = 'kyc' and status in ('pending','in_review','under_review'))::bigint as pending_kyc
    from (
      select status, 'fraud'::text as kind from public.fraud_flags
      union all
      select status, 'kyc'::text as kind from public.kyc_records
    ) x
  ),
  blocked as (
    select count(*)::bigint as blocked_users
    from public.user_admin_flags
    where is_blocked = true
  )
  select jsonb_build_object(
    'totalUsers', (select total_users from user_stats),
    'onboardedUsers', (select onboarded_users from user_stats),
    'newUsers30d', (select new_users_30d from user_stats),
    'dau', coalesce((select dau from activity_stats), 0),
    'mau', coalesce((select mau from activity_stats), 0),
    'totalAum', (select total_aum from assets_stats),
    'mtdRevenue', (select mtd_revenue from payment_stats),
    'failedPayments30d', (select failed_payments_30d from payment_stats),
    'pendingKyc', coalesce((select pending_kyc from risk_stats), 0),
    'openFraudFlags', coalesce((select open_fraud_flags from risk_stats), 0),
    'blockedUsers', (select blocked_users from blocked)
  );
$$;

grant execute on function public.admin_dashboard_summary() to authenticated;

create or replace function public.admin_list_customers(
  p_search text default null,
  p_kyc_status text default null,
  p_plan_code text default null,
  p_risk_level text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  mobile text,
  country text,
  onboarding_done boolean,
  risk_level text,
  kyc_status text,
  plan_code text,
  subscription_status text,
  blocked boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('customers.read')
  ),
  latest_sub as (
    select distinct on (s.user_id)
      s.user_id,
      s.plan_code,
      s.status,
      s.updated_at
    from public.subscriptions s
    order by s.user_id, s.updated_at desc nulls last, s.created_at desc
  )
  select
    p.id as user_id,
    p.identifier as email,
    p.first_name,
    p.last_name,
    null::text as mobile,
    p.country,
    p.onboarding_done,
    rp.level as risk_level,
    coalesce(kyc.status, 'not_started') as kyc_status,
    ls.plan_code,
    ls.status as subscription_status,
    coalesce(uaf.is_blocked, false) as blocked,
    p.created_at,
    p.updated_at
  from public.profiles p
  left join public.risk_profiles rp on rp.user_id = p.id
  left join public.kyc_records kyc on kyc.user_id = p.id
  left join latest_sub ls on ls.user_id = p.id
  left join public.user_admin_flags uaf on uaf.user_id = p.id
  where
    (
      p_search is null
      or p_search = ''
      or p.identifier ilike '%' || p_search || '%'
      or p.first_name ilike '%' || p_search || '%'
      or p.last_name ilike '%' || p_search || '%'
      or p.id::text = p_search
    )
    and (p_kyc_status is null or p_kyc_status = '' or coalesce(kyc.status, 'not_started') = p_kyc_status)
    and (p_plan_code is null or p_plan_code = '' or ls.plan_code = p_plan_code)
    and (p_risk_level is null or p_risk_level = '' or rp.level = p_risk_level)
  order by p.updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_list_customers(text, text, text, text, integer, integer) to authenticated;

create or replace function public.admin_customer_timeline(
  p_user_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('customers.read')
  ),
  profile_row as (
    select p.id, p.identifier, p.first_name, p.last_name, p.country, p.created_at, p.updated_at, p.onboarding_done
    from public.profiles p
    where p.id = p_user_id
  ),
  tx as (
    select jsonb_build_object(
      'time', t.created_at,
      'type', 'transaction',
      'title', t.category,
      'detail', t.description,
      'amount', t.amount,
      'meta', jsonb_build_object('txnType', t.type)
    ) as item
    from public.transactions t
    where t.user_id = p_user_id
    order by t.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  ),
  goals as (
    select jsonb_build_object(
      'time', g.created_at,
      'type', 'goal',
      'title', g.type,
      'detail', g.description,
      'amount', g.target_amount_today,
      'meta', jsonb_build_object('priority', g.priority)
    ) as item
    from public.goals g
    where g.user_id = p_user_id
    order by g.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  ),
  events as (
    select jsonb_build_object(
      'time', e.event_time,
      'type', 'activity',
      'title', e.event_name,
      'detail', coalesce(e.metadata->>'detail', ''),
      'meta', e.metadata
    ) as item
    from public.activity_events e
    where e.user_id = p_user_id
    order by e.event_time desc
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  ),
  raw as (
    select item from tx
    union all
    select item from goals
    union all
    select item from events
  )
  select jsonb_build_object(
    'profile', (select to_jsonb(profile_row) from profile_row),
    'timeline', coalesce(
      (
        select jsonb_agg(item order by (item->>'time')::timestamptz desc)
        from raw
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.admin_customer_timeline(uuid, integer) to authenticated;

create or replace function public.admin_set_user_block(
  p_user_id uuid,
  p_is_blocked boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  perform public.admin_require_permission('customers.manage');

  insert into public.user_admin_flags (
    user_id,
    is_blocked,
    blocked_reason,
    blocked_by,
    blocked_at,
    updated_at
  )
  values (
    p_user_id,
    p_is_blocked,
    case when p_is_blocked then p_reason else null end,
    case when p_is_blocked then auth.uid() else null end,
    case when p_is_blocked then v_now else null end,
    v_now
  )
  on conflict (user_id) do update set
    is_blocked = excluded.is_blocked,
    blocked_reason = excluded.blocked_reason,
    blocked_by = excluded.blocked_by,
    blocked_at = excluded.blocked_at,
    updated_at = excluded.updated_at;

  perform public.admin_insert_audit_log(
    case when p_is_blocked then 'customer.block' else 'customer.unblock' end,
    'user',
    p_user_id::text,
    p_reason,
    jsonb_build_object('blocked', p_is_blocked)
  );

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'blocked', p_is_blocked);
end;
$$;

grant execute on function public.admin_set_user_block(uuid, boolean, text) to authenticated;

create or replace function public.admin_force_logout_user(
  p_user_id uuid,
  p_reason text default 'admin_forced_logout'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  perform public.admin_require_permission('customers.manage');

  insert into public.user_admin_flags (user_id, force_logout_requested_at, updated_at)
  values (p_user_id, v_now, v_now)
  on conflict (user_id) do update set
    force_logout_requested_at = excluded.force_logout_requested_at,
    updated_at = excluded.updated_at;

  perform public.admin_insert_audit_log(
    'customer.force_logout',
    'user',
    p_user_id::text,
    p_reason,
    jsonb_build_object('forceLogoutAt', v_now)
  );

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'forceLogoutAt', v_now);
end;
$$;

grant execute on function public.admin_force_logout_user(uuid, text) to authenticated;

create or replace function public.admin_review_kyc(
  p_user_id uuid,
  p_status text,
  p_risk_score integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_risk_score integer := coalesce(p_risk_score, 0);
begin
  perform public.admin_require_permission('kyc.review');

  insert into public.kyc_records (
    user_id,
    status,
    risk_score,
    risk_band,
    review_notes,
    reviewed_by,
    reviewed_at,
    updated_at
  )
  values (
    p_user_id,
    p_status,
    v_risk_score,
    case
      when v_risk_score >= 80 then 'high'
      when v_risk_score >= 50 then 'medium'
      else 'low'
    end,
    p_notes,
    auth.uid(),
    v_now,
    v_now
  )
  on conflict (user_id) do update set
    status = excluded.status,
    risk_score = excluded.risk_score,
    risk_band = excluded.risk_band,
    review_notes = excluded.review_notes,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = excluded.updated_at;

  perform public.admin_insert_audit_log(
    'kyc.review',
    'kyc_record',
    p_user_id::text,
    p_notes,
    jsonb_build_object('status', p_status, 'riskScore', v_risk_score)
  );

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'status', p_status, 'riskScore', v_risk_score);
end;
$$;

grant execute on function public.admin_review_kyc(uuid, text, integer, text) to authenticated;

create or replace function public.admin_get_kyc_queue(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  user_id uuid,
  email text,
  status text,
  risk_score integer,
  risk_band text,
  review_notes text,
  reviewed_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('kyc.read')
  )
  select
    k.user_id,
    p.identifier as email,
    k.status,
    k.risk_score,
    k.risk_band,
    k.review_notes,
    k.reviewed_at,
    k.updated_at
  from public.kyc_records k
  left join public.profiles p on p.id = k.user_id
  where p_status is null or p_status = '' or k.status = p_status
  order by k.updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.admin_get_kyc_queue(text, integer) to authenticated;

create or replace function public.admin_get_fraud_queue(
  p_status text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  severity text,
  rule_key text,
  status text,
  amount numeric,
  details jsonb,
  assigned_to uuid,
  reviewed_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('fraud.read')
  )
  select
    f.id,
    f.user_id,
    p.identifier as email,
    f.severity,
    f.rule_key,
    f.status,
    f.amount,
    f.details,
    f.assigned_to,
    f.reviewed_at,
    f.created_at
  from public.fraud_flags f
  left join public.profiles p on p.id = f.user_id
  where p_status is null or p_status = '' or f.status = p_status
  order by
    case when f.severity = 'critical' then 1 when f.severity = 'high' then 2 when f.severity = 'medium' then 3 else 4 end,
    f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.admin_get_fraud_queue(text, integer) to authenticated;

create or replace function public.admin_resolve_fraud_flag(
  p_flag_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_permission('fraud.review');

  update public.fraud_flags
  set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    resolved_at = case when p_status in ('resolved', 'false_positive') then now() else null end,
    updated_at = now(),
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object('reviewNotes', p_notes)
  where id = p_flag_id;

  perform public.admin_insert_audit_log(
    'fraud.resolve',
    'fraud_flag',
    p_flag_id::text,
    p_notes,
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('ok', true, 'flagId', p_flag_id, 'status', p_status);
end;
$$;

grant execute on function public.admin_resolve_fraud_flag(uuid, text, text) to authenticated;

create or replace function public.admin_send_customer_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_channel text default 'in_app'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  perform public.admin_require_permission('ops.manage');

  insert into public.admin_notifications (
    user_id,
    title,
    message,
    channel,
    status,
    created_by
  )
  values (
    p_user_id,
    p_title,
    p_message,
    p_channel,
    'queued',
    auth.uid()
  )
  returning id into v_notification_id;

  -- In-app fallback channel (real provider wiring can consume admin_notifications later)
  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    read,
    timestamp
  )
  values (
    p_user_id,
    p_title,
    p_message,
    'strategy',
    false,
    now()
  );

  perform public.admin_insert_audit_log(
    'customer.notify',
    'user',
    p_user_id::text,
    null,
    jsonb_build_object('title', p_title, 'channel', p_channel)
  );

  return jsonb_build_object('ok', true, 'notificationId', v_notification_id);
end;
$$;

grant execute on function public.admin_send_customer_notification(uuid, text, text, text) to authenticated;

create or replace function public.admin_upsert_feature_flag(
  p_flag_key text,
  p_is_enabled boolean,
  p_description text default null,
  p_rollout_percent integer default 100,
  p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_permission('ops.manage');

  insert into public.feature_flags (
    flag_key,
    description,
    is_enabled,
    rollout_percent,
    config,
    updated_by
  )
  values (
    p_flag_key,
    p_description,
    p_is_enabled,
    greatest(0, least(coalesce(p_rollout_percent, 100), 100)),
    coalesce(p_config, '{}'::jsonb),
    auth.uid()
  )
  on conflict (flag_key) do update set
    description = coalesce(excluded.description, public.feature_flags.description),
    is_enabled = excluded.is_enabled,
    rollout_percent = excluded.rollout_percent,
    config = excluded.config,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform public.admin_insert_audit_log(
    'ops.feature_flag.upsert',
    'feature_flag',
    p_flag_key,
    null,
    jsonb_build_object('enabled', p_is_enabled, 'rollout', p_rollout_percent)
  );

  return jsonb_build_object('ok', true, 'flagKey', p_flag_key);
end;
$$;

grant execute on function public.admin_upsert_feature_flag(text, boolean, text, integer, jsonb) to authenticated;

create or replace function public.admin_replay_webhook_event(
  p_event_id uuid,
  p_reason text default 'manual_replay'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_permission('ops.manage');

  update public.webhook_events
  set
    status = 'replay_queued',
    replay_count = replay_count + 1,
    last_replayed_at = now(),
    error_message = null
  where id = p_event_id;

  perform public.admin_insert_audit_log(
    'ops.webhook.replay',
    'webhook_event',
    p_event_id::text,
    p_reason,
    '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'eventId', p_event_id, 'status', 'replay_queued');
end;
$$;

grant execute on function public.admin_replay_webhook_event(uuid, text) to authenticated;

create or replace function public.admin_analytics_snapshot(
  p_days integer default 90,
  p_actor_user_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission_for_user('analytics.read', p_actor_user_id)
  ),
  d as (
    select greatest(7, least(coalesce(p_days, 90), 365))::int as days
  ),
  series as (
    select generate_series(
      date_trunc('day', now()) - ((select days from d) - 1) * interval '1 day',
      date_trunc('day', now()),
      interval '1 day'
    )::date as day
  ),
  users as (
    select date_trunc('day', created_at)::date as day, count(*)::int as count
    from public.profiles
    where created_at >= (select min(day) from series)
    group by 1
  ),
  txns as (
    select date_trunc('day', created_at)::date as day,
           count(*)::int as txn_count,
           coalesce(sum(amount),0)::numeric as txn_amount
    from public.transactions
    where created_at >= (select min(day) from series)
    group by 1
  ),
  rev as (
    select date_trunc('day', attempted_at)::date as day,
           coalesce(sum(amount) filter (where status in ('captured','settled')), 0)::numeric as revenue
    from public.payments
    where attempted_at >= (select min(day) from series)
    group by 1
  ),
  dau as (
    select date_trunc('day', event_time)::date as day,
           count(distinct user_id)::int as dau
    from public.activity_events
    where event_time >= (select min(day) from series)
    group by 1
  ),
  base as (
    select
      s.day,
      coalesce(u.count, 0) as new_users,
      coalesce(t.txn_count, 0) as txn_count,
      coalesce(t.txn_amount, 0)::numeric as txn_amount,
      coalesce(r.revenue, 0)::numeric as revenue,
      coalesce(a.dau, 0) as dau
    from series s
    left join users u on u.day = s.day
    left join txns t on t.day = s.day
    left join rev r on r.day = s.day
    left join dau a on a.day = s.day
    order by s.day
  )
  select jsonb_build_object(
    'days', (select days from d),
    'series', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', day,
            'newUsers', new_users,
            'txnCount', txn_count,
            'txnAmount', txn_amount,
            'revenue', revenue,
            'dau', dau
          )
          order by day
        )
        from base
      ),
      '[]'::jsonb
    ),
    'totals', jsonb_build_object(
      'newUsers', (select coalesce(sum(new_users), 0) from base),
      'txnCount', (select coalesce(sum(txn_count), 0) from base),
      'txnAmount', (select coalesce(sum(txn_amount), 0) from base),
      'revenue', (select coalesce(sum(revenue), 0) from base),
      'avgDau', (select coalesce(avg(dau), 0) from base)
    )
  );
$$;

grant execute on function public.admin_analytics_snapshot(integer, uuid) to authenticated;

create or replace function public.admin_portfolio_feed(
  p_limit integer default 100,
  p_offset integer default 0,
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  name text,
  total_assets numeric,
  total_liabilities numeric,
  net_worth numeric,
  goals_count integer,
  transactions_count integer,
  last_transaction_at timestamptz,
  risk_level text,
  kyc_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.admin_require_permission('customers.read')
  ),
  base_users as (
    select
      p.id as user_id,
      p.identifier as email,
      trim(concat_ws(' ', p.first_name, p.last_name)) as name,
      rp.level as risk_level,
      coalesce(kyc.status, 'not_started') as kyc_status
    from public.profiles p
    left join public.risk_profiles rp on rp.user_id = p.id
    left join public.kyc_records kyc on kyc.user_id = p.id
    where
      p_search is null
      or p_search = ''
      or p.identifier ilike '%' || p_search || '%'
      or p.first_name ilike '%' || p_search || '%'
      or p.last_name ilike '%' || p_search || '%'
      or p.id::text = p_search
    order by p.updated_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  assets_agg as (
    select a.user_id, coalesce(sum(a.current_value), 0)::numeric as total_assets
    from public.assets a
    where a.user_id in (select user_id from base_users)
    group by a.user_id
  ),
  loans_agg as (
    select l.user_id, coalesce(sum(l.outstanding_amount), 0)::numeric as total_liabilities
    from public.loans l
    where l.user_id in (select user_id from base_users)
    group by l.user_id
  ),
  goals_agg as (
    select g.user_id, count(*)::integer as goals_count
    from public.goals g
    where g.user_id in (select user_id from base_users)
    group by g.user_id
  ),
  tx_agg as (
    select
      t.user_id,
      count(*)::integer as transactions_count,
      max(coalesce(t.created_at, t.date::timestamptz)) as last_transaction_at
    from public.transactions t
    where t.user_id in (select user_id from base_users)
    group by t.user_id
  )
  select
    bu.user_id,
    bu.email,
    coalesce(nullif(bu.name, ''), bu.email) as name,
    coalesce(a.total_assets, 0)::numeric as total_assets,
    coalesce(l.total_liabilities, 0)::numeric as total_liabilities,
    (coalesce(a.total_assets, 0) - coalesce(l.total_liabilities, 0))::numeric as net_worth,
    coalesce(g.goals_count, 0)::integer as goals_count,
    coalesce(tx.transactions_count, 0)::integer as transactions_count,
    tx.last_transaction_at,
    bu.risk_level,
    bu.kyc_status
  from base_users bu
  left join assets_agg a on a.user_id = bu.user_id
  left join loans_agg l on l.user_id = bu.user_id
  left join goals_agg g on g.user_id = bu.user_id
  left join tx_agg tx on tx.user_id = bu.user_id
  order by net_worth desc, bu.user_id;
$$;

grant execute on function public.admin_portfolio_feed(integer, integer, text) to authenticated;

-- -------------------------------------------------------------------
-- RLS policies for admin tables
-- -------------------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_users enable row level security;
alter table public.user_admin_flags enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.kyc_records enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.feature_flags enable row level security;
alter table public.webhook_events enable row level security;
alter table public.activity_events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Admin tables: admin users only.
drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select on public.admin_roles
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_permissions_select on public.admin_permissions;
create policy admin_permissions_select on public.admin_permissions
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_role_permissions_select on public.admin_role_permissions;
create policy admin_role_permissions_select on public.admin_role_permissions
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_users_select on public.admin_users;
create policy admin_users_select on public.admin_users
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_users_update on public.admin_users;
create policy admin_users_update on public.admin_users
for update using (public.admin_has_permission('admin.manage', auth.uid()))
with check (public.admin_has_permission('admin.manage', auth.uid()));

-- user_admin_flags: owner can read own flags for forced logout; admins can manage all.
drop policy if exists user_admin_flags_select on public.user_admin_flags;
create policy user_admin_flags_select on public.user_admin_flags
for select using (
  user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists user_admin_flags_insert on public.user_admin_flags;
create policy user_admin_flags_insert on public.user_admin_flags
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists user_admin_flags_update on public.user_admin_flags;
create policy user_admin_flags_update on public.user_admin_flags
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

-- Read-only exposure to user-specific rows in ops tables for end users, admin all access.
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists kyc_records_select on public.kyc_records;
create policy kyc_records_select on public.kyc_records
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists kyc_records_insert on public.kyc_records;
create policy kyc_records_insert on public.kyc_records
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists kyc_records_update on public.kyc_records;
create policy kyc_records_update on public.kyc_records
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists fraud_flags_select on public.fraud_flags;
create policy fraud_flags_select on public.fraud_flags
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists fraud_flags_insert on public.fraud_flags;
create policy fraud_flags_insert on public.fraud_flags
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists fraud_flags_update on public.fraud_flags;
create policy fraud_flags_update on public.fraud_flags
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
for select using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists admin_notifications_select on public.admin_notifications;
create policy admin_notifications_select on public.admin_notifications
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_notifications_insert on public.admin_notifications;
create policy admin_notifications_insert on public.admin_notifications
for insert with check (public.is_admin_user(auth.uid()));

-- Feature flags / webhook / activity / audit are admin-only.
drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
for select using (public.is_admin_user(auth.uid()));

drop policy if exists feature_flags_insert on public.feature_flags;
create policy feature_flags_insert on public.feature_flags
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists feature_flags_update on public.feature_flags;
create policy feature_flags_update on public.feature_flags
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists webhook_events_select on public.webhook_events;
create policy webhook_events_select on public.webhook_events
for select using (public.is_admin_user(auth.uid()));

drop policy if exists webhook_events_insert on public.webhook_events;
create policy webhook_events_insert on public.webhook_events
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists webhook_events_update on public.webhook_events;
create policy webhook_events_update on public.webhook_events
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
for select using (public.is_admin_user(auth.uid()));

drop policy if exists activity_events_insert on public.activity_events;
create policy activity_events_insert on public.activity_events
for insert with check (
  user_id = auth.uid() or public.is_admin_user(auth.uid())
);

drop policy if exists admin_audit_logs_select on public.admin_audit_logs;
create policy admin_audit_logs_select on public.admin_audit_logs
for select using (public.is_admin_user(auth.uid()));

drop policy if exists admin_audit_logs_insert on public.admin_audit_logs;
create policy admin_audit_logs_insert on public.admin_audit_logs
for insert with check (public.is_admin_user(auth.uid()));

-- -------------------------------------------------------------------
-- Recommended bootstrap (manual run after deployment)
-- Replace <ADMIN_USER_UUID> with your actual auth.users.id
-- insert into public.admin_users (user_id, role_id)
-- select '<ADMIN_USER_UUID>'::uuid, id from public.admin_roles where role_key = 'super_admin';
-- -------------------------------------------------------------------
