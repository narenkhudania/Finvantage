import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCouponDiscountRule,
  computeAccessStateRule,
  computeBonusDaysFromCreditValueRule,
  computeEffectiveDailyPlanValueInrRule,
  computeBonusDaysFromPointsRule,
  computePastDueDaysRule,
  computeRetryTimelineRule,
  isUpgradeAllowedRule,
} from '../lib/billingRules.mjs';

const policy = {
  limitedAfterDays: 5,
  blockedAfterDays: 10,
};

test('bonus days use effective daily plan value (99 points -> 30 days on monthly 99)', () => {
  const days = computeBonusDaysFromPointsRule(99, 99, 1);
  assert.equal(days, 30);
});

test('daily value conversion is prorated by billing duration and amount', () => {
  const monthlyDaily = computeEffectiveDailyPlanValueInrRule(99, 1);
  const halfYearDaily = computeEffectiveDailyPlanValueInrRule(499, 6);
  assert.equal(Number(monthlyDaily.toFixed(2)), 3.3);
  assert.equal(Number(halfYearDaily.toFixed(3)), 2.772);
});

test('credit conversion grants floored extension days', () => {
  assert.equal(computeBonusDaysFromCreditValueRule(98, 99, 1), 29);
  assert.equal(computeBonusDaysFromCreditValueRule(198, 499, 6), 71);
});

test('points conversion supports full balance, not fixed 99 blocks only', () => {
  assert.equal(computeBonusDaysFromPointsRule(98, 99, 1), 29);
  assert.equal(computeBonusDaysFromPointsRule(198, 499, 6), 71);
});

test('access is active for valid trialing subscription', () => {
  const now = Date.now();
  const subscription = {
    status: 'trialing',
    start_at: new Date(now - 60_000).toISOString(),
    end_at: new Date(now + 60_000).toISOString(),
  };
  const access = computeAccessStateRule(subscription, null, policy, now);
  assert.equal(access.accessState, 'active');
  assert.equal(access.reason, 'trial_active');
});

test('legacy free subscriptions are blocked for dashboard access', () => {
  const now = Date.now();
  const subscription = {
    plan_code: 'starter',
    status: 'active',
    start_at: new Date(now - 60_000).toISOString(),
    end_at: new Date(now + 60_000).toISOString(),
  };
  const access = computeAccessStateRule(subscription, null, policy, now);
  assert.equal(access.accessState, 'blocked');
  assert.equal(access.reason, 'legacy_free_plan_removed');
});

test('past due transitions to limited then blocked', () => {
  const now = Date.now();
  const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
  const twelveDaysAgo = new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString();
  const limited = computeAccessStateRule({ status: 'past_due', past_due_since: sixDaysAgo }, null, policy, now);
  const blocked = computeAccessStateRule({ status: 'past_due', past_due_since: twelveDaysAgo }, null, policy, now);
  assert.equal(limited.accessState, 'limited');
  assert.equal(blocked.accessState, 'blocked');
});

test('past due days are computed from marker date', () => {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const days = computePastDueDaysRule({ status: 'past_due', past_due_since: sevenDaysAgo }, now);
  assert.equal(days, 7);
});

test('retry timeline uses configured retry days', () => {
  const now = Date.now();
  const base = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const retries = computeRetryTimelineRule(
    { status: 'past_due', past_due_since: base },
    [1, 3, 5],
    (iso, day) => {
      const date = new Date(iso);
      date.setDate(date.getDate() + day);
      return date.toISOString();
    },
    now
  );
  assert.equal(retries.length, 3);
  assert.equal(retries[0].day, 1);
  assert.equal(typeof retries[0].elapsed, 'boolean');
});

test('coupon discount supports percentage and cap', () => {
  const discount = calculateCouponDiscountRule(499, {
    discount_type: 'percentage',
    discount_value: 50,
    max_discount_amount: 100,
  });
  assert.equal(discount, 100);
});

test('coupon discount supports full 100 percent', () => {
  const discount = calculateCouponDiscountRule(289, {
    discount_type: 'percentage',
    discount_value: 100,
  });
  assert.equal(discount, 289);
});

test('upgrade-only rule blocks lower monthly equivalent', () => {
  const allowed = isUpgradeAllowedRule({
    currentAmount: 99,
    currentMonths: 1,
    targetAmount: 289,
    targetMonths: 3,
    currentIsPaid: true,
  });
  assert.equal(allowed, false);
});

test('upgrade-only rule allows equal/higher monthly equivalent', () => {
  const allowed = isUpgradeAllowedRule({
    currentAmount: 289,
    currentMonths: 3,
    targetAmount: 99,
    targetMonths: 1,
    currentIsPaid: true,
  });
  assert.equal(allowed, true);
});
