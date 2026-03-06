import { createClient } from '@supabase/supabase-js';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const makeClient = () => {
  // Public plans endpoint can safely run with anon key fallback.
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseUrl || !key) {
    throw new Error(
      'Missing SUPABASE_URL/VITE_SUPABASE_URL and a Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY).'
    );
  }
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  let client;
  try {
    client = makeClient();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Server misconfiguration.' });
    return;
  }

  try {
    const { data, error } = await client
      .from('billing_plans')
      .select('plan_code,display_name,billing_months,amount_inr,tax_inclusive,auto_renew,sort_order,metadata,is_active,updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message || 'Could not load billing plans.');

    const rows = (data || []) as Array<Record<string, any>>;
    const lastUpdatedAt = rows.reduce<string | null>((latest, row) => {
      const updatedAt = row?.updated_at ? String(row.updated_at) : null;
      if (!updatedAt) return latest;
      if (!latest) return updatedAt;
      return new Date(updatedAt).getTime() > new Date(latest).getTime() ? updatedAt : latest;
    }, null);

    res.status(200).json({
      data: {
        plans: rows.map((row) => ({
          planCode: String(row.plan_code || ''),
          displayName: String(row.display_name || ''),
          billingMonths: Number(row.billing_months || 1),
          amountInr: Number(row.amount_inr || 0),
          taxInclusive: row.tax_inclusive !== false,
          autoRenew: row.auto_renew !== false,
          sortOrder: Number(row.sort_order || 0),
          metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata : {},
        })),
        lastUpdatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not load billing plans.' });
  }
}
