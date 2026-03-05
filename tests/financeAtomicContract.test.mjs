import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('atomic finance payload includes modern family/income fields', () => {
  const source = read('services/dbService.ts');
  assert.match(source, /include_income_in_planning:/);
  assert.match(source, /pension:/);
  assert.match(source, /income_profiles:\s*\[/);
});

test('atomic finance SQL persists include_income_in_planning and pension columns', () => {
  const sql = read('supabase/migrations/20260307_finance_save_atomic.sql');
  assert.match(sql, /insert into public\.family_members[\s\S]*include_income_in_planning/);
  assert.match(sql, /insert into public\.family_members[\s\S]*pension/);
  assert.match(sql, /jsonb_to_recordset\(coalesce\(v_payload->'family_members'/);
  assert.match(sql, /include_income_in_planning boolean/);
  assert.match(sql, /pension numeric/);

  assert.match(sql, /insert into public\.income_profiles[\s\S]*pension/);
  assert.match(sql, /jsonb_to_recordset\(coalesce\(v_payload->'income_profiles'/);
});

