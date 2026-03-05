-- Subscription lifecycle columns for retry tracking and provider sync.

alter table if exists public.subscriptions
  add column if not exists last_payment_status text,
  add column if not exists next_retry_at timestamptz,
  add column if not exists provider_plan_id text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

create index if not exists subscriptions_next_retry_idx
  on public.subscriptions(next_retry_at)
  where next_retry_at is not null;

create index if not exists subscriptions_provider_customer_idx
  on public.subscriptions(provider_customer_id)
  where provider_customer_id is not null;

create index if not exists subscriptions_provider_plan_idx
  on public.subscriptions(provider_plan_id)
  where provider_plan_id is not null;
