export const BILLING_POLICY = {
  retryDays: [1, 3, 5],
  limitedAfterDays: 5,
  blockedAfterDays: 10,
  trialDays: 30,
  pointsMonthlyCap: 1000,
  pointsExpiryMonths: 12,
  pointsToRupee: 1,
  dashboardPaywall: true,
  maxOverrideDays: 365,
  pointsFormulaBase: {
    monthlyPrice: 99,
    days: 30,
  },
  referralPoints: {
    referrer: Number(process.env.BILLING_REFERRAL_POINTS_REFERRER || 25),
    referred: Number(process.env.BILLING_REFERRAL_POINTS_REFERRED || 50),
  },
  referralMonthlyCap: 100,
  communicationChannels: ['email', 'mobile', 'in_app'] as const,
  supportedCurrencyFallback: 'INR',
} as const;

export const PLAN_MONTHS: Record<string, number> = {
  starter_monthly_99: 1,
  starter_quarterly_289: 3,
  starter_half_yearly_499: 6,
  starter_annual_899: 12,
  trial_migrated: 1,
};

export const USAGE_POINT_EVENTS: Record<string, number> = {
  daily_login: 10,
  profile_completion: 20,
  risk_profile_completed: 10,
  goal_added: 20,
  report_generated: 10,
  subscription_payment_success: 30,
};

export const USAGE_POINT_EVENT_TYPES = Object.freeze(Object.keys(USAGE_POINT_EVENTS));

export const PUBLIC_TEST_WEBHOOK_BASE =
  process.env.WEBHOOK_BASE_URL ||
  process.env.BILLING_WEBHOOK_BASE_URL ||
  process.env.APP_BASE_URL ||
  'https://finvantage.vercel.app';

export const PUBLIC_APP_BASE_URL = process.env.APP_BASE_URL || 'https://finvantage.vercel.app';
