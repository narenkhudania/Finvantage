import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('migration health endpoint is present', () => {
  const source = read('api/health/migration.ts');
  assert.match(source, /platform_migration_health_status/);
});

test('migration health SQL checks required billing and finance objects', () => {
  const sql = read('supabase/migrations/20260308_migration_health_check.sql');
  assert.match(sql, /public\.billing_plans/);
  assert.match(sql, /public\.save_finance_data_atomic/);
  assert.match(sql, /public\.billing_finalize_payment/);
});

