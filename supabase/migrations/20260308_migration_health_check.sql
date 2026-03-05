begin;

create or replace function public.platform_migration_health_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.billing_plans') is null then
    missing := array_append(missing, 'table:public.billing_plans');
  end if;
  if to_regclass('public.subscriptions') is null then
    missing := array_append(missing, 'table:public.subscriptions');
  end if;
  if to_regclass('public.payments') is null then
    missing := array_append(missing, 'table:public.payments');
  end if;
  if to_regclass('public.reward_points_ledger') is null then
    missing := array_append(missing, 'table:public.reward_points_ledger');
  end if;
  if to_regclass('public.subscription_coupon_redemptions') is null then
    missing := array_append(missing, 'table:public.subscription_coupon_redemptions');
  end if;
  if to_regclass('public.billing_dead_letter_events') is null then
    missing := array_append(missing, 'table:public.billing_dead_letter_events');
  end if;
  if to_regclass('public.billing_error_events') is null then
    missing := array_append(missing, 'table:public.billing_error_events');
  end if;
  if to_regprocedure('public.save_finance_data_atomic(uuid,jsonb)') is null then
    missing := array_append(missing, 'function:public.save_finance_data_atomic(uuid,jsonb)');
  end if;
  if to_regprocedure('public.billing_finalize_payment(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,jsonb)') is null then
    missing := array_append(missing, 'function:public.billing_finalize_payment(...)');
  end if;
  if to_regprocedure('public.billing_award_points_client_v2(text,text,jsonb,integer,integer,uuid)') is null then
    missing := array_append(missing, 'function:public.billing_award_points_client_v2(...)');
  end if;
  if to_regprocedure('public.billing_reserve_coupon_for_payment(uuid,text,text,uuid,numeric)') is null then
    missing := array_append(missing, 'function:public.billing_reserve_coupon_for_payment(...)');
  end if;

  return jsonb_build_object(
    'ok', coalesce(array_length(missing, 1), 0) = 0,
    'missing', missing,
    'checked_at', now()
  );
end;
$$;

grant execute on function public.platform_migration_health_status() to authenticated;
grant execute on function public.platform_migration_health_status() to service_role;

commit;

