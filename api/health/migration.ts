import { createClient } from '@supabase/supabase-js';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({
      ok: false,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    });
    return;
  }

  try {
    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc('platform_migration_health_status');
    if (error) {
      res.status(500).json({
        ok: false,
        error: error.message || 'Migration health RPC failed.',
      });
      return;
    }

    const payload = data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

    const healthy = Boolean(payload.ok);
    res.status(healthy ? 200 : 503).json({
      ok: healthy,
      missing: Array.isArray(payload.missing) ? payload.missing : [],
      checkedAt: payload.checked_at || new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: (err as Error).message || 'Migration health check failed.',
    });
  }
}

