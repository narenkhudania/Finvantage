-- Internal CRM + Behavior Intelligence + Automation schema
-- Scope: No external integrations. Internal admin and product telemetry only.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------
-- CRM core entities
-- -------------------------------------------------------------------

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  source text not null default 'direct',
  stage text not null default 'new',
  lead_score integer not null default 0,
  tags text[] not null default '{}'::text[],
  owner text,
  last_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_contacts_email_idx on public.crm_contacts(lower(email));
create index if not exists crm_contacts_user_idx on public.crm_contacts(user_id);
create index if not exists crm_contacts_stage_score_idx on public.crm_contacts(stage, lead_score desc);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts(id) on delete set null,
  title text not null,
  source text not null default 'internal',
  stage text not null default 'new',
  status text not null default 'open',
  score integer not null default 0,
  value numeric not null default 0,
  tags text[] not null default '{}'::text[],
  next_action_at timestamptz,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_contact_idx on public.crm_leads(contact_id);
create index if not exists crm_leads_stage_status_idx on public.crm_leads(stage, status);
create index if not exists crm_leads_score_idx on public.crm_leads(score desc);

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  name text not null,
  stage text not null default 'discovery',
  status text not null default 'open',
  amount numeric not null default 0,
  probability_pct numeric not null default 0,
  expected_close_at timestamptz,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_deals_stage_status_idx on public.crm_deals(stage, status);
create index if not exists crm_deals_close_date_idx on public.crm_deals(expected_close_at);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz,
  meeting_at timestamptz,
  assignee text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_tasks_status_priority_idx on public.crm_tasks(status, priority);
create index if not exists crm_tasks_due_idx on public.crm_tasks(due_at);

create table if not exists public.crm_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preview_text text not null default '',
  body_markdown text not null default '',
  sent integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_email_templates_name_key on public.crm_email_templates(lower(name));

create table if not exists public.crm_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  trigger text not null,
  condition_logic text not null default 'true',
  channels text[] not null default '{in_app}'::text[],
  step_count integer not null default 1,
  enrolled integer not null default 0,
  last_run_at timestamptz,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_workflows_status_idx on public.crm_workflows(status);

