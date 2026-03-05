-- Update FinVantage paid plan pricing.
-- Plan codes are intentionally unchanged to avoid breaking existing subscription references.

update public.billing_plans
set
  display_name = 'Starter Monthly',
  amount_inr = 199,
  billing_months = 1,
  tax_inclusive = true,
  auto_renew = true,
  is_active = true,
  sort_order = 10,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'pricing_version', '2026-03-04',
    'label', 'Monthly'
  ),
  updated_at = now()
where plan_code = 'starter_monthly_99';

update public.billing_plans
set
  display_name = 'Starter 3 Months',
  amount_inr = 249,
  billing_months = 3,
  tax_inclusive = true,
  auto_renew = true,
  is_active = true,
  sort_order = 20,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'pricing_version', '2026-03-04',
    'label', 'Quarterly'
  ),
  updated_at = now()
where plan_code = 'starter_quarterly_289';

update public.billing_plans
set
  display_name = 'Starter 6 Months',
  amount_inr = 299,
  billing_months = 6,
  tax_inclusive = true,
  auto_renew = true,
  is_active = true,
  sort_order = 30,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'pricing_version', '2026-03-04',
    'label', 'Half-Yearly'
  ),
  updated_at = now()
where plan_code = 'starter_half_yearly_499';

update public.billing_plans
set
  display_name = 'Starter 12 Months Yearly',
  amount_inr = 399,
  billing_months = 12,
  tax_inclusive = true,
  auto_renew = true,
  is_active = true,
  sort_order = 40,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'pricing_version', '2026-03-04',
    'label', 'Yearly'
  ),
  updated_at = now()
where plan_code = 'starter_annual_899';
