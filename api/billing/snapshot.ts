import { withBillingAuth } from './_auth';
import crypto from 'node:crypto';
import {
  activateMigrationTrialIfEligible,
  computePastDueDays,
  computeRetryTimeline,
  computeAccessState,
  ensureBillingProfile,
  getActiveOverrideUntil,
  getActivePlans,
  getAvailablePoints,
  getLatestSubscription,
  nowIso,
} from './_helpers';
import { BILLING_POLICY, PUBLIC_APP_BASE_URL, PUBLIC_TEST_WEBHOOK_BASE, USAGE_POINT_EVENTS } from './_config';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const resolveLifecycleState = (
  trialActive: boolean,
  subscription: Record<string, any> | null,
  accessState: 'active' | 'limited' | 'blocked',
  pastDueDays: number
): 'trial' | 'active' | 'payment_failed' | 'limited_access' | 'cancelled' | 'expired' => {
  if (trialActive) return 'trial';
  const status = String(subscription?.status || '').toLowerCase();
  if (accessState === 'limited') return 'limited_access';
  if (status === 'past_due' && pastDueDays >= 0 && accessState === 'active') return 'payment_failed';
  if (status === 'cancelled' || status === 'completed') return 'cancelled';
  if (status === 'active') return 'active';
  if (accessState === 'blocked') return 'expired';
  return 'active';
};

const POINTS_EVENT_ORDER = [
  'daily_login',
  'profile_completion',
  'risk_profile_completed',
  'goal_added',
  'report_generated',
  'subscription_payment_success',
] as const;

const entitlementSigningKey =
  process.env.BILLING_ENTITLEMENT_SIGNING_KEY ||
  process.env.RAZORPAY_WEBHOOK_SECRET ||
  '';

const signEntitlement = (params: {
  userId: string;
  now: string;
  accessState: string;
  subscriptionId: string | null;
  subscriptionEndAt: string | null;
}) => {
  if (!entitlementSigningKey) return null;
  const base = [
    params.userId,
    params.now,
    params.accessState,
    params.subscriptionId || '',
    params.subscriptionEndAt || '',
  ].join('|');
  return crypto
    .createHmac('sha256', entitlementSigningKey)
    .update(base)
    .digest('hex');
};

