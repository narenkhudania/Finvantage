-- Blog CMS + SEO metadata + usage reporting RPC
-- Adds public blog surfaces and admin reporting for customer behavior analytics.

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------
-- Blog content tables
-- -------------------------------------------------------------------

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  scheduled_for timestamptz,
  author_user_id uuid references auth.users(id) on delete set null,
  target_keyword text,
  secondary_keywords text[] not null default '{}',
  tags text[] not null default '{}',
  meta_title text,
  meta_description text,
  canonical_url text,
  og_image_url text,
  cta_text text,
  cta_url text,
  internal_link_targets text[] not null default '{}',
  external_references text[] not null default '{}',
  schema_type text not null default 'Article',
  faq_schema jsonb not null default '[]'::jsonb,
  promotion_checklist jsonb not null default '{}'::jsonb,
  organic_score integer not null default 0,
  word_count integer not null default 0,
  estimated_read_minutes integer not null default 3,
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_post_categories (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  category_id uuid not null references public.blog_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, category_id)
);

create table if not exists public.blog_post_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  snapshot_date date not null default current_date,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric not null default 0,
  avg_position numeric not null default 0,
  organic_sessions integer not null default 0,
  avg_engagement_seconds numeric not null default 0,
  leads integer not null default 0,
  created_at timestamptz not null default now(),
  unique(post_id, snapshot_date)
);

create index if not exists blog_posts_status_published_idx on public.blog_posts(status, published_at desc);
create index if not exists blog_posts_slug_idx on public.blog_posts(slug);
create index if not exists blog_posts_updated_idx on public.blog_posts(updated_at desc);
create index if not exists blog_posts_keyword_idx on public.blog_posts(target_keyword);
create index if not exists blog_posts_tags_gin_idx on public.blog_posts using gin(tags);
create index if not exists blog_posts_secondary_keywords_gin_idx on public.blog_posts using gin(secondary_keywords);

create index if not exists blog_categories_slug_idx on public.blog_categories(slug);

create index if not exists blog_performance_post_date_idx
  on public.blog_post_performance_snapshots(post_id, snapshot_date desc);
create index if not exists blog_performance_date_idx
  on public.blog_post_performance_snapshots(snapshot_date desc);

-- Safe only if helper exists from base schema migration.
drop trigger if exists set_blog_categories_updated_at on public.blog_categories;
create trigger set_blog_categories_updated_at
before update on public.blog_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at
before update on public.blog_posts
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- Usage report RPC (admin)
-- -------------------------------------------------------------------

