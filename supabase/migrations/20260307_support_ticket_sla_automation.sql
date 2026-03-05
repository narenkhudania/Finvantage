-- Support ticket SLA + escalation automation hardening
-- Adds enforceable deadlines, escalation state, and sweep functions
-- so complaint operations do not depend on manual monitoring.

alter table if exists public.support_tickets
  add column if not exists opened_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists first_response_due_at timestamptz,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists sla_status text not null default 'on_track',
  add column if not exists escalated boolean not null default false,
  add column if not exists escalation_level integer not null default 0,
  add column if not exists escalation_count integer not null default 0,
  add column if not exists escalation_reason text,
  add column if not exists escalated_at timestamptz,
  add column if not exists last_escalated_at timestamptz,
  add column if not exists next_escalation_at timestamptz,
  add column if not exists first_breached_at timestamptz,
  add column if not exists breach_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_sla_status_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_sla_status_chk
      check (sla_status in ('on_track', 'due_soon', 'breached', 'paused', 'met'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_escalation_level_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_escalation_level_chk
      check (escalation_level >= 0 and escalation_level <= 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_escalation_count_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_escalation_count_chk
      check (escalation_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_breach_count_chk'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_breach_count_chk
      check (breach_count >= 0);
  end if;
end $$;

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'system',
  actor_id uuid,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_sla_status_due_idx
  on public.support_tickets (sla_status, resolution_due_at)
  where lower(coalesce(status, 'open')) in ('open', 'in_progress', 'waiting_user');

create index if not exists support_tickets_escalation_idx
  on public.support_tickets (escalated, escalation_level, next_escalation_at)
  where lower(coalesce(status, 'open')) in ('open', 'in_progress', 'waiting_user');

create index if not exists support_tickets_opened_idx
  on public.support_tickets (opened_at);

create index if not exists support_ticket_events_ticket_time_idx
  on public.support_ticket_events (ticket_id, created_at desc);

create or replace function public.support_sla_hours(
  p_priority text,
  p_metric text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_priority text := lower(coalesce(p_priority, 'medium'));
  v_metric text := lower(coalesce(p_metric, 'resolution'));
begin
  if v_metric in ('first_response', 'response', 'first-response') then
    case v_priority
      when 'urgent' then return 1;
      when 'high' then return 4;
      when 'medium' then return 12;
      else return 24;
    end case;
  end if;

  case v_priority
    when 'urgent' then return 4;
    when 'high' then return 24;
    when 'medium' then return 72;
    else return 120;
  end case;
end;
$$;

grant execute on function public.support_sla_hours(text, text) to authenticated;

create or replace function public.support_tickets_apply_sla_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_opened timestamptz;
begin
  v_opened := coalesce(new.opened_at, new.created_at, v_now);
  new.opened_at := v_opened;

  if tg_op = 'INSERT' then
    new.first_response_due_at := coalesce(
      new.first_response_due_at,
      v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'first_response'))
    );
    new.resolution_due_at := coalesce(
      new.resolution_due_at,
      v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'resolution'))
    );
  else
    if new.priority is distinct from old.priority or new.opened_at is distinct from old.opened_at then
      new.first_response_due_at := v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'first_response'));
      new.resolution_due_at := v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'resolution'));
    else
      new.first_response_due_at := coalesce(
        new.first_response_due_at,
        v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'first_response'))
      );
      new.resolution_due_at := coalesce(
        new.resolution_due_at,
        v_opened + make_interval(hours => public.support_sla_hours(new.priority, 'resolution'))
      );
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('in_progress', 'waiting_user')
      and coalesce(old.status, 'open') = 'open'
      and new.first_response_at is null then
      new.first_response_at := v_now;
    end if;

    if new.status in ('resolved', 'closed') then
      new.closed_at := coalesce(new.closed_at, v_now);
      new.sla_status := 'met';
      new.escalated := false;
      new.next_escalation_at := null;
    elsif old.status in ('resolved', 'closed') then
      new.closed_at := null;
    end if;
  end if;

  new.sla_status := coalesce(new.sla_status, 'on_track');
  new.escalated := coalesce(new.escalated, false);
  new.escalation_level := coalesce(new.escalation_level, 0);
  new.escalation_count := coalesce(new.escalation_count, 0);
  new.breach_count := coalesce(new.breach_count, 0);

  return new;
end;
$$;

drop trigger if exists set_support_tickets_sla_defaults on public.support_tickets;
create trigger set_support_tickets_sla_defaults
before insert or update on public.support_tickets
for each row execute function public.support_tickets_apply_sla_defaults();

