import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCheckoutModeRule } from '../lib/billingCheckout.mjs';

test('checkout mode is subscription-first for all paid plans with provider plan id', () => {
  assert.equal(
    resolveCheckoutModeRule({ amountInr: 199, providerPlanId: 'plan_abc' }),
    'razorpay_subscription'
  );
  assert.equal(
    resolveCheckoutModeRule({ amountInr: 289, providerPlanId: 'plan_def' }),
    'razorpay_subscription'
  );
});

test('checkout mode falls back to order only when provider plan id is missing', () => {
  assert.equal(
    resolveCheckoutModeRule({ amountInr: 199, providerPlanId: '' }),
    'razorpay_order'
  );
});

test('zero amount mode is returned for free/fully credited amount', () => {
  assert.equal(
    resolveCheckoutModeRule({ amountInr: 0, providerPlanId: 'plan_abc' }),
    'zero_amount'
  );
});

