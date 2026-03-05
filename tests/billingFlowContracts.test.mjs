import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('verify-payment uses transactional finalization RPC', () => {
  const source = read('api/billing/verify-payment.ts');
  assert.match(source, /rpc\('billing_finalize_payment'/);
});

test('webhook uses timingSafeEqual and dead-letter capture', () => {
  const source = read('api/billing/webhook.ts');
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /billing_dead_letter_events/);
});

test('ai-advice endpoint enforces billing paywall gate', () => {
  const source = read('api/ai-advice.ts');
  assert.match(source, /BILLING_PAYWALL_REQUIRED/);
  assert.match(source, /resolveAdvisorBillingAccess/);
});

