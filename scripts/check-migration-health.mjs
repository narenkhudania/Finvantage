import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

const root = process.cwd();
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const main = async () => {
  const { data, error } = await client.rpc('platform_migration_health_status');
  if (error) {
    console.error(`Migration health RPC failed: ${error.message || 'unknown error'}`);
    process.exit(1);
  }

  const payload = data && typeof data === 'object' ? data : {};
  const ok = Boolean(payload.ok);
  const checkedAt = payload.checked_at || new Date().toISOString();
  const missing = Array.isArray(payload.missing) ? payload.missing : [];

  console.log(`Migration health checked at: ${checkedAt}`);
  if (ok) {
    console.log('Status: OK');
    process.exit(0);
  }

  console.log('Status: MISSING OBJECTS');
  missing.forEach((item) => console.log(`- ${item}`));
  process.exit(3);
};

main().catch((err) => {
  console.error(`Migration health check failed: ${err?.message || String(err)}`);
  process.exit(1);
});

