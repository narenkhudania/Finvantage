-- Immutable suitability/compliance trail for personalized advisory outputs.
-- Adds tamper-evident advisory event chain with rationale + disclosure snapshots.

begin;

create extension if not exists pgcrypto;

create table if not exists public.advice_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text,
  advice_channel text not null default 'ai_advisor',
  user_prompt text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  disclosure_snapshot jsonb not null default '{}'::jsonb,
  recommendation_text text not null,
  recommendation_rationale jsonb not null default '{}'::jsonb,
  model_provider text not null default 'google',
  model_name text not null,
  model_version text,
  temperature numeric(6,4),
  metadata jsonb not null default '{}'::jsonb,
  input_hash text not null,
  output_hash text not null,
  previous_event_hash text,
  event_hash text not null,
  created_at timestamptz not null default now(),
  constraint advice_recommendation_events_hash_len_chk check (
    char_length(input_hash) = 64
    and char_length(output_hash) = 64
    and char_length(event_hash) = 64
    and (previous_event_hash is null or char_length(previous_event_hash) = 64)
  )
);

create unique index if not exists advice_reco_events_user_request_uidx
  on public.advice_recommendation_events(user_id, request_id)
  where request_id is not null;

create index if not exists advice_reco_events_user_time_idx
  on public.advice_recommendation_events(user_id, created_at desc);

create index if not exists advice_reco_events_event_hash_idx
  on public.advice_recommendation_events(event_hash);

create table if not exists public.advice_recommendation_event_heads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_event_id uuid references public.advice_recommendation_events(id) on delete set null,
  last_event_hash text,
  updated_at timestamptz not null default now(),
  constraint advice_reco_heads_hash_len_chk check (
    last_event_hash is null or char_length(last_event_hash) = 64
  )
);

create or replace function public.prevent_advice_recommendation_events_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'advice_recommendation_events are immutable';
end;
$$;

drop trigger if exists trg_advice_reco_events_no_update_delete on public.advice_recommendation_events;
create trigger trg_advice_reco_events_no_update_delete
before update or delete on public.advice_recommendation_events
for each row execute function public.prevent_advice_recommendation_events_mutation();

create or replace function public.insert_advice_recommendation_event(
  p_user_id uuid,
  p_request_id text default null,
  p_advice_channel text default 'ai_advisor',
  p_user_prompt text default '',
  p_input_snapshot jsonb default '{}'::jsonb,
  p_disclosure_snapshot jsonb default '{}'::jsonb,
  p_recommendation_text text default '',
  p_recommendation_rationale jsonb default '{}'::jsonb,
  p_model_provider text default 'google',
  p_model_name text default '',
  p_model_version text default null,
  p_temperature numeric default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_event_id uuid;
  v_previous_hash text;
  v_created_at timestamptz := now();
  v_input_hash text;
  v_output_hash text;
  v_event_hash text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_request_id is not null and length(trim(p_request_id)) > 0 then
    select e.id
      into v_existing_id
    from public.advice_recommendation_events e
    where e.user_id = p_user_id
      and e.request_id = p_request_id
    limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  insert into public.advice_recommendation_event_heads(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select h.last_event_hash
    into v_previous_hash
  from public.advice_recommendation_event_heads h
  where h.user_id = p_user_id
  for update;

  v_input_hash := encode(
    digest(coalesce(p_input_snapshot::text, '{}'::text), 'sha256'),
    'hex'
  );

  v_output_hash := encode(
    digest(
      coalesce(p_recommendation_text, '') || '|' || coalesce(p_recommendation_rationale::text, '{}'::text),
      'sha256'
    ),
    'hex'
  );

  v_event_hash := encode(
    digest(
      coalesce(v_previous_hash, '') || '|' ||
      p_user_id::text || '|' ||
      coalesce(p_request_id, '') || '|' ||
      coalesce(p_advice_channel, '') || '|' ||
      coalesce(p_user_prompt, '') || '|' ||
      v_input_hash || '|' ||
      v_output_hash || '|' ||
      v_created_at::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.advice_recommendation_events (
    user_id,
    request_id,
    advice_channel,
    user_prompt,
    input_snapshot,
    disclosure_snapshot,
    recommendation_text,
    recommendation_rationale,
    model_provider,
    model_name,
    model_version,
    temperature,
    metadata,
    input_hash,
    output_hash,
    previous_event_hash,
    event_hash,
    created_at
  ) values (
    p_user_id,
    nullif(trim(coalesce(p_request_id, '')), ''),
    coalesce(nullif(trim(coalesce(p_advice_channel, '')), ''), 'ai_advisor'),
    coalesce(p_user_prompt, ''),
    coalesce(p_input_snapshot, '{}'::jsonb),
    coalesce(p_disclosure_snapshot, '{}'::jsonb),
    coalesce(p_recommendation_text, ''),
    coalesce(p_recommendation_rationale, '{}'::jsonb),
    coalesce(nullif(trim(coalesce(p_model_provider, '')), ''), 'google'),
    coalesce(p_model_name, ''),
    nullif(trim(coalesce(p_model_version, '')), ''),
    p_temperature,
    coalesce(p_metadata, '{}'::jsonb),
    v_input_hash,
    v_output_hash,
    v_previous_hash,
    v_event_hash,
    v_created_at
  )
  returning id into v_event_id;

  update public.advice_recommendation_event_heads
  set
    last_event_id = v_event_id,
    last_event_hash = v_event_hash,
    updated_at = v_created_at
  where user_id = p_user_id;

  return v_event_id;
end;
$$;

revoke all on function public.insert_advice_recommendation_event(
  uuid, text, text, text, jsonb, jsonb, text, jsonb, text, text, text, numeric, jsonb
) from public;

grant execute on function public.insert_advice_recommendation_event(
  uuid, text, text, text, jsonb, jsonb, text, jsonb, text, text, text, numeric, jsonb
) to service_role;

alter table public.advice_recommendation_events enable row level security;
alter table public.advice_recommendation_event_heads enable row level security;

drop policy if exists advice_recommendation_events_select on public.advice_recommendation_events;
create policy advice_recommendation_events_select on public.advice_recommendation_events
for select
using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists advice_recommendation_event_heads_select on public.advice_recommendation_event_heads;
create policy advice_recommendation_event_heads_select on public.advice_recommendation_event_heads
for select
using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

commit;