const isRecoverableSnapshotError = (error: unknown) => {
  const text = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    text.includes('relation') ||
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    text.includes('permission denied') ||
    text.includes('forbidden') ||
    text.includes('billing_referral_signal_salt') ||
    text.includes('missing')
  );
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  try {
    const [{ data: profileRow }, seededProfile, plans, subscription, pointsBalance, overrideUntil, pointsEarnedRes] = await Promise.all([
      ctx.client
        .from('profiles')
        .select('country')
        .eq('id', ctx.user.id)
        .maybeSingle(),
      ensureBillingProfile(ctx.client, ctx.user.id),
      getActivePlans(ctx.client),
      getLatestSubscription(ctx.client, ctx.user.id),
      getAvailablePoints(ctx.client, ctx.user.id),
      getActiveOverrideUntil(ctx.client, ctx.user.id),
      ctx.client
        .from('reward_points_ledger')
        .select('event_type,points')
        .eq('user_id', ctx.user.id)
        .in('event_type', POINTS_EVENT_ORDER as unknown as string[])
        .gt('points', 0),
    ]);

    if (pointsEarnedRes.error) {
      throw new Error(pointsEarnedRes.error.message || 'Could not load points earned summary.');
    }

    const earnedPointsByEvent = (pointsEarnedRes.data || []).reduce<Record<string, number>>((acc, row: any) => {
      const key = String(row.event_type || '');
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(row.points || 0);
      return acc;
    }, {});

    const earnedEvents = POINTS_EVENT_ORDER.map((eventType) => {
      const pointsPerEvent = Number(USAGE_POINT_EVENTS[eventType] || 0);
      const earnedPoints = Number(earnedPointsByEvent[eventType] || 0);
      const completionCount = pointsPerEvent > 0
        ? Math.floor(earnedPoints / pointsPerEvent)
        : 0;
      return {
        eventType,
        pointsPerEvent,
        earnedPoints,
        completionCount,
        completed: earnedPoints > 0,
      };
    });

    const profile = await activateMigrationTrialIfEligible(
      ctx.client,
      seededProfile,
      BILLING_POLICY.trialDays
    );

    const country = String(profileRow?.country || profile?.country || 'India');
    const baseAccess = computeAccessState(subscription, overrideUntil);
    const trialEnd = profile?.trial_end_at ? String(profile.trial_end_at) : null;
    const trialStart = profile?.trial_started_at ? String(profile.trial_started_at) : null;
    const trialActive = Boolean(trialEnd && new Date(trialEnd).getTime() > Date.now() && !profile?.trial_consumed);
    const trialDaysLeft = trialEnd
      ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;
    const access = trialActive && baseAccess.accessState === 'blocked'
      ? { accessState: 'active' as const, reason: 'trial_profile_active' }
      : baseAccess;
    const pastDueDays = computePastDueDays(subscription);
    const lifecycleState = resolveLifecycleState(
      trialActive,
      subscription,
      access.accessState,
      pastDueDays
    );

    const now = nowIso();
    const entitlementSignature = signEntitlement({
      userId: ctx.user.id,
      now,
      accessState: access.accessState,
      subscriptionId: subscription?.id ? String(subscription.id) : null,
      subscriptionEndAt: subscription?.end_at ? String(subscription.end_at) : null,
    });

    res.status(200).json({
      data: {
        now,
        country,
        currency: 'INR',
        lifecycleState,
        accessState: access.accessState,
        accessReason: access.reason,
        policy: {
          retryDays: BILLING_POLICY.retryDays,
          limitedAfterDays: BILLING_POLICY.limitedAfterDays,
          blockedAfterDays: BILLING_POLICY.blockedAfterDays,
        },
        retryTimeline: computeRetryTimeline(subscription),
        pastDueDays,
        trial: {
          active: trialActive,
          startedAt: trialStart,
          endsAt: trialEnd,
          daysLeft: trialDaysLeft,
          consumed: Boolean(profile?.trial_consumed),
        },
        subscription: subscription
          ? {
              id: subscription.id,
              planCode: subscription.plan_code,
              status: subscription.status,
              amount: Number(subscription.amount || 0),
              currency: subscription.currency || 'INR',
              billingCycle: subscription.billing_cycle || 'monthly',
              startAt: subscription.start_at,
              endAt: subscription.end_at,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              autoRenew: subscription.auto_renew !== false,
              accessState: subscription.access_state || access.accessState,
            }
          : null,
        plans: plans.map((plan) => ({
          planCode: plan.plan_code,
          displayName: plan.display_name,
          billingMonths: Number(plan.billing_months || 1),
          amountInr: Number(plan.amount_inr || 0),
          taxInclusive: Boolean(plan.tax_inclusive),
          autoRenew: Boolean(plan.auto_renew),
          sortOrder: Number(plan.sort_order || 0),
          metadata: plan.metadata || {},
        })),
        points: {
          balance: pointsBalance,
          frozen: Boolean(profile?.points_frozen),
          pointsToInr: BILLING_POLICY.pointsToRupee,
          formula: 'Points convert to extension days using effective daily plan value.',
          earnedEvents,
        },
        referral: {
          myCode: String(profile.referral_code || ''),
          shareLink: `${PUBLIC_APP_BASE_URL}/pricing?ref=${encodeURIComponent(String(profile.referral_code || ''))}`,
          referredByCode: profile.referred_by_code ? String(profile.referred_by_code) : null,
          referralReward: BILLING_POLICY.referralPoints,
        },
        webhookBaseUrl: PUBLIC_TEST_WEBHOOK_BASE,
        entitlementSignature,
      },
    });
  } catch (err) {
    if (!isRecoverableSnapshotError(err)) {
      res.status(500).json({ error: (err as Error).message || 'Could not load billing snapshot.' });
      return;
    }

    const now = nowIso();
    const entitlementSignature = signEntitlement({
      userId: ctx.user.id,
      now,
      accessState: 'active',
      subscriptionId: null,
      subscriptionEndAt: null,
    });

    const earnedEvents = POINTS_EVENT_ORDER.map((eventType) => ({
      eventType,
      pointsPerEvent: Number(USAGE_POINT_EVENTS[eventType] || 0),
      earnedPoints: 0,
      completionCount: 0,
      completed: false,
    }));

    res.status(200).json({
      data: {
        now,
        country: 'India',
        currency: 'INR',
        lifecycleState: 'active',
        accessState: 'active',
        accessReason: 'snapshot_recoverable_fallback',
        policy: {
          retryDays: BILLING_POLICY.retryDays,
          limitedAfterDays: BILLING_POLICY.limitedAfterDays,
          blockedAfterDays: BILLING_POLICY.blockedAfterDays,
        },
        retryTimeline: [],
        pastDueDays: 0,
        trial: {
          active: false,
          startedAt: null,
          endsAt: null,
          daysLeft: 0,
          consumed: true,
        },
        subscription: null,
        plans: [],
        points: {
          balance: 0,
          frozen: false,
          pointsToInr: BILLING_POLICY.pointsToRupee,
          formula: 'Points convert to extension days using effective daily plan value.',
          earnedEvents,
        },
        referral: {
          myCode: '',
          shareLink: `${PUBLIC_APP_BASE_URL}/pricing`,
          referredByCode: null,
          referralReward: BILLING_POLICY.referralPoints,
        },
        webhookBaseUrl: PUBLIC_TEST_WEBHOOK_BASE,
        entitlementSignature,
        degraded: true,
      },
    });
  }
}
