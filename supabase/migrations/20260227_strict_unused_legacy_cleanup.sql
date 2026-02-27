-- STRICT LEGACY CLEANUP (destructive)
-- Purpose: remove legacy tables from the pasted schema that are not used by
-- current FinVantage app code or the new /admin control-plane modules.
--
-- Safe target tables to drop:
--   - public.admin_sessions
--   - public.analytics_daily_snapshots
--   - public.audit_logs
--   - public.dpdp_data_requests
--   - public.subscription_plans
--   - public.user_subscriptions
--
-- Notes:
-- 1) DROP ... CASCADE is intentional to remove stale foreign keys referencing
--    subscription_plans/user_subscriptions from legacy schema.
-- 2) This does NOT drop active runtime tables (profiles, goals, assets, loans,
--    payments, transactions, risk_profiles, etc.).

begin;

-- Optional visibility: dynamic row counts only for existing tables.
do $$
declare
  v_row_count bigint;
begin
  if to_regclass('public.admin_sessions') is not null then
    execute 'select count(*) from public.admin_sessions' into v_row_count;
    raise notice 'strict cleanup: public.admin_sessions rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.admin_sessions not found';
  end if;

  if to_regclass('public.analytics_daily_snapshots') is not null then
    execute 'select count(*) from public.analytics_daily_snapshots' into v_row_count;
    raise notice 'strict cleanup: public.analytics_daily_snapshots rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.analytics_daily_snapshots not found';
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'select count(*) from public.audit_logs' into v_row_count;
    raise notice 'strict cleanup: public.audit_logs rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.audit_logs not found';
  end if;

  if to_regclass('public.dpdp_data_requests') is not null then
    execute 'select count(*) from public.dpdp_data_requests' into v_row_count;
    raise notice 'strict cleanup: public.dpdp_data_requests rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.dpdp_data_requests not found';
  end if;

  if to_regclass('public.subscription_plans') is not null then
    execute 'select count(*) from public.subscription_plans' into v_row_count;
    raise notice 'strict cleanup: public.subscription_plans rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.subscription_plans not found';
  end if;

  if to_regclass('public.user_subscriptions') is not null then
    execute 'select count(*) from public.user_subscriptions' into v_row_count;
    raise notice 'strict cleanup: public.user_subscriptions rows = %', v_row_count;
  else
    raise notice 'strict cleanup: public.user_subscriptions not found';
  end if;
end
$$;

-- Legacy admin/session analytics objects
drop table if exists public.admin_sessions cascade;
drop table if exists public.analytics_daily_snapshots cascade;
drop table if exists public.audit_logs cascade;
drop sequence if exists public.audit_logs_sequence_num_seq cascade;

-- Legacy compliance request table (not wired in current product flows)
drop table if exists public.dpdp_data_requests cascade;

-- Legacy subscription catalogue model (replaced by public.subscriptions in new admin control-plane)
drop table if exists public.subscription_plans cascade;
drop table if exists public.user_subscriptions cascade;

commit;
