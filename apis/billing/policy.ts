import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BILLING_POLICY, USAGE_POINT_EVENTS, PUBLIC_APP_BASE_URL } from './_config';
import { getUsagePointEvents } from './_helpers';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const createServiceClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  let usagePointEvents = { ...USAGE_POINT_EVENTS };
  try {
    const client = createServiceClient();
    if (client) {
      usagePointEvents = await getUsagePointEvents(client);
    }
  } catch {
    usagePointEvents = { ...USAGE_POINT_EVENTS };
  }

  res.status(200).json({
    data: {
      retryDays: [...BILLING_POLICY.retryDays],
      limitedAfterDays: BILLING_POLICY.limitedAfterDays,
      blockedAfterDays: BILLING_POLICY.blockedAfterDays,
      pointsMonthlyCap: BILLING_POLICY.pointsMonthlyCap,
      pointsExpiryMonths: BILLING_POLICY.pointsExpiryMonths,
      pointsToRupee: BILLING_POLICY.pointsToRupee,
      maxOverrideDays: BILLING_POLICY.maxOverrideDays,
      referralReward: BILLING_POLICY.referralPoints,
      referralMonthlyCap: BILLING_POLICY.referralMonthlyCap,
      usagePointEvents,
      appBaseUrl: PUBLIC_APP_BASE_URL,
      dashboardPaywall: BILLING_POLICY.dashboardPaywall,
      generatedAt: new Date().toISOString(),
    },
  });
}