create table if not exists public.crm_custom_objects (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  title text not null,
  status text not null default 'active',
  owner text,
  score integer not null default 0,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_custom_objects_type_status_idx on public.crm_custom_objects(object_type, status);

-- -------------------------------------------------------------------
-- Experience intelligence entities
-- -------------------------------------------------------------------

create table if not exists public.experience_feedback_polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  poll_type text not null,
  rating integer,
  feedback text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experience_feedback_user_idx on public.experience_feedback_polls(user_id, created_at desc);
create index if not exists experience_feedback_status_idx on public.experience_feedback_polls(status);

create table if not exists public.experience_session_records (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null default 'web',
  source text not null default 'app',
  duration_sec numeric not null default 0,
  interactions integer not null default 0,
  rage_clicks integer not null default 0,
  dead_clicks integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists experience_sessions_user_idx on public.experience_session_records(user_id);
create index if not exists experience_sessions_created_idx on public.experience_session_records(created_at desc);

create table if not exists public.experience_heatmap_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  screen text not null default 'unknown',
  zone text not null default 'general',
  interaction_type text not null default 'click',
  scroll_depth numeric,
  is_rage boolean not null default false,
  is_dead boolean not null default false,
  event_time timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists experience_heatmap_screen_zone_idx on public.experience_heatmap_events(screen, zone);
create index if not exists experience_heatmap_event_time_idx on public.experience_heatmap_events(event_time desc);
create index if not exists experience_heatmap_user_idx on public.experience_heatmap_events(user_id);

-- -------------------------------------------------------------------
-- Updated_at triggers
-- -------------------------------------------------------------------

drop trigger if exists set_crm_contacts_updated_at on public.crm_contacts;
create trigger set_crm_contacts_updated_at
before update on public.crm_contacts
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_leads_updated_at on public.crm_leads;
create trigger set_crm_leads_updated_at
before update on public.crm_leads
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_deals_updated_at on public.crm_deals;
create trigger set_crm_deals_updated_at
before update on public.crm_deals
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_tasks_updated_at on public.crm_tasks;
create trigger set_crm_tasks_updated_at
before update on public.crm_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_email_templates_updated_at on public.crm_email_templates;
create trigger set_crm_email_templates_updated_at
before update on public.crm_email_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_workflows_updated_at on public.crm_workflows;
create trigger set_crm_workflows_updated_at
before update on public.crm_workflows
for each row execute function public.set_updated_at();

drop trigger if exists set_crm_custom_objects_updated_at on public.crm_custom_objects;
create trigger set_crm_custom_objects_updated_at
before update on public.crm_custom_objects
for each row execute function public.set_updated_at();

drop trigger if exists set_experience_feedback_polls_updated_at on public.experience_feedback_polls;
create trigger set_experience_feedback_polls_updated_at
before update on public.experience_feedback_polls
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- RLS and policies
-- -------------------------------------------------------------------

alter table public.crm_contacts enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_email_templates enable row level security;
alter table public.crm_workflows enable row level security;
alter table public.crm_custom_objects enable row level security;
alter table public.experience_feedback_polls enable row level security;
alter table public.experience_session_records enable row level security;
alter table public.experience_heatmap_events enable row level security;

-- CRM: admin-only operations

drop policy if exists crm_contacts_select on public.crm_contacts;
create policy crm_contacts_select on public.crm_contacts
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_contacts_insert on public.crm_contacts;
create policy crm_contacts_insert on public.crm_contacts
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_contacts_update on public.crm_contacts;
create policy crm_contacts_update on public.crm_contacts
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_leads_select on public.crm_leads;
create policy crm_leads_select on public.crm_leads
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_leads_insert on public.crm_leads;
create policy crm_leads_insert on public.crm_leads
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_leads_update on public.crm_leads;
create policy crm_leads_update on public.crm_leads
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_deals_select on public.crm_deals;
create policy crm_deals_select on public.crm_deals
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_deals_insert on public.crm_deals;
create policy crm_deals_insert on public.crm_deals
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_deals_update on public.crm_deals;
create policy crm_deals_update on public.crm_deals
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_tasks_select on public.crm_tasks;
create policy crm_tasks_select on public.crm_tasks
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_tasks_insert on public.crm_tasks;
create policy crm_tasks_insert on public.crm_tasks
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_tasks_update on public.crm_tasks;
create policy crm_tasks_update on public.crm_tasks
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_email_templates_select on public.crm_email_templates;
create policy crm_email_templates_select on public.crm_email_templates
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_email_templates_insert on public.crm_email_templates;
create policy crm_email_templates_insert on public.crm_email_templates
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_email_templates_update on public.crm_email_templates;
create policy crm_email_templates_update on public.crm_email_templates
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_workflows_select on public.crm_workflows;
create policy crm_workflows_select on public.crm_workflows
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_workflows_insert on public.crm_workflows;
create policy crm_workflows_insert on public.crm_workflows
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_workflows_update on public.crm_workflows;
create policy crm_workflows_update on public.crm_workflows
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_custom_objects_select on public.crm_custom_objects;
create policy crm_custom_objects_select on public.crm_custom_objects
for select using (public.is_admin_user(auth.uid()));

drop policy if exists crm_custom_objects_insert on public.crm_custom_objects;
create policy crm_custom_objects_insert on public.crm_custom_objects
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists crm_custom_objects_update on public.crm_custom_objects;
create policy crm_custom_objects_update on public.crm_custom_objects
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

-- Feedback: users can submit/read own rows, admins can view/manage all.

drop policy if exists experience_feedback_select on public.experience_feedback_polls;
create policy experience_feedback_select on public.experience_feedback_polls
for select using (
  user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists experience_feedback_insert on public.experience_feedback_polls;
create policy experience_feedback_insert on public.experience_feedback_polls
for insert with check (
  user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists experience_feedback_update on public.experience_feedback_polls;
create policy experience_feedback_update on public.experience_feedback_polls
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

-- Session/heatmap events: user self-write, admin full read.

drop policy if exists experience_sessions_select on public.experience_session_records;
create policy experience_sessions_select on public.experience_session_records
for select using (public.is_admin_user(auth.uid()) or user_id = auth.uid());

drop policy if exists experience_sessions_insert on public.experience_session_records;
create policy experience_sessions_insert on public.experience_session_records
for insert with check (
  user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists experience_heatmap_select on public.experience_heatmap_events;
create policy experience_heatmap_select on public.experience_heatmap_events
for select using (public.is_admin_user(auth.uid()) or user_id = auth.uid());

drop policy if exists experience_heatmap_insert on public.experience_heatmap_events;
create policy experience_heatmap_insert on public.experience_heatmap_events
for insert with check (
  user_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

