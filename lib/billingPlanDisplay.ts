export interface BillingPlanDisplayShape {
  planCode?: string;
  displayName?: string;
  billingMonths?: number;
  amountInr?: number;
  metadata?: Record<string, unknown> | null;
}

type PlanBadgeVariant = 'landing' | 'pricing';

const asMetadata = (plan: BillingPlanDisplayShape): Record<string, unknown> => {
  if (plan.metadata && typeof plan.metadata === 'object') {
    return plan.metadata as Record<string, unknown>;
  }
  return {};
};

export const getBillingPlanMonths = (plan: BillingPlanDisplayShape) =>
  Math.max(1, Number(plan.billingMonths || 1));

export const getBillingPlanAmountInr = (plan: BillingPlanDisplayShape) =>
  Number(plan.amountInr || 0);

export const getBillingPlanFallbackName = (months: number) => {
  if (months === 1) return 'Monthly';
  if (months === 3) return '3 Months';
  if (months === 6) return '6 Months';
  if (months === 12) return '12 Months';
  return `${months} Months`;
};

export const getBillingPlanCycleLabel = (months: number) =>
  months === 1 ? 'per month' : 'auto-renew';

export const getBillingPlanBadge = (
  plan: BillingPlanDisplayShape,
  variant: PlanBadgeVariant = 'pricing',
) => {
  const customBadge = String(asMetadata(plan).badge || '').trim();
  if (customBadge) return customBadge;
  const months = getBillingPlanMonths(plan);
  if (variant === 'landing') {
    if (months === 12) return 'Best Value';
    if (months === 6) return 'Most Chosen';
    if (months === 3) return 'Quarterly';
    return 'Starter';
  }
  if (months === 12) return 'Best Value';
  if (months === 6) return 'Popular';
  if (months === 3) return 'Saver';
  return 'Monthly';
};

export const readConfiguredBillingPlanDiscountPct = (
  plan: BillingPlanDisplayShape,
): number | null => {
  const raw = Number(asMetadata(plan).discount_pct);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, raw));
};

export const computeBillingPlanDiscountPct = (
  plan: BillingPlanDisplayShape,
  monthlyPlanAmount: number,
) => {
  const configured = readConfiguredBillingPlanDiscountPct(plan);
  if (configured != null) return configured;
  const months = getBillingPlanMonths(plan);
  const amountInr = getBillingPlanAmountInr(plan);
  const listPrice = Number(monthlyPlanAmount || 0) * months;
  if (listPrice <= 0) return 0;
  const savingsVsMonthly = Math.max(0, listPrice - amountInr);
  return (savingsVsMonthly / listPrice) * 100;
};

export const getBillingPlanFeatureBullets = (months: number) => {
  if (months === 1) {
    return ['Full App Access', 'AI Planning Assistant', 'Risk Profile Analysis'];
  }
  if (months === 3) {
    return ['Everything in Monthly', 'Priority Goal Planning', 'Tax Planning Review'];
  }
  if (months === 6) {
    return ['Everything in Quarterly', 'Multi-Earner Planning', 'Custom Wealth Report'];
  }
  if (months === 12) {
    return ['Everything in 6 Months', 'Advanced Projections', 'Long-Term Data History'];
  }
  return ['Full App Access', 'Goal Planning Toolkit', 'Priority Support'];
};

export const getBillingPlanPricingSnapshot = (
  plan: BillingPlanDisplayShape,
  monthlyPlanAmount: number,
) => {
  const months = getBillingPlanMonths(plan);
  const amountInr = getBillingPlanAmountInr(plan);
  const effectivePerMonth = amountInr / months;
  const savingsVsMonthly = Math.max(
    0,
    Number(monthlyPlanAmount || 0) * months - amountInr,
  );
  return {
    months,
    amountInr,
    effectivePerMonth,
    savingsVsMonthly,
    discountPct: computeBillingPlanDiscountPct(plan, monthlyPlanAmount),
  };
};

