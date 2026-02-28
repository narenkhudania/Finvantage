-- Harden auth signup bootstrap so auth.signUp does not fail even when
-- tenant tables/columns are partially applied or missing.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_workspace_id uuid;
  v_first_name text;
  v_last_name text;
  v_has_profiles_org boolean;
  v_has_profiles_workspace boolean;
  v_has_organizations boolean;
  v_has_workspaces boolean;
  v_has_workspace_memberships boolean;
begin
  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'organization_id'
  ) into v_has_profiles_org;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'workspace_id'
  ) into v_has_profiles_workspace;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organizations'
  ) into v_has_organizations;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'workspaces'
  ) into v_has_workspaces;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'workspace_memberships'
  ) into v_has_workspace_memberships;

  -- Tenant bootstrap is optional. We only execute it when all prerequisites exist.
  if v_has_profiles_org and v_has_profiles_workspace and v_has_organizations and v_has_workspaces then
    insert into public.organizations (name, slug, status)
    values ('FinVantage', 'finvantage', 'active')
    on conflict (slug) do update
      set name = excluded.name,
          status = excluded.status,
          updated_at = now();

    select id into v_org_id
    from public.organizations
    where slug = 'finvantage'
    limit 1;

    insert into public.workspaces (organization_id, name, slug, status)
    values (v_org_id, 'Primary Workspace', 'primary', 'active')
    on conflict (organization_id, slug) do update
      set name = excluded.name,
          status = excluded.status,
          updated_at = now();

    select id into v_workspace_id
    from public.workspaces
    where organization_id = v_org_id
      and slug = 'primary'
    limit 1;
  end if;

  if v_has_profiles_org and v_has_profiles_workspace and v_org_id is not null and v_workspace_id is not null then
    insert into public.profiles (
      id,
      identifier,
      first_name,
      last_name,
      organization_id,
      workspace_id
    )
    values (
      new.id,
      coalesce(new.email, new.id::text),
      coalesce(v_first_name, 'User'),
      v_last_name,
      v_org_id,
      v_workspace_id
    )
    on conflict (id) do update
      set identifier = excluded.identifier,
          first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name, 'User'),
          last_name = coalesce(excluded.last_name, public.profiles.last_name),
          organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
          workspace_id = coalesce(public.profiles.workspace_id, excluded.workspace_id),
          updated_at = now();
  else
    -- Fallback for base schema without tenant columns.
    insert into public.profiles (
      id,
      identifier,
      first_name,
      last_name
    )
    values (
      new.id,
      coalesce(new.email, new.id::text),
      coalesce(v_first_name, 'User'),
      v_last_name
    )
    on conflict (id) do update
      set identifier = excluded.identifier,
          first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name, 'User'),
          last_name = coalesce(excluded.last_name, public.profiles.last_name),
          updated_at = now();
  end if;

  if v_has_workspace_memberships and v_org_id is not null and v_workspace_id is not null then
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
      new.id,
      'analyst',
      true,
      false,
      null
    )
    on conflict (workspace_id, user_id) do update
      set organization_id = excluded.organization_id,
          is_active = true,
          updated_at = now();
  end if;

  return new;
exception
  when others then
    -- Last-resort guard: never block auth.signUp because of bootstrap side effects.
    begin
      insert into public.profiles (
        id,
        identifier,
        first_name,
        last_name
      )
      values (
        new.id,
        coalesce(new.email, new.id::text),
        coalesce(v_first_name, 'User'),
        v_last_name
      )
      on conflict (id) do update
        set identifier = excluded.identifier,
            first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name, 'User'),
            last_name = coalesce(excluded.last_name, public.profiles.last_name),
            updated_at = now();
    exception
      when others then
        null;
    end;

    return new;
end;
$$;

-- Remove legacy/duplicate signup triggers that can conflict or fail.
drop trigger if exists trg_on_auth_user_created on auth.users;
drop trigger if exists on_user_assign_starter on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

-- Keep a single canonical trigger for new-user bootstrap.
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
