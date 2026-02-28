-- FinVantage Foundation (Tenant + Security)
-- Scope: organizations/workspaces, workspace RBAC, tenant-scoped audit,
-- session monitoring, TOTP 2FA + recovery codes, seed bootstrap.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------
-- Tenant core
-- -------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.organizations
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists status text default 'active',
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists organizations_slug_idx on public.organizations(slug);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

alter table if exists public.workspaces
  add column if not exists organization_id uuid,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists status text default 'active',
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists workspaces_org_idx on public.workspaces(organization_id);
create unique index if not exists workspaces_org_slug_idx on public.workspaces(organization_id, slug);

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table if not exists public.workspace_roles (
  role_key text primary key,
  display_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_permissions (
  permission_key text primary key,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_role_permissions (
  role_key text not null references public.workspace_roles(role_key) on delete cascade,
  permission_key text not null references public.workspace_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.workspace_roles(role_key),
  is_active boolean not null default true,
  two_factor_required boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table if exists public.workspace_memberships
  add column if not exists organization_id uuid,
  add column if not exists workspace_id uuid,
  add column if not exists user_id uuid,
  add column if not exists role_key text,
  add column if not exists is_active boolean default true,
  add column if not exists two_factor_required boolean default false,
  add column if not exists invited_by uuid,
  add column if not exists joined_at timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists workspace_memberships_workspace_user_idx on public.workspace_memberships(workspace_id, user_id);
create index if not exists workspace_memberships_user_idx on public.workspace_memberships(user_id, is_active);
create index if not exists workspace_memberships_org_idx on public.workspace_memberships(organization_id, workspace_id);

drop trigger if exists set_workspace_memberships_updated_at on public.workspace_memberships;
create trigger set_workspace_memberships_updated_at
before update on public.workspace_memberships
for each row execute function public.set_updated_at();

create or replace function public.sync_membership_org_from_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select w.organization_id
  into v_org_id
  from public.workspaces w
  where w.id = new.workspace_id;

  if v_org_id is null then
    raise exception 'Workspace % not found.', new.workspace_id using errcode = '23503';
  end if;

  new.organization_id := v_org_id;
  return new;
end;
$$;

drop trigger if exists sync_workspace_membership_org on public.workspace_memberships;
create trigger sync_workspace_membership_org
before insert or update on public.workspace_memberships
for each row execute function public.sync_membership_org_from_workspace();

-- -------------------------------------------------------------------
-- Tenant columns on existing core tables used by admin / analytics
-- -------------------------------------------------------------------

alter table if exists public.profiles
  add column if not exists organization_id uuid,
  add column if not exists workspace_id uuid;

create index if not exists profiles_workspace_idx on public.profiles(workspace_id);
create index if not exists profiles_org_idx on public.profiles(organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_organization_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_workspace_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end $$;

alter table if exists public.activity_events
  add column if not exists organization_id uuid,
  add column if not exists workspace_id uuid;

create index if not exists activity_events_workspace_time_idx on public.activity_events(workspace_id, event_time desc);
create index if not exists activity_events_org_time_idx on public.activity_events(organization_id, event_time desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_events_organization_id_fkey'
      and conrelid = 'public.activity_events'::regclass
  ) then
    alter table public.activity_events
      add constraint activity_events_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_events_workspace_id_fkey'
      and conrelid = 'public.activity_events'::regclass
  ) then
    alter table public.activity_events
      add constraint activity_events_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end $$;

alter table if exists public.admin_audit_logs
  add column if not exists organization_id uuid,
  add column if not exists workspace_id uuid,
  add column if not exists scope text default 'global';

create index if not exists admin_audit_logs_workspace_time_idx on public.admin_audit_logs(workspace_id, created_at desc);
create index if not exists admin_audit_logs_org_time_idx on public.admin_audit_logs(organization_id, created_at desc);

update public.admin_audit_logs
set scope = coalesce(nullif(scope, ''), 'global')
where scope is null or scope = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_audit_logs_scope_check'
      and conrelid = 'public.admin_audit_logs'::regclass
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_scope_check
      check (scope in ('global', 'workspace'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_audit_logs_organization_id_fkey'
      and conrelid = 'public.admin_audit_logs'::regclass
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_audit_logs_workspace_id_fkey'
      and conrelid = 'public.admin_audit_logs'::regclass
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end $$;

-- -------------------------------------------------------------------
-- Session monitoring + 2FA state
-- -------------------------------------------------------------------

create table if not exists public.admin_security_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null,
  device_name text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  two_factor_verified_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, session_token_hash)
);

create index if not exists admin_security_sessions_workspace_user_idx on public.admin_security_sessions(workspace_id, user_id, last_seen_at desc);
create index if not exists admin_security_sessions_workspace_revoked_idx on public.admin_security_sessions(workspace_id, revoked_at, last_seen_at desc);

drop trigger if exists set_admin_security_sessions_updated_at on public.admin_security_sessions;
create trigger set_admin_security_sessions_updated_at
before update on public.admin_security_sessions
for each row execute function public.set_updated_at();

create table if not exists public.admin_user_2fa (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'enabled', 'disabled')),
  totp_secret_base32 text,
  recovery_code_hashes text[] not null default '{}'::text[],
  enabled_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists admin_user_2fa_workspace_user_idx on public.admin_user_2fa(workspace_id, user_id);

drop trigger if exists set_admin_user_2fa_updated_at on public.admin_user_2fa;
create trigger set_admin_user_2fa_updated_at
before update on public.admin_user_2fa
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- Seed roles + permissions
-- -------------------------------------------------------------------

insert into public.workspace_roles (role_key, display_name, description)
values
  ('admin', 'Admin', 'Full workspace administration access'),
  ('manager', 'Manager', 'Operational management across customers, sales, and campaigns'),
  ('analyst', 'Analyst', 'Read-focused analytics and reporting access'),
  ('support', 'Support', 'Customer support and issue-response access')
on conflict (role_key) do update set
  display_name = excluded.display_name,
  description = excluded.description;

insert into public.workspace_permissions (permission_key, description)
values
  ('workspace.read', 'Read workspace settings and metadata'),
  ('users.read', 'Read workspace users and membership details'),
  ('users.manage', 'Add/update/remove workspace users and roles'),
  ('roles.read', 'Read role and permission matrix'),
  ('roles.manage', 'Update role permissions'),
  ('security.read', 'Read sessions and 2FA status'),
  ('security.manage', 'Revoke sessions and manage security controls'),
  ('audit.read', 'Read tenant audit logs'),
  ('audit.write', 'Write tenant audit logs'),
  ('analytics.read', 'Read product and behavioral analytics'),
  ('analytics.manage', 'Configure analytics alerts and thresholds'),
  ('events.ingest', 'Ingest product events'),
  ('customers.read', 'Read customer records and timeline'),
  ('customers.manage', 'Block/unblock and intervene on customer accounts'),
  ('subscriptions.read', 'Read subscriptions and billing data'),
  ('subscriptions.manage', 'Manage subscription state and refunds'),
  ('payments.read', 'Read payments and settlement data'),
  ('payments.manage', 'Manage payment interventions and replay'),
  ('kyc.read', 'Read KYC records'),
  ('kyc.review', 'Approve/reject KYC records'),
  ('fraud.read', 'Read fraud alerts and queues'),
  ('fraud.review', 'Assign and resolve fraud alerts'),
  ('ops.manage', 'Use operational controls and tooling'),
  ('crm.read', 'Read CRM objects and timeline'),
  ('crm.manage', 'Manage contacts, accounts, leads, deals and tasks'),
  ('sales.read', 'Read sales pipeline and activities'),
  ('sales.manage', 'Manage sales tasks, meetings and pipeline'),
  ('marketing.read', 'Read campaign and email reports'),
  ('marketing.manage', 'Manage campaign workflows and drip automation'),
  ('reports.read', 'Read dashboards and scheduled reports'),
  ('reports.manage', 'Create/manage dashboards and report schedules'),
  ('admin.manage', 'Manage privileged workspace configuration')
on conflict (permission_key) do update set
  description = excluded.description;

-- Admin gets all permissions.
insert into public.workspace_role_permissions (role_key, permission_key)
select 'admin', p.permission_key
from public.workspace_permissions p
on conflict do nothing;

-- Manager permissions.
insert into public.workspace_role_permissions (role_key, permission_key)
values
  ('manager', 'workspace.read'),
  ('manager', 'users.read'),
  ('manager', 'users.manage'),
  ('manager', 'roles.read'),
  ('manager', 'security.read'),
  ('manager', 'security.manage'),
  ('manager', 'audit.read'),
  ('manager', 'audit.write'),
  ('manager', 'analytics.read'),
  ('manager', 'analytics.manage'),
  ('manager', 'events.ingest'),
  ('manager', 'customers.read'),
  ('manager', 'customers.manage'),
  ('manager', 'subscriptions.read'),
  ('manager', 'subscriptions.manage'),
  ('manager', 'payments.read'),
  ('manager', 'payments.manage'),
  ('manager', 'kyc.read'),
  ('manager', 'kyc.review'),
  ('manager', 'fraud.read'),
  ('manager', 'fraud.review'),
  ('manager', 'ops.manage'),
  ('manager', 'crm.read'),
  ('manager', 'crm.manage'),
  ('manager', 'sales.read'),
  ('manager', 'sales.manage'),
  ('manager', 'marketing.read'),
  ('manager', 'marketing.manage'),
  ('manager', 'reports.read'),
  ('manager', 'reports.manage')
on conflict do nothing;

-- Analyst permissions.
insert into public.workspace_role_permissions (role_key, permission_key)
values
  ('analyst', 'workspace.read'),
  ('analyst', 'users.read'),
  ('analyst', 'roles.read'),
  ('analyst', 'security.read'),
  ('analyst', 'audit.read'),
  ('analyst', 'analytics.read'),
  ('analyst', 'customers.read'),
  ('analyst', 'payments.read'),
  ('analyst', 'subscriptions.read'),
  ('analyst', 'kyc.read'),
  ('analyst', 'fraud.read'),
  ('analyst', 'crm.read'),
  ('analyst', 'sales.read'),
  ('analyst', 'marketing.read'),
  ('analyst', 'reports.read')
on conflict do nothing;

-- Support permissions.
insert into public.workspace_role_permissions (role_key, permission_key)
values
  ('support', 'workspace.read'),
  ('support', 'users.read'),
  ('support', 'security.read'),
  ('support', 'audit.read'),
  ('support', 'customers.read'),
  ('support', 'customers.manage'),
  ('support', 'payments.read'),
  ('support', 'subscriptions.read'),
  ('support', 'ops.manage'),
  ('support', 'crm.read'),
  ('support', 'sales.read'),
  ('support', 'marketing.read'),
  ('support', 'reports.read')
on conflict do nothing;

-- -------------------------------------------------------------------
-- Tenant RBAC helper functions
-- -------------------------------------------------------------------

create or replace function public.is_workspace_member(
  p_workspace_id uuid,
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
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
      and wm.is_active = true
  );
$$;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;

create or replace function public.workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role_key
  from public.workspace_memberships wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id
    and wm.is_active = true
  limit 1;
$$;

grant execute on function public.workspace_member_role(uuid, uuid) to authenticated;

create or replace function public.workspace_has_permission(
  p_workspace_id uuid,
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with membership as (
    select wm.role_key
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
      and wm.is_active = true
    limit 1
  )
  select exists (
    select 1
    from membership m
    where m.role_key = 'admin'
       or exists (
         select 1
         from public.workspace_role_permissions wrp
         where wrp.role_key = m.role_key
           and wrp.permission_key = p_permission_key
       )
  );
$$;

grant execute on function public.workspace_has_permission(uuid, text, uuid) to authenticated;

create or replace function public.workspace_require_membership(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id, p_user_id) then
    raise exception 'workspace membership denied for %', p_workspace_id using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.workspace_require_membership(uuid, uuid) to authenticated;

create or replace function public.workspace_require_permission(
  p_workspace_id uuid,
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.workspace_has_permission(p_workspace_id, p_permission_key, p_user_id) then
    raise exception 'workspace permission denied for %', p_permission_key using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.workspace_require_permission(uuid, text, uuid) to authenticated;

create or replace function public.workspace_scope_ids(p_workspace_id uuid)
returns table (
  organization_id uuid,
  workspace_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select w.organization_id, w.id
  from public.workspaces w
  where w.id = p_workspace_id
  limit 1;
$$;

-- Internal helper for writing workspace-scoped audit logs from privileged functions.
create or replace function public.workspace_insert_audit_log(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_reason text default null,
  p_payload jsonb default '{}'::jsonb,
  p_ip inet default null,
  p_user_agent text default null,
  p_actor_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_org_id uuid;
begin
  select w.organization_id into v_org_id
  from public.workspaces w
  where w.id = p_workspace_id;

  if v_org_id is null then
    raise exception 'Unknown workspace %', p_workspace_id using errcode = '23503';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    organization_id,
    workspace_id,
    scope,
    action,
    entity_type,
    entity_id,
    reason,
    payload,
    ip,
    user_agent
  )
  values (
    p_actor_user_id,
    v_org_id,
    p_workspace_id,
    'workspace',
    p_action,
    p_entity_type,
    p_entity_id,
    p_reason,
    coalesce(p_payload, '{}'::jsonb),
    p_ip,
    p_user_agent
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.workspace_admin_insert_audit_log(
  p_workspace_id uuid,
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
begin
  perform public.workspace_require_permission(p_workspace_id, 'audit.write', auth.uid());
  return public.workspace_insert_audit_log(
    p_workspace_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_reason,
    p_payload,
    p_ip,
    p_user_agent,
    auth.uid()
  );
end;
$$;

grant execute on function public.workspace_admin_insert_audit_log(uuid, text, text, text, text, jsonb, inet, text) to authenticated;

-- -------------------------------------------------------------------
-- Access + user management RPCs (tenant-scoped)
-- -------------------------------------------------------------------

create or replace function public.admin_current_access_v2(
  p_workspace_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with memberships as (
    select
      wm.organization_id,
      wm.workspace_id,
      wm.user_id,
      wm.role_key,
      wm.is_active,
      wm.two_factor_required,
      wm.joined_at,
      wr.display_name as role_name,
      o.name as organization_name,
      o.slug as organization_slug,
      ws.name as workspace_name,
      ws.slug as workspace_slug
    from public.workspace_memberships wm
    join public.organizations o on o.id = wm.organization_id
    join public.workspaces ws on ws.id = wm.workspace_id
    left join public.workspace_roles wr on wr.role_key = wm.role_key
    where wm.user_id = auth.uid()
      and wm.is_active = true
  ),
  selected_workspace as (
    select m.*
    from memberships m
    where p_workspace_id is null or m.workspace_id = p_workspace_id
    order by case when p_workspace_id is not null and m.workspace_id = p_workspace_id then 0 else 1 end,
             m.joined_at asc
    limit 1
  ),
  selected_permissions as (
    select distinct wrp.permission_key
    from selected_workspace sw
    join public.workspace_role_permissions wrp on wrp.role_key = sw.role_key
  ),
  workspaces_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'organizationId', m.organization_id,
          'organizationName', m.organization_name,
          'organizationSlug', m.organization_slug,
          'workspaceId', m.workspace_id,
          'workspaceName', m.workspace_name,
          'workspaceSlug', m.workspace_slug,
          'roleKey', m.role_key,
          'roleName', coalesce(m.role_name, initcap(m.role_key)),
          'twoFactorRequired', m.two_factor_required
        )
        order by m.organization_name, m.workspace_name
      ),
      '[]'::jsonb
    ) as value
    from memberships m
  ),
  two_factor as (
    select t.status,
           t.last_verified_at,
           cardinality(t.recovery_code_hashes) as recovery_codes_remaining
    from selected_workspace sw
    left join public.admin_user_2fa t
      on t.workspace_id = sw.workspace_id
     and t.user_id = sw.user_id
    limit 1
  )
  select jsonb_build_object(
    'isAdmin', exists(select 1 from selected_workspace),
    'userId', auth.uid(),
    'organizationId', (select organization_id from selected_workspace),
    'organizationName', (select organization_name from selected_workspace),
    'workspaceId', (select workspace_id from selected_workspace),
    'workspaceName', (select workspace_name from selected_workspace),
    'roleKey', (select role_key from selected_workspace),
    'roleName', (select coalesce(role_name, initcap(role_key)) from selected_workspace),
    'permissions', coalesce((select jsonb_agg(permission_key order by permission_key) from selected_permissions), '[]'::jsonb),
    'workspaces', (select value from workspaces_json),
    'twoFactorRequired', coalesce((select two_factor_required from selected_workspace), false),
    'twoFactorEnabled', coalesce((select status = 'enabled' from two_factor), false),
    'twoFactorStatus', coalesce((select status from two_factor), 'disabled'),
    'twoFactorLastVerifiedAt', (select last_verified_at from two_factor),
    'recoveryCodesRemaining', coalesce((select recovery_codes_remaining from two_factor), 0)
  );
$$;

grant execute on function public.admin_current_access_v2(uuid) to authenticated;

create or replace function public.admin_list_workspace_roles(
  p_workspace_id uuid
)
returns table (
  role_key text,
  display_name text,
  description text,
  permission_keys text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.workspace_require_permission(p_workspace_id, 'roles.read', auth.uid())
  )
  select
    wr.role_key,
    wr.display_name,
    wr.description,
    coalesce(
      array_agg(wrp.permission_key order by wrp.permission_key) filter (where wrp.permission_key is not null),
      '{}'::text[]
    ) as permission_keys
  from public.workspace_roles wr
  left join public.workspace_role_permissions wrp on wrp.role_key = wr.role_key
  group by wr.role_key, wr.display_name, wr.description
  order by wr.display_name;
$$;

grant execute on function public.admin_list_workspace_roles(uuid) to authenticated;

create or replace function public.admin_list_workspace_permissions(
  p_workspace_id uuid
)
returns table (
  permission_key text,
  description text
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.workspace_require_permission(p_workspace_id, 'roles.read', auth.uid())
  )
  select p.permission_key, p.description
  from public.workspace_permissions p
  order by p.permission_key;
$$;

grant execute on function public.admin_list_workspace_permissions(uuid) to authenticated;

create or replace function public.admin_list_workspace_users(
  p_workspace_id uuid,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role_key text,
  is_active boolean,
  two_factor_required boolean,
  two_factor_enabled boolean,
  last_login_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.workspace_require_permission(p_workspace_id, 'users.read', auth.uid())
  ),
  session_rollup as (
    select s.user_id, max(s.last_seen_at) as last_login_at
    from public.admin_security_sessions s
    where s.workspace_id = p_workspace_id
      and s.revoked_at is null
    group by s.user_id
  )
  select
    wm.user_id,
    p.identifier as email,
    trim(concat_ws(' ', p.first_name, p.last_name)) as full_name,
    wm.role_key,
    wm.is_active,
    wm.two_factor_required,
    coalesce(t.status = 'enabled', false) as two_factor_enabled,
    sr.last_login_at,
    wm.created_at
  from public.workspace_memberships wm
  left join public.profiles p on p.id = wm.user_id
  left join public.admin_user_2fa t
    on t.workspace_id = wm.workspace_id
   and t.user_id = wm.user_id
  left join session_rollup sr on sr.user_id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by wm.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_list_workspace_users(uuid, integer, integer) to authenticated;

create or replace function public.admin_upsert_workspace_user(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role_key text,
  p_is_active boolean default true,
  p_two_factor_required boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_prev_role text;
  v_prev_active boolean;
begin
  perform public.workspace_require_permission(p_workspace_id, 'users.manage', auth.uid());

  if not exists (select 1 from public.workspace_roles where role_key = p_role_key) then
    raise exception 'Unknown role_key %', p_role_key using errcode = '22023';
  end if;

  select w.organization_id into v_org_id
  from public.workspaces w
  where w.id = p_workspace_id;

  if v_org_id is null then
    raise exception 'Unknown workspace %', p_workspace_id using errcode = '23503';
  end if;

  select wm.role_key, wm.is_active
  into v_prev_role, v_prev_active
  from public.workspace_memberships wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id
  limit 1;

  insert into public.workspace_memberships (
    organization_id,
    workspace_id,
    user_id,
    role_key,
    is_active,
    two_factor_required,
    invited_by
  )
  values (
    v_org_id,
    p_workspace_id,
    p_user_id,
    p_role_key,
    coalesce(p_is_active, true),
    coalesce(p_two_factor_required, false),
    auth.uid()
  )
  on conflict (workspace_id, user_id) do update set
    role_key = excluded.role_key,
    is_active = excluded.is_active,
    two_factor_required = excluded.two_factor_required,
    updated_at = now();

  -- Keep legacy profiles rows scoped for tenant-aware joins.
  update public.profiles
  set
    organization_id = coalesce(public.profiles.organization_id, v_org_id),
    workspace_id = coalesce(public.profiles.workspace_id, p_workspace_id),
    updated_at = now()
  where id = p_user_id;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'access.user.upsert',
    'workspace_membership',
    p_user_id::text,
    p_reason,
    jsonb_build_object(
      'previousRole', v_prev_role,
      'newRole', p_role_key,
      'previousActive', v_prev_active,
      'newActive', coalesce(p_is_active, true),
      'twoFactorRequired', coalesce(p_two_factor_required, false)
    ),
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'workspaceId', p_workspace_id, 'userId', p_user_id);
end;
$$;

grant execute on function public.admin_upsert_workspace_user(uuid, uuid, text, boolean, boolean, text) to authenticated;

create or replace function public.admin_list_workspace_audit_logs(
  p_workspace_id uuid,
  p_action text default null,
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
  id uuid,
  admin_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  reason text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select public.workspace_require_permission(p_workspace_id, 'audit.read', auth.uid())
  )
  select
    a.id,
    a.admin_user_id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.reason,
    a.payload,
    a.created_at
  from public.admin_audit_logs a
  where a.workspace_id = p_workspace_id
    and (p_action is null or p_action = '' or a.action ilike '%' || p_action || '%')
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 250), 1000))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_list_workspace_audit_logs(uuid, text, integer, integer) to authenticated;

-- -------------------------------------------------------------------
-- Session monitoring RPCs
-- -------------------------------------------------------------------

create or replace function public.admin_security_hash_token(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.admin_register_security_session(
  p_workspace_id uuid,
  p_session_token text,
  p_device_name text default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_hash text;
  v_session_id uuid;
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  if coalesce(trim(p_session_token), '') = '' then
    raise exception 'Session token is required.' using errcode = '22023';
  end if;

  select w.organization_id into v_org_id
  from public.workspaces w
  where w.id = p_workspace_id;

  v_hash := public.admin_security_hash_token(p_session_token);

  insert into public.admin_security_sessions (
    organization_id,
    workspace_id,
    user_id,
    session_token_hash,
    device_name,
    ip_address,
    user_agent,
    metadata,
    started_at,
    last_seen_at
  )
  values (
    v_org_id,
    p_workspace_id,
    auth.uid(),
    v_hash,
    nullif(trim(coalesce(p_device_name, '')), ''),
    p_ip,
    p_user_agent,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (workspace_id, user_id, session_token_hash) do update set
    device_name = coalesce(excluded.device_name, public.admin_security_sessions.device_name),
    ip_address = coalesce(excluded.ip_address, public.admin_security_sessions.ip_address),
    user_agent = coalesce(excluded.user_agent, public.admin_security_sessions.user_agent),
    metadata = public.admin_security_sessions.metadata || excluded.metadata,
    last_seen_at = now(),
    revoked_at = null,
    revoked_by = null,
    revoke_reason = null,
    updated_at = now()
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.admin_register_security_session(uuid, text, text, inet, text, jsonb) to authenticated;

create or replace function public.admin_touch_security_session(
  p_workspace_id uuid,
  p_session_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  update public.admin_security_sessions s
  set
    last_seen_at = now(),
    updated_at = now()
  where s.workspace_id = p_workspace_id
    and s.user_id = auth.uid()
    and s.session_token_hash = public.admin_security_hash_token(p_session_token)
    and s.revoked_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

grant execute on function public.admin_touch_security_session(uuid, text) to authenticated;

create or replace function public.admin_list_security_sessions(
  p_workspace_id uuid,
  p_target_user_id uuid default null,
  p_limit integer default 250
)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role_key text,
  device_name text,
  ip_address text,
  user_agent text,
  started_at timestamptz,
  last_seen_at timestamptz,
  two_factor_verified_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select
      case
        when p_target_user_id is null then public.workspace_require_permission(p_workspace_id, 'security.read', auth.uid())
        when p_target_user_id <> auth.uid() then public.workspace_require_permission(p_workspace_id, 'security.read', auth.uid())
        else public.workspace_require_membership(p_workspace_id, auth.uid())
      end
  )
  select
    s.id,
    s.user_id,
    p.identifier as email,
    trim(concat_ws(' ', p.first_name, p.last_name)) as full_name,
    wm.role_key,
    s.device_name,
    host(s.ip_address) as ip_address,
    s.user_agent,
    s.started_at,
    s.last_seen_at,
    s.two_factor_verified_at,
    s.revoked_at,
    s.revoke_reason,
    s.user_id = auth.uid() as is_current_user
  from public.admin_security_sessions s
  left join public.profiles p on p.id = s.user_id
  left join public.workspace_memberships wm
    on wm.workspace_id = s.workspace_id
   and wm.user_id = s.user_id
  where s.workspace_id = p_workspace_id
    and (p_target_user_id is null or s.user_id = p_target_user_id)
  order by s.last_seen_at desc
  limit greatest(1, least(coalesce(p_limit, 250), 1000));
$$;

grant execute on function public.admin_list_security_sessions(uuid, uuid, integer) to authenticated;

create or replace function public.admin_revoke_security_session(
  p_workspace_id uuid,
  p_session_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_target_workspace uuid;
  v_has_manage boolean;
begin
  select s.user_id, s.workspace_id
  into v_target_user_id, v_target_workspace
  from public.admin_security_sessions s
  where s.id = p_session_id
  limit 1;

  if v_target_user_id is null then
    raise exception 'Session % not found.', p_session_id using errcode = 'P0002';
  end if;

  if v_target_workspace <> p_workspace_id then
    raise exception 'Session % does not belong to workspace %.', p_session_id, p_workspace_id using errcode = '42501';
  end if;

  v_has_manage := public.workspace_has_permission(p_workspace_id, 'security.manage', auth.uid());
  if not v_has_manage and v_target_user_id <> auth.uid() then
    raise exception 'security.manage permission required.' using errcode = '42501';
  end if;

  update public.admin_security_sessions
  set
    revoked_at = now(),
    revoked_by = auth.uid(),
    revoke_reason = coalesce(nullif(p_reason, ''), 'manual_revoke'),
    updated_at = now()
  where id = p_session_id;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.session.revoke',
    'admin_security_session',
    p_session_id::text,
    p_reason,
    jsonb_build_object('targetUserId', v_target_user_id),
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'sessionId', p_session_id);
end;
$$;

grant execute on function public.admin_revoke_security_session(uuid, uuid, text) to authenticated;

-- -------------------------------------------------------------------
-- TOTP functions
-- -------------------------------------------------------------------

create or replace function public.base32_to_bytea(p_input text)
returns bytea
language plpgsql
immutable
set search_path = public
as $$
declare
  v_clean text := upper(regexp_replace(coalesce(p_input, ''), '[^A-Z2-7]', '', 'g'));
  v_alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  v_bits text := '';
  v_char text;
  v_pos integer;
  v_byte integer;
  v_chunk text;
  v_result bytea := ''::bytea;
  i integer;
  j integer;
begin
  if v_clean = '' then
    return v_result;
  end if;

  for i in 1..length(v_clean) loop
    v_char := substr(v_clean, i, 1);
    v_pos := strpos(v_alphabet, v_char) - 1;
    if v_pos < 0 then
      raise exception 'Invalid base32 character: %', v_char using errcode = '22023';
    end if;

    for j in reverse 0..4 loop
      if ((v_pos >> j) & 1) = 1 then
        v_bits := v_bits || '1';
      else
        v_bits := v_bits || '0';
      end if;
    end loop;
  end loop;

  while length(v_bits) >= 8 loop
    v_chunk := substr(v_bits, 1, 8);
    v_bits := substr(v_bits, 9);

    v_byte := 0;
    for i in 1..8 loop
      if substr(v_chunk, i, 1) = '1' then
        v_byte := v_byte + (1 << (8 - i));
      end if;
    end loop;

    v_result := v_result || decode(lpad(to_hex(v_byte), 2, '0'), 'hex');
  end loop;

  return v_result;
end;
$$;

create or replace function public.totp_code_for_timestamp(
  p_secret_base32 text,
  p_epoch_seconds bigint
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_secret bytea;
  v_counter bytea;
  v_hash bytea;
  v_step bigint;
  v_offset integer;
  v_binary bigint;
  v_code integer;
begin
  v_secret := public.base32_to_bytea(p_secret_base32);
  if length(v_secret) = 0 then
    raise exception 'Secret is required.' using errcode = '22023';
  end if;

  v_step := floor(p_epoch_seconds / 30.0);
  if v_step < 0 then
    v_step := 0;
  end if;

  v_counter := decode(lpad(to_hex(v_step), 16, '0'), 'hex');
  v_hash := hmac(v_counter, v_secret, 'sha1');

  v_offset := get_byte(v_hash, 19) & 15;
  v_binary :=
      ((get_byte(v_hash, v_offset) & 127)::bigint << 24)
    | ((get_byte(v_hash, v_offset + 1) & 255)::bigint << 16)
    | ((get_byte(v_hash, v_offset + 2) & 255)::bigint << 8)
    | ((get_byte(v_hash, v_offset + 3) & 255)::bigint);

  v_code := (v_binary % 1000000)::integer;
  return lpad(v_code::text, 6, '0');
end;
$$;

create or replace function public.verify_totp_code(
  p_secret_base32 text,
  p_code text,
  p_window integer default 1,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_window integer := greatest(0, least(coalesce(p_window, 1), 3));
  v_now_epoch bigint := extract(epoch from p_now)::bigint;
  v_clean_code text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  i integer;
begin
  if length(v_clean_code) <> 6 then
    return false;
  end if;

  for i in -v_window..v_window loop
    if public.totp_code_for_timestamp(p_secret_base32, v_now_epoch + (i * 30)) = v_clean_code then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.admin_get_two_factor_status(
  p_workspace_id uuid,
  p_target_user_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select
      case
        when p_target_user_id <> auth.uid() then public.workspace_require_permission(p_workspace_id, 'security.read', auth.uid())
        else public.workspace_require_membership(p_workspace_id, auth.uid())
      end
  ),
  membership as (
    select wm.two_factor_required
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_target_user_id
      and wm.is_active = true
    limit 1
  ),
  tf as (
    select
      t.status,
      t.enabled_at,
      t.last_verified_at,
      cardinality(t.recovery_code_hashes) as recovery_codes_remaining
    from public.admin_user_2fa t
    where t.workspace_id = p_workspace_id
      and t.user_id = p_target_user_id
    limit 1
  )
  select jsonb_build_object(
    'workspaceId', p_workspace_id,
    'userId', p_target_user_id,
    'required', coalesce((select two_factor_required from membership), false),
    'status', coalesce((select status from tf), 'disabled'),
    'enabled', coalesce((select status = 'enabled' from tf), false),
    'enabledAt', (select enabled_at from tf),
    'lastVerifiedAt', (select last_verified_at from tf),
    'recoveryCodesRemaining', coalesce((select recovery_codes_remaining from tf), 0)
  );
$$;

grant execute on function public.admin_get_two_factor_status(uuid, uuid) to authenticated;

create or replace function public.admin_setup_totp(
  p_workspace_id uuid,
  p_secret_base32 text,
  p_recovery_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_clean_secret text;
  v_hashes text[];
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  v_clean_secret := upper(regexp_replace(coalesce(p_secret_base32, ''), '[^A-Z2-7]', '', 'g'));
  if length(v_clean_secret) < 16 then
    raise exception 'TOTP secret is invalid.' using errcode = '22023';
  end if;

  select w.organization_id into v_org_id
  from public.workspaces w
  where w.id = p_workspace_id;

  select coalesce(array_agg(crypt(code, gen_salt('bf'))), '{}'::text[])
  into v_hashes
  from (
    select nullif(trim(x), '') as code
    from unnest(coalesce(p_recovery_codes, '{}'::text[])) as x
  ) codes
  where code is not null;

  if cardinality(v_hashes) < 4 then
    raise exception 'At least 4 recovery codes are required.' using errcode = '22023';
  end if;

  insert into public.admin_user_2fa (
    organization_id,
    workspace_id,
    user_id,
    status,
    totp_secret_base32,
    recovery_code_hashes,
    enabled_at,
    last_verified_at
  )
  values (
    v_org_id,
    p_workspace_id,
    auth.uid(),
    'pending',
    v_clean_secret,
    v_hashes,
    null,
    null
  )
  on conflict (workspace_id, user_id) do update set
    status = 'pending',
    totp_secret_base32 = excluded.totp_secret_base32,
    recovery_code_hashes = excluded.recovery_code_hashes,
    enabled_at = null,
    last_verified_at = null,
    updated_at = now();

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.2fa.setup',
    'admin_user_2fa',
    auth.uid()::text,
    null,
    jsonb_build_object('status', 'pending'),
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

grant execute on function public.admin_setup_totp(uuid, text, text[]) to authenticated;

create or replace function public.admin_confirm_totp_enable(
  p_workspace_id uuid,
  p_code text,
  p_session_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.admin_user_2fa%rowtype;
  v_verified boolean;
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  select *
  into v_record
  from public.admin_user_2fa t
  where t.workspace_id = p_workspace_id
    and t.user_id = auth.uid()
  limit 1;

  if v_record.id is null or coalesce(v_record.totp_secret_base32, '') = '' then
    raise exception 'TOTP setup not found.' using errcode = 'P0002';
  end if;

  v_verified := public.verify_totp_code(v_record.totp_secret_base32, p_code, 1, now());
  if not v_verified then
    raise exception 'Invalid TOTP code.' using errcode = '22023';
  end if;

  update public.admin_user_2fa
  set
    status = 'enabled',
    enabled_at = coalesce(enabled_at, now()),
    last_verified_at = now(),
    updated_at = now()
  where id = v_record.id;

  if coalesce(trim(p_session_token), '') <> '' then
    update public.admin_security_sessions s
    set
      two_factor_verified_at = now(),
      updated_at = now()
    where s.workspace_id = p_workspace_id
      and s.user_id = auth.uid()
      and s.session_token_hash = public.admin_security_hash_token(p_session_token)
      and s.revoked_at is null;
  end if;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.2fa.enabled',
    'admin_user_2fa',
    auth.uid()::text,
    null,
    jsonb_build_object('recoveryCodesRemaining', cardinality(v_record.recovery_code_hashes)),
    null,
    null,
    auth.uid()
  );

  return public.admin_get_two_factor_status(p_workspace_id, auth.uid());
end;
$$;

grant execute on function public.admin_confirm_totp_enable(uuid, text, text) to authenticated;

create or replace function public.admin_verify_second_factor(
  p_workspace_id uuid,
  p_code text,
  p_session_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.admin_user_2fa%rowtype;
  v_clean_code text := regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g');
  v_method text := null;
  v_hashes text[];
  v_keep text[];
  v_hash text;
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  select *
  into v_record
  from public.admin_user_2fa t
  where t.workspace_id = p_workspace_id
    and t.user_id = auth.uid()
  limit 1;

  if v_record.id is null or v_record.status <> 'enabled' or coalesce(v_record.totp_secret_base32, '') = '' then
    raise exception '2FA is not enabled.' using errcode = '42501';
  end if;

  if public.verify_totp_code(v_record.totp_secret_base32, v_clean_code, 1, now()) then
    v_method := 'totp';
  else
    v_hashes := coalesce(v_record.recovery_code_hashes, '{}'::text[]);
    v_keep := '{}'::text[];

    foreach v_hash in array v_hashes loop
      if v_method is null and crypt(v_clean_code, v_hash) = v_hash then
        v_method := 'recovery_code';
      else
        v_keep := array_append(v_keep, v_hash);
      end if;
    end loop;

    if v_method = 'recovery_code' then
      update public.admin_user_2fa
      set
        recovery_code_hashes = v_keep,
        last_verified_at = now(),
        updated_at = now()
      where id = v_record.id;
    end if;
  end if;

  if v_method is null then
    raise exception 'Invalid second factor.' using errcode = '22023';
  end if;

  update public.admin_user_2fa
  set
    last_verified_at = now(),
    updated_at = now()
  where id = v_record.id;

  if coalesce(trim(p_session_token), '') <> '' then
    update public.admin_security_sessions s
    set
      two_factor_verified_at = now(),
      updated_at = now()
    where s.workspace_id = p_workspace_id
      and s.user_id = auth.uid()
      and s.session_token_hash = public.admin_security_hash_token(p_session_token)
      and s.revoked_at is null;
  end if;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.2fa.verified',
    'admin_user_2fa',
    auth.uid()::text,
    null,
    jsonb_build_object('method', v_method),
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'method', v_method,
    'status', public.admin_get_two_factor_status(p_workspace_id, auth.uid())
  );
end;
$$;

grant execute on function public.admin_verify_second_factor(uuid, text, text) to authenticated;

create or replace function public.admin_regenerate_recovery_codes(
  p_workspace_id uuid,
  p_new_recovery_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hashes text[];
begin
  perform public.workspace_require_membership(p_workspace_id, auth.uid());

  select coalesce(array_agg(crypt(code, gen_salt('bf'))), '{}'::text[])
  into v_hashes
  from (
    select nullif(trim(x), '') as code
    from unnest(coalesce(p_new_recovery_codes, '{}'::text[])) as x
  ) codes
  where code is not null;

  if cardinality(v_hashes) < 4 then
    raise exception 'At least 4 recovery codes are required.' using errcode = '22023';
  end if;

  update public.admin_user_2fa
  set
    recovery_code_hashes = v_hashes,
    updated_at = now()
  where workspace_id = p_workspace_id
    and user_id = auth.uid()
    and status = 'enabled';

  if not found then
    raise exception '2FA must be enabled before recovery codes can be regenerated.' using errcode = '42501';
  end if;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.2fa.recovery_codes.regenerated',
    'admin_user_2fa',
    auth.uid()::text,
    null,
    jsonb_build_object('codes', cardinality(v_hashes)),
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'recoveryCodes', cardinality(v_hashes));
end;
$$;

grant execute on function public.admin_regenerate_recovery_codes(uuid, text[]) to authenticated;

create or replace function public.admin_disable_totp(
  p_workspace_id uuid,
  p_target_user_id uuid default auth.uid(),
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_target_user_id <> auth.uid() then
    perform public.workspace_require_permission(p_workspace_id, 'security.manage', auth.uid());
  else
    perform public.workspace_require_membership(p_workspace_id, auth.uid());
  end if;

  update public.admin_user_2fa
  set
    status = 'disabled',
    totp_secret_base32 = null,
    recovery_code_hashes = '{}'::text[],
    enabled_at = null,
    last_verified_at = null,
    updated_at = now()
  where workspace_id = p_workspace_id
    and user_id = p_target_user_id;

  perform public.workspace_insert_audit_log(
    p_workspace_id,
    'security.2fa.disabled',
    'admin_user_2fa',
    p_target_user_id::text,
    p_reason,
    '{}'::jsonb,
    null,
    null,
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'workspaceId', p_workspace_id, 'userId', p_target_user_id);
end;
$$;

grant execute on function public.admin_disable_totp(uuid, uuid, text) to authenticated;

-- -------------------------------------------------------------------
-- RLS policies
-- -------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_roles enable row level security;
alter table public.workspace_permissions enable row level security;
alter table public.workspace_role_permissions enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.admin_security_sessions enable row level security;
alter table public.admin_user_2fa enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select using (
  exists (
    select 1
    from public.workspace_memberships wm
    where wm.organization_id = organizations.id
      and wm.user_id = auth.uid()
      and wm.is_active = true
  )
);

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
for select using (
  public.is_workspace_member(workspaces.id, auth.uid())
);

drop policy if exists workspace_roles_select on public.workspace_roles;
create policy workspace_roles_select on public.workspace_roles
for select using (
  exists (
    select 1
    from public.workspace_memberships wm
    where wm.user_id = auth.uid()
      and wm.is_active = true
  )
);

drop policy if exists workspace_permissions_select on public.workspace_permissions;
create policy workspace_permissions_select on public.workspace_permissions
for select using (
  exists (
    select 1
    from public.workspace_memberships wm
    where wm.user_id = auth.uid()
      and wm.is_active = true
  )
);

drop policy if exists workspace_role_permissions_select on public.workspace_role_permissions;
create policy workspace_role_permissions_select on public.workspace_role_permissions
for select using (
  exists (
    select 1
    from public.workspace_memberships wm
    where wm.user_id = auth.uid()
      and wm.is_active = true
  )
);

drop policy if exists workspace_memberships_select on public.workspace_memberships;
create policy workspace_memberships_select on public.workspace_memberships
for select using (
  user_id = auth.uid()
  or public.workspace_has_permission(workspace_id, 'users.read', auth.uid())
);

drop policy if exists admin_security_sessions_select on public.admin_security_sessions;
create policy admin_security_sessions_select on public.admin_security_sessions
for select using (
  user_id = auth.uid()
  or public.workspace_has_permission(workspace_id, 'security.read', auth.uid())
);

drop policy if exists admin_user_2fa_select on public.admin_user_2fa;
create policy admin_user_2fa_select on public.admin_user_2fa
for select using (
  user_id = auth.uid()
  or public.workspace_has_permission(workspace_id, 'security.read', auth.uid())
);

-- Keep existing admin compatibility while enabling tenant-aware audit reads/writes.
drop policy if exists admin_audit_logs_select on public.admin_audit_logs;
create policy admin_audit_logs_select on public.admin_audit_logs
for select using (
  public.is_admin_user(auth.uid())
  or (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'audit.read', auth.uid())
  )
);

drop policy if exists admin_audit_logs_insert on public.admin_audit_logs;
create policy admin_audit_logs_insert on public.admin_audit_logs
for insert with check (
  public.is_admin_user(auth.uid())
  or (
    workspace_id is not null
    and public.workspace_has_permission(workspace_id, 'audit.write', auth.uid())
  )
);

-- -------------------------------------------------------------------
-- Default seed tenant + bootstrap first auth user
-- -------------------------------------------------------------------

do $$
declare
  v_org_id uuid;
  v_workspace_id uuid;
  v_first_user uuid;
  v_super_admin_role uuid;
begin
  insert into public.organizations (name, slug, status)
  values ('FinVantage', 'finvantage', 'active')
  on conflict (slug) do update set
    name = excluded.name,
    status = excluded.status,
    updated_at = now();

  select id into v_org_id
  from public.organizations
  where slug = 'finvantage'
  limit 1;

  insert into public.workspaces (organization_id, name, slug, status)
  values (v_org_id, 'Primary Workspace', 'primary', 'active')
  on conflict (organization_id, slug) do update set
    name = excluded.name,
    status = excluded.status,
    updated_at = now();

  select id into v_workspace_id
  from public.workspaces
  where organization_id = v_org_id
    and slug = 'primary'
  limit 1;

  update public.profiles
  set
    organization_id = coalesce(public.profiles.organization_id, v_org_id),
    workspace_id = coalesce(public.profiles.workspace_id, v_workspace_id),
    updated_at = now()
  where public.profiles.organization_id is null
     or public.profiles.workspace_id is null;

  select id into v_first_user
  from auth.users
  order by created_at asc
  limit 1;

  if v_first_user is not null then
    insert into public.workspace_memberships (
      organization_id,
      workspace_id,
      user_id,
      role_key,
      is_active,
      two_factor_required,
      invited_by
    )
    values (
      v_org_id,
      v_workspace_id,
      v_first_user,
      'admin',
      true,
      false,
      v_first_user
    )
    on conflict (workspace_id, user_id) do update set
      role_key = 'admin',
      is_active = true,
      updated_at = now();

    update public.profiles
    set
      organization_id = v_org_id,
      workspace_id = v_workspace_id,
      updated_at = now()
    where id = v_first_user;

    -- Backward compatibility with legacy admin model.
    select id into v_super_admin_role
    from public.admin_roles
    where role_key = 'super_admin'
    limit 1;

    if v_super_admin_role is not null then
      insert into public.admin_users (user_id, role_id, is_active, two_factor_enabled)
      values (v_first_user, v_super_admin_role, true, false)
      on conflict (user_id) do update set
        role_id = excluded.role_id,
        is_active = true,
        updated_at = now();
    end if;
  end if;
end $$;
