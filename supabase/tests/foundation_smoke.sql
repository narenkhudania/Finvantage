-- Foundation smoke tests (tenant RBAC + audit + sessions + TOTP + ingestion)
-- Execute manually in Supabase SQL editor after migrations.

begin;

do $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_workspace_id uuid;
  v_access jsonb;
  v_audit_id uuid;
  v_status jsonb;
  v_totp_secret text := 'JBSWY3DPEHPK3PXP';
  v_totp_code text;
  v_session_count integer;
  v_event_count integer;
begin
  select id
  into v_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if v_user_id is null then
    raise notice 'SKIP: no auth.users rows available; create one user first.';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.organizations (name, slug, status)
  values ('Smoke Org', 'smoke-org', 'active')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.workspaces (organization_id, name, slug, status)
  values (v_org_id, 'Smoke Workspace', 'smoke-ws', 'active')
  on conflict (organization_id, slug) do update set name = excluded.name
  returning id into v_workspace_id;

  insert into public.workspace_memberships (
    organization_id,
    workspace_id,
    user_id,
    role_key,
    is_active,
    two_factor_required,
    invited_by
  )
  values (v_org_id, v_workspace_id, v_user_id, 'admin', true, false, v_user_id)
  on conflict (workspace_id, user_id) do update set
    role_key = 'admin',
    is_active = true,
    updated_at = now();

  v_access := public.admin_current_access_v2(v_workspace_id);
  if coalesce((v_access ->> 'isAdmin')::boolean, false) is distinct from true then
    raise exception 'Expected isAdmin=true from admin_current_access_v2. Payload=%', v_access;
  end if;

  if not public.workspace_has_permission(v_workspace_id, 'users.manage', v_user_id) then
    raise exception 'Expected users.manage for seeded admin role.';
  end if;

  v_audit_id := public.workspace_admin_insert_audit_log(
    v_workspace_id,
    'smoke.audit.write',
    'smoke_entity',
    'smoke-1',
    'smoke test',
    '{"ok":true}'::jsonb,
    null,
    'smoke-agent'
  );

  if v_audit_id is null then
    raise exception 'Expected audit log id from workspace_admin_insert_audit_log.';
  end if;

  perform public.admin_register_security_session(
    v_workspace_id,
    'smoke-session-token',
    'smoke-device',
    null,
    'smoke-agent',
    '{"suite":"foundation"}'::jsonb
  );

  select count(*)
  into v_session_count
  from public.admin_security_sessions
  where workspace_id = v_workspace_id
    and user_id = v_user_id
    and revoked_at is null;

  if v_session_count < 1 then
    raise exception 'Expected at least 1 active admin_security_sessions row.';
  end if;

  perform public.admin_setup_totp(
    v_workspace_id,
    v_totp_secret,
    array['A1B2C-9X8Y7', 'C3D4E-7W6V5', 'E5F6G-5U4T3', 'H7I8J-3S2R1', 'K9L0M-1Q2P3']::text[]
  );

  v_totp_code := public.totp_code_for_timestamp(v_totp_secret, extract(epoch from now())::bigint);
  v_status := public.admin_confirm_totp_enable(v_workspace_id, v_totp_code, 'smoke-session-token');

  if coalesce((v_status ->> 'enabled')::boolean, false) is distinct from true then
    raise exception 'Expected enabled=true after admin_confirm_totp_enable. Payload=%', v_status;
  end if;

  insert into public.activity_events (
    user_id,
    event_name,
    source,
    metadata,
    event_time,
    organization_id,
    workspace_id
  )
  values (
    v_user_id,
    'smoke.event',
    'smoke_test',
    '{"source":"foundation_smoke"}'::jsonb,
    now(),
    v_org_id,
    v_workspace_id
  );

  select count(*)
  into v_event_count
  from public.activity_events
  where workspace_id = v_workspace_id
    and event_name = 'smoke.event';

  if v_event_count < 1 then
    raise exception 'Expected smoke.event in activity_events.';
  end if;

  raise notice 'Foundation smoke checks passed for workspace % and user %', v_workspace_id, v_user_id;
end;
$$;

rollback;