create or replace function public.support_run_sla_sweep(
  p_due_soon_hours integer default 6,
  p_force_escalation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_due_soon interval := make_interval(hours => greatest(1, least(coalesce(p_due_soon_hours, 6), 72)));
  v_row record;
  v_first_due timestamptz;
  v_resolution_due timestamptz;
  v_new_sla_status text;
  v_escalation_reason text;
  v_should_escalate boolean;
  v_scanned integer := 0;
  v_updated integer := 0;
  v_escalated integer := 0;
  v_breached integer := 0;
  v_new_level integer;
begin
  if coalesce(public.is_admin_user(auth.uid()), false) = false then
    raise exception 'admin permission denied for ops.manage' using errcode = '42501';
  end if;

  for v_row in
    select *
    from public.support_tickets
    where lower(coalesce(status, 'open')) in ('open', 'in_progress', 'waiting_user')
    order by coalesce(resolution_due_at, created_at) asc
    for update skip locked
  loop
    v_scanned := v_scanned + 1;

    v_first_due := coalesce(
      v_row.first_response_due_at,
      coalesce(v_row.opened_at, v_row.created_at, v_now)
      + make_interval(hours => public.support_sla_hours(v_row.priority, 'first_response'))
    );
    v_resolution_due := coalesce(
      v_row.resolution_due_at,
      coalesce(v_row.opened_at, v_row.created_at, v_now)
      + make_interval(hours => public.support_sla_hours(v_row.priority, 'resolution'))
    );

    if v_resolution_due <= v_now then
      v_new_sla_status := 'breached';
      v_breached := v_breached + 1;
    elsif v_resolution_due <= v_now + v_due_soon then
      v_new_sla_status := 'due_soon';
    else
      v_new_sla_status := 'on_track';
    end if;

    if v_row.first_response_at is null and v_first_due <= v_now then
      v_escalation_reason := 'first_response_sla_breach';
    elsif v_new_sla_status = 'breached' then
      v_escalation_reason := 'resolution_sla_breach';
    else
      v_escalation_reason := null;
    end if;

    v_should_escalate := v_escalation_reason is not null and (
      p_force_escalation
      or v_row.last_escalated_at is null
      or v_row.last_escalated_at <= v_now - interval '12 hour'
    );

    v_new_level := case
      when v_should_escalate then least(3, coalesce(v_row.escalation_level, 0) + 1)
      else coalesce(v_row.escalation_level, 0)
    end;

    update public.support_tickets
    set
      first_response_due_at = v_first_due,
      resolution_due_at = v_resolution_due,
      sla_status = v_new_sla_status,
      first_breached_at = case
        when v_new_sla_status = 'breached' then coalesce(v_row.first_breached_at, v_now)
        else v_row.first_breached_at
      end,
      breach_count = case
        when v_new_sla_status = 'breached' and coalesce(v_row.sla_status, 'on_track') <> 'breached' then coalesce(v_row.breach_count, 0) + 1
        else coalesce(v_row.breach_count, 0)
      end,
      escalated = case
        when v_should_escalate then true
        else coalesce(v_row.escalated, false)
      end,
      escalation_level = v_new_level,
      escalation_count = case
        when v_should_escalate then coalesce(v_row.escalation_count, 0) + 1
        else coalesce(v_row.escalation_count, 0)
      end,
      escalation_reason = case
        when v_should_escalate then v_escalation_reason
        else v_row.escalation_reason
      end,
      escalated_at = case
        when v_should_escalate then coalesce(v_row.escalated_at, v_now)
        else v_row.escalated_at
      end,
      last_escalated_at = case
        when v_should_escalate then v_now
        else v_row.last_escalated_at
      end,
      next_escalation_at = case
        when v_should_escalate then v_now + interval '12 hour'
        else v_row.next_escalation_at
      end,
      updated_at = case
        when v_should_escalate
          or v_new_sla_status is distinct from coalesce(v_row.sla_status, 'on_track')
          or v_row.first_response_due_at is null
          or v_row.resolution_due_at is null
        then v_now
        else v_row.updated_at
      end
    where id = v_row.id;

    if v_should_escalate then
      v_escalated := v_escalated + 1;
      insert into public.support_ticket_events (
        ticket_id,
        event_type,
        actor_type,
        actor_id,
        from_status,
        to_status,
        metadata
      ) values (
        v_row.id,
        'sla_escalated',
        'system',
        auth.uid(),
        coalesce(v_row.sla_status, 'on_track'),
        v_new_sla_status,
        jsonb_build_object(
          'reason', v_escalation_reason,
          'escalationLevel', v_new_level,
          'priority', v_row.priority,
          'status', v_row.status
        )
      );
    elsif v_new_sla_status is distinct from coalesce(v_row.sla_status, 'on_track') then
      insert into public.support_ticket_events (
        ticket_id,
        event_type,
        actor_type,
        actor_id,
        from_status,
        to_status,
        metadata
      ) values (
        v_row.id,
        'sla_status_changed',
        'system',
        auth.uid(),
        coalesce(v_row.sla_status, 'on_track'),
        v_new_sla_status,
        jsonb_build_object(
          'priority', v_row.priority,
          'status', v_row.status
        )
      );
    end if;

    if v_should_escalate
      or v_new_sla_status is distinct from coalesce(v_row.sla_status, 'on_track')
      or v_row.first_response_due_at is null
      or v_row.resolution_due_at is null then
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'scanned', v_scanned,
    'updated', v_updated,
    'escalated', v_escalated,
    'breached', v_breached,
    'ranAt', v_now
  );
