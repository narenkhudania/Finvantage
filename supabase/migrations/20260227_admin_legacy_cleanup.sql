-- One-time cleanup for legacy admin schema objects not used by FinVantage app runtime.
-- Safe to run before 20260227_admin_control_plane.sql

begin;

-- Legacy admin session + analytics + chain-audit tables (unused by current app/services)
drop table if exists public.admin_sessions cascade;
drop table if exists public.analytics_daily_snapshots cascade;
drop table if exists public.audit_logs cascade;

-- Legacy key-based feature_flags conflicts with new admin contract (id + flag_key)
drop table if exists public.feature_flags cascade;

commit;
