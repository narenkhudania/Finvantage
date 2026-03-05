const DEFAULT_BILLING_DAYS_PER_MONTH = 30;

export const computeEffectiveDailyPlanValueInrRule = (
  amountInr,
  billingMonths,
  daysPerMonth = DEFAULT_BILLING_DAYS_PER_MONTH
) => {
  const totalAmount = Math.max(0, Number(amountInr) || 0);
  const months = Math.max(1, Number(billingMonths) || 1);
  const days = Math.max(1, Number(daysPerMonth) || DEFAULT_BILLING_DAYS_PER_MONTH);
  return totalAmount / (months * days);
};

export const computeBonusDaysFromCreditValueRule = (
  creditValueInr,
  amountInr,
  billingMonths
) => {
  const credit = Math.max(0, Number(creditValueInr) || 0);
  if (credit <= 0) return 0;
  const dailyValue = computeEffectiveDailyPlanValueInrRule(amountInr, billingMonths);
  if (!Number.isFinite(dailyValue) || dailyValue <= 0) return 0;
  return Math.max(0, Math.floor(credit / dailyValue));
};

export const computeBonusDaysFromPointsRule = (
  points,
  amountInr,
  billingMonths,
  pointsToInr = 1
) => {
  const safePoints = Math.max(0, Number(points) || 0);
  const conversion = Math.max(0, Number(pointsToInr) || 0);
  if (safePoints <= 0 || conversion <= 0) return 0;
  const creditValue = safePoints * conversion;
  return computeBonusDaysFromCreditValueRule(creditValue, amountInr, billingMonths);
};

export const computeAccessStateRule = (subscription, overrideUntil, policy, nowMs = Date.now()) => {
  if (overrideUntil && new Date(overrideUntil).getTime() > nowMs) {
    return { accessState: 'active', reason: 'admin_override' };
  }

  if (!subscription) return { accessState: 'blocked', reason: 'no_subscription' };

  const status = String(subscription.status || '').toLowerCase();
  const planCode = String(subscription.plan_code || subscription.planCode || '').toLowerCase();
  const isLegacyFreePlan =
    planCode === 'free' ||
    planCode === 'starter' ||
    planCode === 'starter_free' ||
    planCode.startsWith('free_');
  if (isLegacyFreePlan) {
    return { accessState: 'blocked', reason: 'legacy_free_plan_removed' };
  }
  const startAt = subscription.start_at ? new Date(subscription.start_at).getTime() : null;
  const endAt = subscription.end_at ? new Date(subscription.end_at).getTime() : null;
  const pastDueSince = subscription.past_due_since ? new Date(subscription.past_due_since).getTime() : null;

  if ((status === 'active' || status === 'trialing') && (!startAt || startAt <= nowMs) && (!endAt || endAt > nowMs)) {
    return { accessState: 'active', reason: status === 'trialing' ? 'trial_active' : 'subscription_active' };
  }

  if (status === 'past_due') {
    const marker = pastDueSince || endAt || nowMs;
    const days = Math.max(0, Math.floor((nowMs - marker) / (24 * 60 * 60 * 1000)));
    if (days > policy.blockedAfterDays) return { accessState: 'blocked', reason: 'past_due_blocked' };
    if (days > policy.limitedAfterDays) return { accessState: 'limited', reason: 'past_due_limited' };
    return { accessState: 'active', reason: 'past_due_retry_window' };
  }

  return { accessState: 'blocked', reason: status || 'expired' };
};

export const computePastDueDaysRule = (subscription, nowMs = Date.now()) => {
  if (!subscription) return 0;
  const status = String(subscription.status || '').toLowerCase();
  if (status !== 'past_due') return 0;
  const endAt = subscription.end_at ? new Date(subscription.end_at).getTime() : null;
  const pastDueSince = subscription.past_due_since ? new Date(subscription.past_due_since).getTime() : null;
  const marker = pastDueSince || endAt;
  if (!marker) return 0;
  return Math.max(0, Math.floor((nowMs - marker) / (24 * 60 * 60 * 1000)));
};

export const computeRetryTimelineRule = (subscription, retryDays, addDaysFn, nowMs = Date.now()) => {
  if (!subscription) return [];
  const status = String(subscription.status || '').toLowerCase();
  if (status !== 'past_due') return [];
  const baseIso = String(subscription.past_due_since || subscription.end_at || new Date(nowMs).toISOString());
  return retryDays.map((day) => {
    const scheduledAt = addDaysFn(baseIso, day);
    return {
      day,
      scheduledAt,
      elapsed: new Date(scheduledAt).getTime() <= nowMs,
    };
  });
};

export const calculateCouponDiscountRule = (amount, coupon) => {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const discountType = String(coupon?.discount_type || '').toLowerCase();
  const discountValue = Math.max(0, Number(coupon?.discount_value) || 0);
  let discount = 0;

  if (discountType === 'flat') {
    discount = discountValue;
  } else {
    discount = safeAmount * (discountValue / 100);
  }

  if (coupon?.max_discount_amount != null) {
    discount = Math.min(discount, Math.max(0, Number(coupon.max_discount_amount) || 0));
  }

  return Math.max(0, Math.min(safeAmount, Math.round(discount * 100) / 100));
};

export const isUpgradeAllowedRule = ({
  currentAmount,
  currentMonths,
  targetAmount,
  targetMonths,
  currentIsPaid,
}) => {
  if (!currentIsPaid) return true;
  const currentMonthly = (Number(currentAmount) || 0) / Math.max(1, Number(currentMonths) || 1);
  const targetMonthly = (Number(targetAmount) || 0) / Math.max(1, Number(targetMonths) || 1);
  return targetMonthly >= currentMonthly;
};