create or replace function public.admin_usage_report(
  p_days integer default 30,
  p_limit integer default 25,
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
  cfg as (
    select
      greatest(7, least(coalesce(p_days, 30), 365))::int as days,
      greatest(10, least(coalesce(p_limit, 25), 200))::int as lim
  ),
  bounds as (
    select now() - ((select days from cfg) || ' days')::interval as start_time
  ),
  events as (
    select e.user_id, e.event_name, e.source, e.metadata, e.event_time
    from public.activity_events e
    where e.event_time >= (select start_time from bounds)
  ),
  day_series as (
    select generate_series(
      date_trunc('day', now()) - ((select days from cfg) - 1) * interval '1 day',
      date_trunc('day', now()),
      interval '1 day'
    )::date as day
  ),
  daily as (
    select
      ds.day,
      coalesce(count(e.*), 0)::int as events,
      coalesce(count(distinct e.user_id), 0)::int as users
    from day_series ds
    left join events e
      on date_trunc('day', e.event_time)::date = ds.day
    group by ds.day
    order by ds.day
  ),
  top_events as (
    select
      e.event_name,
      count(*)::int as events,
      count(distinct e.user_id)::int as users,
      max(e.event_time) as last_seen_at
    from events e
    group by e.event_name
    order by events desc, users desc, e.event_name
    limit (select lim from cfg)
  ),
  module_usage as (
    select
      coalesce(nullif(e.metadata->>'view', ''), 'unknown') as module,
      count(*)::int as opens,
      count(distinct e.user_id)::int as users
    from events e
    where e.event_name = 'app.view_opened'
    group by 1
    order by opens desc, users desc
    limit (select lim from cfg)
  ),
  power_users as (
    select
      e.user_id,
      coalesce(p.identifier, e.user_id::text) as email,
      trim(concat_ws(' ', p.first_name, p.last_name)) as name,
      count(*)::int as events,
      max(e.event_time) as last_event_at,
      (
        select e2.event_name
        from events e2
        where e2.user_id = e.user_id
        group by e2.event_name
        order by count(*) desc, e2.event_name
        limit 1
      ) as top_event
    from events e
    left join public.profiles p on p.id = e.user_id
    where e.user_id is not null
    group by e.user_id, p.identifier, p.first_name, p.last_name
    order by events desc, last_event_at desc
    limit (select lim from cfg)
  ),
  recent_events as (
    select
      e.event_time,
      e.user_id,
      coalesce(p.identifier, e.user_id::text) as email,
      e.event_name,
      e.source,
      e.metadata
    from events e
    left join public.profiles p on p.id = e.user_id
    order by e.event_time desc
    limit ((select lim from cfg) * 6)
  ),
  funnel as (
    select 'Onboarding Complete'::text as step, count(distinct user_id)::int as users
    from events where event_name = 'app.onboarding_completed'
    union all
    select 'Goal Created', count(distinct user_id)::int
    from events where event_name = 'goal.created'
    union all
    select 'Asset Added', count(distinct user_id)::int
    from events where event_name = 'asset.added'
    union all
    select 'Liability Added', count(distinct user_id)::int
    from events where event_name = 'liability.added'
    union all
    select 'Risk Profile Completed', count(distinct user_id)::int
    from events where event_name = 'risk.profile_completed'
  ),
  per_user_avg as (
    select coalesce(avg(user_counts.events), 0)::numeric as avg_events_per_user
    from (
      select user_id, count(*)::int as events
      from events
      where user_id is not null
      group by user_id
    ) user_counts
  ),
  totals as (
    select
      count(*)::int as total_events,
      count(distinct user_id)::int as unique_users,
      count(*) filter (where event_name = 'app.view_opened')::int as view_opens,
      count(*) filter (where event_name = 'goal.created')::int as goal_creates,
      count(*) filter (where event_name = 'asset.added')::int as asset_adds,
      count(*) filter (where event_name = 'liability.added')::int as liability_adds,
      count(*) filter (where event_name = 'risk.profile_completed')::int as risk_profiles_completed
    from events
  )
  select jsonb_build_object(
    'days', (select days from cfg),
    'generatedAt', now(),
    'totals', jsonb_build_object(
      'totalEvents', coalesce((select total_events from totals), 0),
      'uniqueUsers', coalesce((select unique_users from totals), 0),
      'avgEventsPerUser', coalesce((select avg_events_per_user from per_user_avg), 0),
      'viewOpens', coalesce((select view_opens from totals), 0),
      'goalCreates', coalesce((select goal_creates from totals), 0),
      'assetAdds', coalesce((select asset_adds from totals), 0),
      'liabilityAdds', coalesce((select liability_adds from totals), 0),
      'riskProfilesCompleted', coalesce((select risk_profiles_completed from totals), 0)
    ),
    'trends', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', day,
            'events', events,
            'users', users
          )
          order by day
        )
        from daily
      ),
      '[]'::jsonb
    ),
    'topEvents', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'eventName', event_name,
            'events', events,
            'users', users,
            'lastSeenAt', last_seen_at
          )
          order by events desc, users desc
        )
        from top_events
      ),
      '[]'::jsonb
    ),
    'moduleUsage', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'module', module,
            'opens', opens,
            'users', users,
            'avgPerUser', case when users > 0 then round((opens::numeric / users::numeric), 2) else 0 end
          )
          order by opens desc, users desc
        )
        from module_usage
      ),
      '[]'::jsonb
    ),
    'powerUsers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'userId', user_id,
            'email', email,
            'name', nullif(name, ''),
            'events', events,
            'lastEventAt', last_event_at,
            'topEvent', top_event
          )
          order by events desc, last_event_at desc
        )
        from power_users
      ),
      '[]'::jsonb
    ),
    'funnel', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'step', step,
            'users', users
          )
          order by users desc
        )
        from funnel
      ),
      '[]'::jsonb
    ),
    'recentActivity', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'eventTime', event_time,
            'userId', user_id,
            'email', email,
            'eventName', event_name,
            'source', source,
            'metadata', metadata
          )
          order by event_time desc
        )
        from recent_events
      ),
      '[]'::jsonb
    )
  )
  from guard;
$$;

grant execute on function public.admin_usage_report(integer, integer, uuid) to authenticated;

-- -------------------------------------------------------------------
-- RLS for blog tables
-- -------------------------------------------------------------------

alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_categories enable row level security;
alter table public.blog_post_performance_snapshots enable row level security;

-- Public read for published posts.
drop policy if exists blog_posts_public_select on public.blog_posts;
create policy blog_posts_public_select on public.blog_posts
for select using (
  status = 'published'
  and coalesce(published_at, created_at) <= now()
);

-- Admin full access on blog posts and categories.
drop policy if exists blog_posts_admin_select on public.blog_posts;
create policy blog_posts_admin_select on public.blog_posts
for select using (public.is_admin_user(auth.uid()));

drop policy if exists blog_posts_admin_insert on public.blog_posts;
create policy blog_posts_admin_insert on public.blog_posts
for insert with check (public.is_admin_user(auth.uid()));

drop policy if exists blog_posts_admin_update on public.blog_posts;
create policy blog_posts_admin_update on public.blog_posts
for update using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists blog_posts_admin_delete on public.blog_posts;
create policy blog_posts_admin_delete on public.blog_posts
for delete using (public.is_admin_user(auth.uid()));

drop policy if exists blog_categories_public_select on public.blog_categories;
create policy blog_categories_public_select on public.blog_categories
for select using (true);

drop policy if exists blog_categories_admin_write on public.blog_categories;
create policy blog_categories_admin_write on public.blog_categories
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists blog_post_categories_public_select on public.blog_post_categories;
create policy blog_post_categories_public_select on public.blog_post_categories
for select using (true);

drop policy if exists blog_post_categories_admin_write on public.blog_post_categories;
create policy blog_post_categories_admin_write on public.blog_post_categories
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists blog_perf_admin_select on public.blog_post_performance_snapshots;
create policy blog_perf_admin_select on public.blog_post_performance_snapshots
for select using (public.is_admin_user(auth.uid()));

drop policy if exists blog_perf_admin_write on public.blog_post_performance_snapshots;
create policy blog_perf_admin_write on public.blog_post_performance_snapshots
for all using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));