end;
$$;

grant execute on function public.support_run_sla_sweep(integer, boolean) to authenticated;

create or replace function public.support_escalate_ticket(
  p_ticket_id uuid,
  p_reason text default 'manual_escalation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row record;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'manual_escalation');
  v_new_level integer;
begin
  if coalesce(public.is_admin_user(auth.uid()), false) = false then
    raise exception 'admin permission denied for ops.manage' using errcode = '42501';
  end if;

  select *
  into v_row
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ticket_not_found', 'ticketId', p_ticket_id);
  end if;

  if lower(coalesce(v_row.status, 'open')) in ('resolved', 'closed') then
    return jsonb_build_object('ok', false, 'reason', 'ticket_closed', 'ticketId', p_ticket_id);
  end if;

  v_new_level := least(3, coalesce(v_row.escalation_level, 0) + 1);

  update public.support_tickets
  set
    escalated = true,
    escalation_level = v_new_level,
    escalation_count = coalesce(v_row.escalation_count, 0) + 1,
    escalation_reason = v_reason,
    escalated_at = coalesce(v_row.escalated_at, v_now),
    last_escalated_at = v_now,
    next_escalation_at = v_now + interval '12 hour',
    sla_status = case
      when coalesce(v_row.sla_status, 'on_track') = 'on_track' then 'due_soon'
      else coalesce(v_row.sla_status, 'on_track')
    end,
    updated_at = v_now
  where id = p_ticket_id;

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    actor_type,
    actor_id,
    from_status,
    to_status,
    metadata
  ) values (
    p_ticket_id,
    'manual_escalated',
    'admin',
    auth.uid(),
    coalesce(v_row.sla_status, 'on_track'),
    coalesce(v_row.sla_status, 'on_track'),
    jsonb_build_object(
      'reason', v_reason,
      'escalationLevel', v_new_level,
      'priority', v_row.priority,
      'status', v_row.status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'ticketId', p_ticket_id,
    'escalationLevel', v_new_level,
    'reason', v_reason,
    'escalatedAt', v_now
  );
end;
$$;

grant execute on function public.support_escalate_ticket(uuid, text) to authenticated;

update public.support_tickets
set opened_at = coalesce(opened_at, created_at, now())
where opened_at is null;

update public.support_tickets
set first_response_due_at = coalesce(
      first_response_due_at,
      opened_at + make_interval(hours => public.support_sla_hours(priority, 'first_response'))
    ),
    resolution_due_at = coalesce(
      resolution_due_at,
      opened_at + make_interval(hours => public.support_sla_hours(priority, 'resolution'))
    )
where first_response_due_at is null
   or resolution_due_at is null;

update public.support_tickets
set closed_at = coalesce(closed_at, resolved_at, updated_at, now())
where lower(coalesce(status, '')) in ('resolved', 'closed')
  and closed_at is null;

update public.support_tickets
set sla_status = case
    when lower(coalesce(status, 'open')) in ('resolved', 'closed') then 'met'
    when coalesce(resolution_due_at, now()) <= now() then 'breached'
    when coalesce(resolution_due_at, now()) <= now() + interval '6 hour' then 'due_soon'
    else 'on_track'
  end
where sla_status is null
   or sla_status not in ('on_track', 'due_soon', 'breached', 'paused', 'met');
