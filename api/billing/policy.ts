import { BILLING_POLICY, USAGE_POINT_EVENTS, PUBLIC_APP_BASE_URL } from './_config';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
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
      usagePointEvents: USAGE_POINT_EVENTS,
      appBaseUrl: PUBLIC_APP_BASE_URL,
      dashboardPaywall: BILLING_POLICY.dashboardPaywall,
      generatedAt: new Date().toISOString(),
    },
  });
}

